using System.IO.Compression;
using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Security.Cryptography.Pkcs;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc.Testing;

namespace MyTickets.Tests;

/// <summary>The member's QR code: shown on the home page, saved to Apple or Google Wallet, scanned by staff like a card.</summary>
public class MemberPassTests : IClassFixture<TestApp>
{
    private readonly TestApp _app;
    public MemberPassTests(TestApp app) => _app = app;

    private async Task<(HttpClient Admin, string Url, HttpClient Member)> OrgWithMemberAsync(TestApp app)
    {
        var admin = await app.NewUserAsync("Admin");
        var slug = (await admin.PostOkAsync("/api/orgs", new { name = $"Club {Guid.NewGuid():N}"[..20], description = "" })).Str("slug");
        var url = $"/api/orgs/{slug}";
        var tierId = (await admin.GetOkAsync(url))["tiers"]![0]!.Str("id");
        var member = await app.NewGuestAsync(slug, "Pass");
        await member.PostOkAsync($"{url}/join", new { tierId });
        return (admin, url, member);
    }

    [Fact]
    public async Task A_member_has_one_lasting_code_that_staff_scan_at_the_bar_and_the_door()
    {
        var (admin, url, member) = await OrgWithMemberAsync(_app);
        var pass = await member.GetOkAsync($"{url}/me/pass");
        var code = pass.Str("code");
        Assert.Matches("^MT[A-Z2-9]{12}$", code);
        Assert.Equal(code, (await member.GetOkAsync($"{url}/me/pass")).Str("code"));
        Assert.False(pass["appleWallet"]!.GetValue<bool>()); // not configured in tests
        Assert.False(pass["googleWallet"]!.GetValue<bool>());

        // Staff may type it with dashes and in lower case, as read off a screen.
        var lookup = await admin.PostOkAsync($"{url}/staff/lookup", new { cardUid = pass.Str("display").ToLowerInvariant() });
        Assert.Equal("Pass Tester", lookup.Str("name"));

        await member.PayAsync(await member.PostOkAsync($"{url}/wallet/topup", new { amountCents = 1000 }));
        var beer = (await admin.PostOkAsync($"{url}/admin/products", new { name = "Beer", priceCents = 250, active = true })).Str("id");
        var sale = await admin.PostOkAsync($"{url}/staff/charge", new { cardUid = code, items = new[] { new { productId = beer, quantity = 2 } } });
        Assert.Equal(500, sale.Int("balanceCents"));

        var ev = await admin.PostOkAsync($"{url}/admin/events", new { name = "Party", description = "", location = "Hall", startsAt = DateTime.UtcNow.AddDays(7), published = true });
        var type = await admin.PostOkAsync($"{url}/admin/events/{ev.Str("id")}/ticket-types", new { name = "Regular", priceCents = 0, capacity = 5, maxPerUser = 10 });
        await member.PostOkAsync($"{url}/events/{ev.Str("id")}/order", new { items = new[] { new { ticketTypeId = type.Str("id"), quantity = 1 } } });
        await admin.PostOkAsync($"{url}/staff/events/{ev.Str("id")}/open", new { });
        var checkedIn = await admin.PostOkAsync($"{url}/staff/checkin", new { eventId = ev.Str("id"), code });
        Assert.Equal("Pass Tester", checkedIn.Str("name"));

        var unknown = await admin.PostAsJsonAsync($"{url}/staff/lookup", new { cardUid = "MTAAAAAAAAAAAA" });
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
    }

    [Fact]
    public async Task Wallet_buttons_are_refused_while_the_server_has_no_wallet_keys()
    {
        var (_, url, member) = await OrgWithMemberAsync(_app);
        Assert.Equal(HttpStatusCode.NotFound, (await member.GetAsync($"{url}/me/pass/apple")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await member.GetAsync($"{url}/me/pass/google")).StatusCode);
    }

    [Fact]
    public async Task Apple_wallet_pass_is_a_signed_pkpass_holding_the_member_code()
    {
        var folder = Directory.CreateTempSubdirectory("mytickets-apple-").FullName;
        using var rsa = RSA.Create(2048);
        var request = new CertificateRequest("CN=Pass Type ID: pass.test.mytickets", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        using var cert = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddDays(1));
        File.WriteAllBytes(Path.Combine(folder, "pass.p12"), cert.Export(X509ContentType.Pkcs12, "secret"));
        File.WriteAllBytes(Path.Combine(folder, "wwdr.cer"), cert.Export(X509ContentType.Cert));

        using var app = _app.WithWebHostBuilder(b =>
        {
            b.UseSetting("WalletPasses:Apple:PassTypeId", "pass.test.mytickets");
            b.UseSetting("WalletPasses:Apple:TeamId", "TEAM123456");
            b.UseSetting("WalletPasses:Apple:CertificatePath", Path.Combine(folder, "pass.p12"));
            b.UseSetting("WalletPasses:Apple:CertificatePassword", "secret");
            b.UseSetting("WalletPasses:Apple:WwdrCertificatePath", Path.Combine(folder, "wwdr.cer"));
        });
        var (url, member) = await MemberOnAsync(app);
        var code = (await member.GetOkAsync($"{url}/me/pass")).Str("code");

        var response = await member.GetAsync($"{url}/me/pass/apple");
        Assert.Equal("application/vnd.apple.pkpass", response.Content.Headers.ContentType?.MediaType);
        using var zip = new ZipArchive(await response.Content.ReadAsStreamAsync());
        byte[] Read(string name) { using var s = zip.GetEntry(name)!.Open(); using var m = new MemoryStream(); s.CopyTo(m); return m.ToArray(); }

        var passJson = JsonNode.Parse(Read("pass.json"))!;
        Assert.Equal(code, passJson["barcodes"]![0]!.Str("message"));
        Assert.Equal("Pass Tester", passJson["storeCard"]!["primaryFields"]![0]!.Str("value"));
        var manifest = Read("manifest.json");
        Assert.Equal(Convert.ToHexStringLower(SHA1.HashData(Read("icon.png"))), JsonNode.Parse(manifest)!.Str("icon.png"));
        var signature = new SignedCms(new ContentInfo(manifest), detached: true);
        signature.Decode(Read("signature"));
        signature.CheckSignature(verifySignatureOnly: true);
    }

    [Fact]
    public async Task Google_wallet_link_carries_a_signed_pass_with_the_member_code()
    {
        var folder = Directory.CreateTempSubdirectory("mytickets-google-").FullName;
        using var rsa = RSA.Create(2048);
        var keyFile = Path.Combine(folder, "key.json");
        File.WriteAllText(keyFile, new JsonObject { ["client_email"] = "wallet@test.iam.gserviceaccount.com", ["private_key"] = rsa.ExportPkcs8PrivateKeyPem() }.ToJsonString());

        using var app = _app.WithWebHostBuilder(b =>
        {
            b.UseSetting("WalletPasses:Google:IssuerId", "3388000000012345678");
            b.UseSetting("WalletPasses:Google:ServiceAccountKeyPath", keyFile);
        });
        var (url, member) = await MemberOnAsync(app, new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        var code = (await member.GetOkAsync($"{url}/me/pass")).Str("code");

        var response = await member.GetAsync($"{url}/me/pass/google");
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        var jwt = response.Headers.Location!.ToString();
        Assert.StartsWith("https://pay.google.com/gp/v/save/", jwt);
        var parts = jwt["https://pay.google.com/gp/v/save/".Length..].Split('.');
        Assert.True(rsa.VerifyData(Encoding.ASCII.GetBytes(parts[0] + "." + parts[1]), FromBase64Url(parts[2]), HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1));
        var claims = JsonNode.Parse(FromBase64Url(parts[1]))!;
        Assert.Equal("savetowallet", claims.Str("typ"));
        Assert.Equal(code, claims["payload"]!["genericObjects"]![0]!["barcode"]!.Str("value"));
    }

    private async Task<(string Url, HttpClient Member)> MemberOnAsync(WebApplicationFactory<Program> app, WebApplicationFactoryClientOptions? options = null)
    {
        var admin = app.CreateClient();
        (await admin.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"admin-{Guid.NewGuid():N}@example.com", password = "correct horse", displayName = "Admin", organisationName = $"Wallet {Guid.NewGuid():N}"[..20],
        })).EnsureSuccessStatusCode();
        var slug = (await admin.GetOkAsync("/api/orgs"))!.AsArray().First(o => o!["joined"]!.GetValue<bool>())!.Str("slug");
        var url = $"/api/orgs/{slug}";
        var tierId = (await admin.GetOkAsync(url))["tiers"]![0]!.Str("id");

        var member = app.CreateClient(options ?? new WebApplicationFactoryClientOptions());
        (await member.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"pass-{Guid.NewGuid():N}@example.com", password = "correct horse", displayName = "Pass", joinOrganisationSlug = slug,
        })).EnsureSuccessStatusCode();
        (await member.PutAsJsonAsync($"{url}/me/profile", new { firstName = "Pass", lastName = "Tester" })).EnsureSuccessStatusCode();
        await member.PostOkAsync($"{url}/join", new { tierId });
        return (url, member);
    }

    private static byte[] FromBase64Url(string s)
    {
        s = s.Replace('-', '+').Replace('_', '/');
        return Convert.FromBase64String(s.PadRight(s.Length + (4 - s.Length % 4) % 4, '='));
    }
}

public class BrandColorTests
{
    [Theory]
    [InlineData("#ffffff")]
    [InlineData("#f5e663")]
    [InlineData("#c9b8a0")]
    public void A_colour_too_light_for_white_text_is_darkened_until_it_reads(string color)
    {
        var shade = MyTickets.Api.Services.BrandColors.ReadableShade(color);
        Assert.NotEqual(color, shade);
        Assert.True(MyTickets.Api.Services.BrandColors.WhiteContrast(shade) >= 4.5);
    }

    [Fact]
    public void A_dark_enough_colour_is_kept_as_it_is() =>
        Assert.Equal("#3d6b56", MyTickets.Api.Services.BrandColors.ReadableShade("#3d6b56"));
}
