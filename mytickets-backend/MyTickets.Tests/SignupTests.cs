using System.Net;
using System.Net.Http.Json;

namespace MyTickets.Tests;

public class SignupTests : IClassFixture<TestApp>
{
    private readonly TestApp _app;
    public SignupTests(TestApp app) => _app = app;

    private static object Details(string first = "Gijs", string last = "Janssens", object? extra = null) =>
        extra is null ? new { firstName = first, lastName = last } : extra;

    [Fact]
    public async Task Signing_up_takes_only_an_email_and_a_password_then_details_come_with_the_membership()
    {
        var shop = await _app.NewShopAsync();
        var guest = await _app.NewBareGuestAsync(shop.Slug);

        // Signed up, no membership yet, and staff would see the start of the email address for now.
        var org = await guest.GetOkAsync(shop.Url);
        Assert.Null(org["membership"]);
        Assert.False(org["profileComplete"]!.GetValue<bool>());

        // Choosing a membership without the details is refused with a code the page can act on.
        var tooSoon = await guest.PostAsJsonAsync($"{shop.Url}/join", new { tierId = shop.TierId });
        Assert.Equal(HttpStatusCode.Conflict, tooSoon.StatusCode);
        Assert.Contains("profile-incomplete", await tooSoon.Content.ReadAsStringAsync());

        (await guest.PutAsJsonAsync($"{shop.Url}/me/profile", new
        {
            firstName = " Gijs ", lastName = "Janssens", phone = "+32 470 12 34 56", street = "Kerkstraat 1", postalCode = "3500",
            city = "Hasselt", school = "UHasselt", faculty = "Rechten", studyYear = "2de bachelor",
        })).EnsureSuccessStatusCode();
        await guest.PostOkAsync($"{shop.Url}/join", new { tierId = shop.TierId });

        // The admin sees who joined, with everything they filled in.
        var member = (await shop.Admin.GetOkAsync($"{shop.Url}/admin/members")).AsArray().Single(m => m!["firstName"]?.GetValue<string>() == "Gijs")!;
        Assert.Equal("Gijs Janssens", member.Str("displayName"));
        Assert.Equal("Rechten", member.Str("faculty"));
        Assert.Equal("3500", member.Str("postalCode"));
    }

    [Fact]
    public async Task Each_organisation_decides_which_details_are_required()
    {
        var shop = await _app.NewShopAsync();
        (await shop.Admin.PutAsJsonAsync($"{shop.Url}/admin/member-fields", new { phone = "Required", school = "Off", faculty = "Off", studyYear = "Off", address = "Optional" })).EnsureSuccessStatusCode();
        var guest = await _app.NewBareGuestAsync(shop.Slug);

        var form = await guest.GetOkAsync($"{shop.Url}/me/profile");
        Assert.Equal("Required", form["fields"]!["phone"]!.GetValue<string>());
        Assert.Equal("Off", form["fields"]!["school"]!.GetValue<string>());

        var noPhone = await guest.PutAsJsonAsync($"{shop.Url}/me/profile", Details());
        Assert.Equal(HttpStatusCode.BadRequest, noPhone.StatusCode);
        Assert.Contains("phone number", await noPhone.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.BadRequest, (await guest.PutAsJsonAsync($"{shop.Url}/me/profile", new { firstName = "A", lastName = "B", phone = "call me" })).StatusCode);

        // A detail the organisation doesn't ask for is not kept, even if sent.
        (await guest.PutAsJsonAsync($"{shop.Url}/me/profile", new { firstName = "Gijs", lastName = "J", phone = "0470123456", school = "Secret school" })).EnsureSuccessStatusCode();
        Assert.Null((await guest.GetOkAsync($"{shop.Url}/me/profile"))["profile"]!["school"]);
        Assert.Equal(HttpStatusCode.BadRequest, (await shop.Admin.PutAsJsonAsync($"{shop.Url}/admin/member-fields", new { shoeSize = "Required" })).StatusCode);
    }

    [Fact]
    public async Task A_membership_that_needs_approval_starts_only_after_an_admin_says_yes()
    {
        var shop = await _app.NewShopAsync();
        var board = (await shop.Admin.PostOkAsync($"{shop.Url}/admin/tiers", new { name = "Board", priceCents = 0, isPublic = true, requiresApproval = true })).Str("id");
        var guest = await _app.NewGuestAsync(shop.Slug, "Wannabe");

        var asked = await guest.PostOkAsync($"{shop.Url}/join", new { tierId = board });
        Assert.True(asked["pending"]!.GetValue<bool>());
        var org = await guest.GetOkAsync(shop.Url);
        Assert.Null(org["membership"]);
        Assert.Equal("Pending", org["request"]!.Str("status"));
        // Asking again while waiting changes nothing.
        Assert.Equal(HttpStatusCode.Conflict, (await guest.PostAsJsonAsync($"{shop.Url}/join", new { tierId = board })).StatusCode);

        // Members can't decide; the admin sees the request with the person's details and approves.
        var member = await _app.NewBuyerAsync(shop);
        Assert.Equal(HttpStatusCode.Forbidden, (await member.GetAsync($"{shop.Url}/admin/requests")).StatusCode);
        var request = Assert.Single((await shop.Admin.GetOkAsync($"{shop.Url}/admin/requests")).AsArray())!;
        Assert.Equal("Wannabe", request.Str("firstName"));
        await shop.Admin.PostOkAsync($"{shop.Url}/admin/requests/{request.Str("id")}/approve", new { });

        // Free: it starts at once, and the request is done.
        org = await guest.GetOkAsync(shop.Url);
        Assert.Equal("Board", org["membership"]!.Str("tier"));
        Assert.Null(org["request"]);
        Assert.Empty((await shop.Admin.GetOkAsync($"{shop.Url}/admin/requests")).AsArray());
    }

    [Fact]
    public async Task A_paid_membership_that_needs_approval_is_paid_only_after_approval()
    {
        var shop = await _app.NewShopAsync();
        var vip = (await shop.Admin.PostOkAsync($"{shop.Url}/admin/tiers", new { name = "VIP", priceCents = 2500, isPublic = true, requiresApproval = true })).Str("id");
        var guest = await _app.NewGuestAsync(shop.Slug, "Rich");

        Assert.Null((await guest.PostOkAsync($"{shop.Url}/join", new { tierId = vip }))["checkoutUrl"]);
        var request = (await shop.Admin.GetOkAsync($"{shop.Url}/admin/requests"))[0]!;
        Assert.False((await shop.Admin.PostOkAsync($"{shop.Url}/admin/requests/{request.Str("id")}/approve", new { }))["started"]!.GetValue<bool>());

        // Approved: now they can pay, and paying starts the membership.
        Assert.Equal("Approved", (await guest.GetOkAsync(shop.Url))["request"]!.Str("status"));
        await guest.PayAsync(await guest.PostOkAsync($"{shop.Url}/join", new { tierId = vip }));
        var org = await guest.GetOkAsync(shop.Url);
        Assert.Equal("VIP", org["membership"]!.Str("tier"));
        Assert.Null(org["request"]);
    }

    [Fact]
    public async Task A_rejected_request_does_not_start_anything()
    {
        var shop = await _app.NewShopAsync();
        var board = (await shop.Admin.PostOkAsync($"{shop.Url}/admin/tiers", new { name = "Board", priceCents = 0, isPublic = true, requiresApproval = true })).Str("id");
        var guest = await _app.NewGuestAsync(shop.Slug);
        await guest.PostOkAsync($"{shop.Url}/join", new { tierId = board });
        var request = (await shop.Admin.GetOkAsync($"{shop.Url}/admin/requests"))[0]!;

        (await shop.Admin.PostAsJsonAsync($"{shop.Url}/admin/requests/{request.Str("id")}/reject", new { })).EnsureSuccessStatusCode();
        var org = await guest.GetOkAsync(shop.Url);
        Assert.Null(org["membership"]);
        Assert.Equal("Rejected", org["request"]!.Str("status"));
        Assert.Equal(HttpStatusCode.NotFound, (await shop.Admin.PostAsJsonAsync($"{shop.Url}/admin/requests/{request.Str("id")}/approve", new { })).StatusCode);

        // They can still take a membership that doesn't need approval.
        await guest.PostOkAsync($"{shop.Url}/join", new { tierId = shop.TierId });
        Assert.NotNull((await guest.GetOkAsync(shop.Url))["membership"]);
    }
}
