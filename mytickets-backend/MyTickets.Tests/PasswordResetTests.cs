using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;

namespace MyTickets.Tests;

public partial class PasswordResetTests : IClassFixture<TestApp>
{
    private readonly TestApp _app;
    public PasswordResetTests(TestApp app) => _app = app;

    [GeneratedRegex(@"reset-password\?token=(\S+)")]
    private static partial Regex LinkToken();

    /// <summary>The token in the newest reset link sent to this address.</summary>
    private string TokenSentTo(string email) =>
        Uri.UnescapeDataString(LinkToken().Match(_app.Emails.To(email).Last().Text).Groups[1].Value);

    private Task<HttpResponseMessage> LoginAsync(string email, string password, string? slug = null) =>
        _app.CreateClient().PostAsJsonAsync("/api/auth/login", new { email, password, organisationSlug = slug });

    [Fact]
    public async Task A_member_gets_a_link_by_email_that_sets_a_new_password_once()
    {
        var shop = await _app.NewShopAsync();
        var email = $"lotte-{Guid.NewGuid():N}@example.com";
        (await _app.CreateClient().PostAsJsonAsync("/api/auth/register", new { email, password = "old password", acceptTerms = true, joinOrganisationSlug = shop.Slug }))
            .EnsureSuccessStatusCode();

        var asked = await _app.CreateClient().PostAsJsonAsync("/api/auth/forgot-password", new { email, organisationSlug = shop.Slug });
        Assert.Equal(HttpStatusCode.NoContent, asked.StatusCode);
        var mail = Assert.Single(_app.Emails.To(email));
        Assert.Contains($"https://tickets.test/{shop.Slug}/reset-password?token=", mail.Text);

        var reset = await _app.CreateClient().PostOkAsync("/api/auth/reset-password", new { token = TokenSentTo(email), password = "new password" });
        Assert.Equal(shop.Slug, reset.Str("organisationSlug"));
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(email, "new password", shop.Slug)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(email, "old password", shop.Slug)).StatusCode);

        // The link works once: the password it was made for is gone.
        var again = await _app.CreateClient().PostAsJsonAsync("/api/auth/reset-password", new { token = TokenSentTo(email), password = "third password" });
        Assert.Equal(HttpStatusCode.BadRequest, again.StatusCode);
        Assert.Contains("Ask for a new one", await again.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task An_organiser_resets_the_one_password_for_all_their_organisations()
    {
        var email = $"olga-{Guid.NewGuid():N}@example.com";
        var signup = await _app.CreateClient().PostOkAsync("/api/auth/register",
            new { email, password = "old password", acceptTerms = true, displayName = "Olga", organisationName = $"Club {Guid.NewGuid():N}"[..20] });
        var slug = signup.Str("organisationSlug");

        // On the front page: the organiser login, in Dutch for someone using the app in Dutch.
        (await _app.CreateClient().PostAsJsonAsync("/api/auth/forgot-password", new { email, language = "nl" })).EnsureSuccessStatusCode();
        var mail = Assert.Single(_app.Emails.To(email));
        Assert.StartsWith("Nieuw wachtwoord", mail.Subject);
        Assert.Contains("https://tickets.test/reset-password?token=", mail.Text);

        var reset = await _app.CreateClient().PostOkAsync("/api/auth/reset-password", new { token = TokenSentTo(email), password = "new password" });
        Assert.Null(reset["organisationSlug"]);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(email, "new password")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(email, "new password", slug)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(email, "old password", slug)).StatusCode);
    }

    [Fact]
    public async Task Asking_never_tells_whether_an_address_has_an_account()
    {
        var shop = await _app.NewShopAsync();
        var nobody = $"nobody-{Guid.NewGuid():N}@example.com";
        var answer = await _app.CreateClient().PostAsJsonAsync("/api/auth/forgot-password", new { email = nobody, organisationSlug = shop.Slug });
        Assert.Equal(HttpStatusCode.NoContent, answer.StatusCode);
        Assert.Empty(_app.Emails.To(nobody));

        // A member's account is a MyTickets account like any other: asked on the front page, the link comes too.
        var member = $"member-{Guid.NewGuid():N}@example.com";
        (await _app.CreateClient().PostAsJsonAsync("/api/auth/register", new { email = member, password = "a password", acceptTerms = true, joinOrganisationSlug = shop.Slug }))
            .EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NoContent, (await _app.CreateClient().PostAsJsonAsync("/api/auth/forgot-password", new { email = member })).StatusCode);
        Assert.Contains("https://tickets.test/reset-password?token=", Assert.Single(_app.Emails.To(member)).Text);
    }

    [Fact]
    public async Task A_made_up_link_or_a_short_password_changes_nothing()
    {
        var client = _app.CreateClient();
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/auth/reset-password", new { token = "made-up", password = "long enough" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/auth/reset-password", new { token = "made-up", password = "short" })).StatusCode);
    }
}
