using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MyTickets.Api.Data;
using MyTickets.Api.Services;

namespace MyTickets.Tests;

public static class MembershipDates
{
    /// <summary>30 June of next year: a typical end of the academic year, always in the future.</summary>
    public static string NextSummer => $"{DateTime.UtcNow.Year + 1}-06-30";

    /// <summary>The end of that day in Belgium, in UTC, as the API reports it.</summary>
    public static DateTime EndOfDayInBelgium(string date) =>
        TimeZoneInfo.ConvertTimeToUtc(DateTime.Parse(date).AddDays(1), TimeZoneInfo.FindSystemTimeZoneById("Europe/Brussels"));
}

public class MembershipEndDateTests : IClassFixture<TestApp>
{
    private readonly TestApp _app;
    public MembershipEndDateTests(TestApp app) => _app = app;

    private static async Task<DateTime?> ExpiryOfAsync(HttpClient member, ShopSetup shop) =>
        (await member.GetOkAsync(shop.Url))["membership"]!["expiresAt"]?.GetValue<DateTime>().ToUniversalTime();

    [Fact]
    public async Task Everyone_on_a_membership_type_ends_on_its_date_whenever_they_joined()
    {
        var shop = await _app.NewShopAsync();
        var season = (await shop.Admin.PostOkAsync($"{shop.Url}/admin/tiers", new { name = "Season", priceCents = 0, isPublic = true, endsOn = MembershipDates.NextSummer })).Str("id");

        var first = await _app.NewGuestAsync(shop.Slug);
        await first.PostOkAsync($"{shop.Url}/join", new { tierId = season });
        var second = await _app.NewGuestAsync(shop.Slug);
        await second.PostOkAsync($"{shop.Url}/join", new { tierId = season });

        // Valid through all of 30 June, Belgian time.
        var end = MembershipDates.EndOfDayInBelgium(MembershipDates.NextSummer);
        Assert.Equal(end, await ExpiryOfAsync(first, shop));
        Assert.Equal(end, await ExpiryOfAsync(second, shop));
        var tier = (await first.GetOkAsync(shop.Url))["tiers"]!.AsArray().Single(t => t!.Str("id") == season)!;
        Assert.Equal(MembershipDates.NextSummer, tier.Str("endsOn"));
        // A membership without an end date never ends.
        var free = await _app.NewBuyerAsync(shop);
        Assert.Null(await ExpiryOfAsync(free, shop));
    }

    [Fact]
    public async Task Moving_the_date_moves_everyone_except_members_given_their_own_date()
    {
        var shop = await _app.NewShopAsync();
        var season = (await shop.Admin.PostOkAsync($"{shop.Url}/admin/tiers", new { name = "Season", priceCents = 0, isPublic = true, endsOn = MembershipDates.NextSummer })).Str("id");
        var ordinary = await _app.NewGuestAsync(shop.Slug);
        await ordinary.PostOkAsync($"{shop.Url}/join", new { tierId = season });
        var special = await _app.NewGuestAsync(shop.Slug, "Special");
        await special.PostOkAsync($"{shop.Url}/join", new { tierId = season });

        // An admin gives one member a date of their own...
        var members = (await shop.Admin.GetOkAsync($"{shop.Url}/admin/members")).AsArray();
        var specialId = members.Single(m => m!.Str("displayName") == "Special Tester")!.Str("id");
        var ownDate = DateTime.UtcNow.AddYears(2);
        (await shop.Admin.PutAsJsonAsync($"{shop.Url}/admin/members/{specialId}", new { role = "Member", tierId = season, expiresAt = ownDate })).EnsureSuccessStatusCode();

        // ...then the season is extended to the end of August.
        var later = $"{DateTime.UtcNow.Year + 1}-08-31";
        (await shop.Admin.PutAsJsonAsync($"{shop.Url}/admin/tiers/{season}", new { name = "Season", priceCents = 0, isPublic = true, endsOn = later })).EnsureSuccessStatusCode();

        Assert.Equal(MembershipDates.EndOfDayInBelgium(later), await ExpiryOfAsync(ordinary, shop));
        Assert.Equal(ownDate, (await ExpiryOfAsync(special, shop))!.Value, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task Nobody_pays_twice_for_a_membership_they_already_have()
    {
        var shop = await _app.NewShopAsync();
        var paid = (await shop.Admin.PostOkAsync($"{shop.Url}/admin/tiers", new { name = "Premium", priceCents = 2500, isPublic = true, endsOn = MembershipDates.NextSummer })).Str("id");
        var member = await _app.NewGuestAsync(shop.Slug);
        await member.PayAsync(await member.PostOkAsync($"{shop.Url}/join", new { tierId = paid }));

        var again = await member.PostAsJsonAsync($"{shop.Url}/join", new { tierId = paid });
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Contains($"You already have this membership until 30/06/{DateTime.UtcNow.Year + 1}", await again.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task An_ended_membership_type_can_no_longer_be_joined()
    {
        var shop = await _app.NewShopAsync();
        var old = (await shop.Admin.PostOkAsync($"{shop.Url}/admin/tiers", new { name = "Last season", priceCents = 0, isPublic = true, endsOn = MembershipDates.NextSummer })).Str("id");
        // Time passes: the type ended yesterday.
        await using (var scope = await OpenAsync(shop.Slug))
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.MembershipTiers.Where(t => t.Id == Guid.Parse(old))
                .ExecuteUpdateAsync(u => u.SetProperty(t => t.EndsOn, DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2))));
        }

        var visitor = _app.CreateClient();
        Assert.DoesNotContain((await visitor.GetOkAsync($"/api/public/orgs/{shop.Slug}"))["tiers"]!.AsArray(), t => t!.Str("id") == old);
        var guest = await _app.NewGuestAsync(shop.Slug);
        Assert.DoesNotContain((await guest.GetOkAsync(shop.Url))["tiers"]!.AsArray(), t => t!.Str("id") == old);
        var join = await guest.PostAsJsonAsync($"{shop.Url}/join", new { tierId = old });
        Assert.Equal(HttpStatusCode.Conflict, join.StatusCode);
        Assert.Contains("ended on", await join.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task An_end_date_in_the_past_is_refused()
    {
        var shop = await _app.NewShopAsync();
        var response = await shop.Admin.PostAsJsonAsync($"{shop.Url}/admin/tiers", new { name = "Oops", priceCents = 0, isPublic = true, endsOn = "2020-06-30" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private async Task<AsyncServiceScope> OpenAsync(string slug)
    {
        Organisation organisation;
        using (var lookup = _app.Services.CreateScope())
            organisation = (await lookup.ServiceProvider.GetRequiredService<AppCache>().OrganisationBySlugAsync(slug))!;
        return await _app.Services.GetRequiredService<TenantScopes>().OpenAsync(organisation);
    }
}
