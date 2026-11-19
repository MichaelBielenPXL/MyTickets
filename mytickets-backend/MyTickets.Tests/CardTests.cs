using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using MyTickets.Api.Services;

namespace MyTickets.Tests;

/// <summary>Cards the organisation issues: made in Manage, written to a chip, claimed by a member with a tap.</summary>
public class CardTests : IClassFixture<TestApp>
{
    private readonly TestApp _app;
    public CardTests(TestApp app) => _app = app;

    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    [Fact]
    public void NewCode_is_ten_unambiguous_characters()
    {
        var code = CardCodes.NewCode();
        Assert.Equal(10, code.Length);
        Assert.All(code, c => Assert.Contains(c, Alphabet));
        Assert.NotEqual(code, CardCodes.NewCode());
    }

    [Fact]
    public void Normalise_accepts_lower_case_and_a_full_link()
    {
        Assert.Equal("ABCDEFGHJK", CardCodes.Normalise("https://x.be/c/abcdefghjk"));
        Assert.Equal("ABCDEFGHJK", CardCodes.Normalise("ABCDEFGHJK"));
        Assert.Equal("ABCDEFGHJK", CardCodes.Normalise(" abcde-fghjk "));
        Assert.Null(CardCodes.Normalise("04A2B91C"));
        Assert.Null(CardCodes.Normalise("ABCDEFGHJ0"));
        Assert.Null(CardCodes.Normalise(""));
    }

    [Fact]
    public void Display_pads_to_four_digits()
    {
        Assert.Equal("0042", CardCodes.Display(42));
        Assert.Equal("12345", CardCodes.Display(12345));
    }

    private record Org(HttpClient Admin, string Slug, string TierId)
    {
        public string Url => $"/api/orgs/{Slug}";
    }

    private static async Task<Org> NewOrgAsync(TestApp app)
    {
        var admin = await app.NewUserAsync("Admin");
        var slug = (await admin.PostOkAsync("/api/orgs", new { name = $"Club {Guid.NewGuid():N}"[..20], description = "" })).Str("slug");
        var tierId = (await admin.GetOkAsync($"/api/orgs/{slug}"))["tiers"]![0]!.Str("id");
        return new Org(admin, slug, tierId);
    }

    private static string NewUid() => Convert.ToHexString(Guid.NewGuid().ToByteArray())[..14];

    [Fact]
    public async Task Admin_creates_cards_with_numbers_and_links()
    {
        var org = await NewOrgAsync(_app);

        var created = (await org.Admin.PostOkAsync($"{org.Url}/admin/cards", new { count = 3 })).AsArray();

        Assert.Equal(["0001", "0002", "0003"], created.Select(c => c!.Str("number")).Order());
        Assert.All(created, c => Assert.Matches("^https://tickets\\.test/c/[A-Z2-9]{10}$", c!.Str("url")));
        Assert.All(created, c => Assert.Null(c!["uid"]));
        var listed = (await org.Admin.GetOkAsync($"{org.Url}/admin/cards")).AsArray();
        Assert.Equal("0003", listed[0]!.Str("number"));
        var csv = await org.Admin.GetStringAsync($"{org.Url}/admin/cards/export");
        var lines = csv.Trim().Split('\n');
        Assert.Equal("number,code,url", lines[0].Trim());
        Assert.Equal(4, lines.Length);
        // The link finds the organisation without its name, so it survives a rename.
        Assert.Equal(org.Slug, (await _app.CreateClient().GetOkAsync($"/api/c/{created[0]!.Str("code")}")).Str("slug"));
    }

    [Fact]
    public async Task Writing_a_card_records_its_chip_once()
    {
        var org = await NewOrgAsync(_app);
        var cards = (await org.Admin.PostOkAsync($"{org.Url}/admin/cards", new { count = 2 })).AsArray();
        var uid = NewUid();
        var first = $"{org.Url}/admin/cards/{cards[0]!.Str("id")}/written";

        var written = await org.Admin.PostOkAsync(first, new { uid, locked = true });
        Assert.Equal(uid, written.Str("uid"));
        Assert.True(written["locked"]!.GetValue<bool>());
        // Sent again after a lost answer: fine.
        await org.Admin.PostOkAsync(first, new { uid, locked = true });

        var sameChip = await org.Admin.PostAsJsonAsync($"{org.Url}/admin/cards/{cards[1]!.Str("id")}/written", new { uid, locked = true });
        Assert.Equal(HttpStatusCode.Conflict, sameChip.StatusCode);
        var otherChip = await org.Admin.PostAsJsonAsync(first, new { uid = NewUid(), locked = true });
        Assert.Equal(HttpStatusCode.Conflict, otherChip.StatusCode);
    }

    [Fact]
    public async Task A_blank_card_is_made_on_the_spot_and_unused_cards_can_be_deleted()
    {
        var org = await NewOrgAsync(_app);
        var blank = await org.Admin.PostOkAsync($"{org.Url}/admin/cards/blank", new { });
        Assert.Equal("0001", blank.Str("number"));

        Assert.Equal(HttpStatusCode.NoContent, (await org.Admin.DeleteAsync($"{org.Url}/admin/cards/{blank.Str("id")}")).StatusCode);
        var again = await org.Admin.PostOkAsync($"{org.Url}/admin/cards/blank", new { });
        await org.Admin.PostOkAsync($"{org.Url}/admin/cards/{again.Str("id")}/written", new { uid = NewUid(), locked = true });
        Assert.Equal(HttpStatusCode.Conflict, (await org.Admin.DeleteAsync($"{org.Url}/admin/cards/{again.Str("id")}")).StatusCode);
        Assert.True((await org.Admin.GetOkAsync($"{org.Url}/admin/cards/writing"))["ready"]!.GetValue<bool>());
    }

    [Fact]
    public async Task Members_cannot_manage_cards()
    {
        var org = await NewOrgAsync(_app);
        var guest = await _app.NewGuestAsync(org.Slug);
        await guest.PostOkAsync($"{org.Url}/join", new { tierId = org.TierId });

        Assert.Equal(HttpStatusCode.Forbidden, (await guest.PostAsJsonAsync($"{org.Url}/admin/cards", new { count = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await guest.GetAsync($"{org.Url}/admin/cards")).StatusCode);
    }

    /// <summary>A card made and written by the organisation, ready to be claimed: its id, link code and chip serial.</summary>
    private static async Task<(string Id, string Code, string Uid)> ReadyCardAsync(Org org)
    {
        var card = (await org.Admin.PostOkAsync($"{org.Url}/admin/cards", new { count = 1 }))[0]!;
        var uid = NewUid();
        await org.Admin.PostOkAsync($"{org.Url}/admin/cards/{card.Str("id")}/written", new { uid, locked = true });
        return (card.Str("id"), card.Str("code"), uid);
    }

    private async Task<HttpClient> MemberAsync(Org org, string name = "Guest")
    {
        var guest = await _app.NewGuestAsync(org.Slug, name);
        await guest.PostOkAsync($"{org.Url}/join", new { tierId = org.TierId });
        return guest;
    }

    [Fact]
    public async Task Tapping_a_free_card_links_it_to_the_wallet()
    {
        var org = await NewOrgAsync(_app);
        var (_, code, _) = await ReadyCardAsync(org);
        var member = await MemberAsync(org);

        var before = await member.GetOkAsync($"{org.Url}/cards/{code.ToLowerInvariant()}");
        Assert.Equal("free", before.Str("state"));
        Assert.Equal("0001", before.Str("number"));
        Assert.True(before["member"]!.GetValue<bool>());

        Assert.Equal("0001", (await member.PostOkAsync($"{org.Url}/cards/{code}/link", new { })).Str("number"));
        Assert.Equal("mine", (await member.GetOkAsync($"{org.Url}/cards/{code}")).Str("state"));
        var mine = (await member.GetOkAsync($"{org.Url}/me/cards")).AsArray();
        Assert.Equal("0001", Assert.Single(mine)!.Str("number"));
        Assert.Null(mine[0]!["uid"]);
        Assert.Equal("Guest Tester", (await org.Admin.GetOkAsync($"{org.Url}/admin/cards"))[0]!["linkedTo"]!.Str("name"));
    }

    [Fact]
    public async Task A_card_is_only_linked_once()
    {
        var org = await NewOrgAsync(_app);
        var (_, code, _) = await ReadyCardAsync(org);
        var first = await MemberAsync(org, "First");
        var second = await MemberAsync(org, "Second");

        var both = await Task.WhenAll(
            first.PostAsJsonAsync($"{org.Url}/cards/{code}/link", new { }),
            second.PostAsJsonAsync($"{org.Url}/cards/{code}/link", new { }));

        Assert.Single(both, r => r.IsSuccessStatusCode);
        Assert.Single(both, r => r.StatusCode == HttpStatusCode.Conflict);
        var loser = both[0].IsSuccessStatusCode ? second : first;
        Assert.Equal("taken", (await loser.GetOkAsync($"{org.Url}/cards/{code}")).Str("state"));
    }

    [Fact]
    public async Task One_new_card_per_year_unless_allowed()
    {
        var org = await NewOrgAsync(_app);
        var member = await MemberAsync(org);
        var (_, firstCode, _) = await ReadyCardAsync(org);
        var (_, secondCode, _) = await ReadyCardAsync(org);
        await member.PostOkAsync($"{org.Url}/cards/{firstCode}/link", new { });

        var refused = await member.PostAsJsonAsync($"{org.Url}/cards/{secondCode}/link", new { });
        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        var today = DateTime.UtcNow;
        Assert.Contains($"You can link a new one from", await refused.Content.ReadAsStringAsync());
        Assert.Contains($"/{today.Year + 1}", await refused.Content.ReadAsStringAsync());

        var membershipId = (await org.Admin.GetOkAsync($"{org.Url}/admin/members")).AsArray()
            .First(m => m!.Str("displayName") == "Guest Tester")!.Str("id");
        (await org.Admin.PutAsJsonAsync($"{org.Url}/admin/members/{membershipId}/extra-card", new { allowed = true })).EnsureSuccessStatusCode();
        bool Allowed(JsonNode members) => members.AsArray().First(m => m!.Str("id") == membershipId)!["extraCardAllowed"]!.GetValue<bool>();
        Assert.True(Allowed(await org.Admin.GetOkAsync($"{org.Url}/admin/members")));
        await member.PostOkAsync($"{org.Url}/cards/{secondCode}/link", new { });
        Assert.False(Allowed(await org.Admin.GetOkAsync($"{org.Url}/admin/members")));

        // The extra card is used up.
        var (_, thirdCode, _) = await ReadyCardAsync(org);
        Assert.Equal(HttpStatusCode.Conflict, (await member.PostAsJsonAsync($"{org.Url}/cards/{thirdCode}/link", new { })).StatusCode);
    }

    [Fact]
    public async Task Non_members_are_asked_to_join()
    {
        var org = await NewOrgAsync(_app);
        var (_, code, _) = await ReadyCardAsync(org);
        var guest = await _app.NewGuestAsync(org.Slug);

        var state = await guest.GetOkAsync($"{org.Url}/cards/{code}");
        Assert.Equal("free", state.Str("state"));
        Assert.False(state["member"]!.GetValue<bool>());
        Assert.Equal(HttpStatusCode.Forbidden, (await guest.PostAsJsonAsync($"{org.Url}/cards/{code}/link", new { })).StatusCode);
    }

    [Fact]
    public async Task Blocked_and_unknown_cards_say_so()
    {
        var org = await NewOrgAsync(_app);
        var (id, code, _) = await ReadyCardAsync(org);
        var member = await MemberAsync(org);
        (await org.Admin.PutAsJsonAsync($"{org.Url}/admin/cards/{id}/blocked", new { blocked = true })).EnsureSuccessStatusCode();

        Assert.Equal("blocked", (await member.GetOkAsync($"{org.Url}/cards/{code}")).Str("state"));
        Assert.Equal(HttpStatusCode.Conflict, (await member.PostAsJsonAsync($"{org.Url}/cards/{code}/link", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await member.GetAsync($"{org.Url}/cards/ABCDEFGHJK")).StatusCode);
    }

    [Fact]
    public async Task Members_cannot_type_or_delete_cards()
    {
        var org = await NewOrgAsync(_app);
        var (_, code, _) = await ReadyCardAsync(org);
        var member = await MemberAsync(org);
        await member.PostOkAsync($"{org.Url}/cards/{code}/link", new { });
        var cardId = (await member.GetOkAsync($"{org.Url}/me/cards"))[0]!.Str("id");

        Assert.False((await member.PostAsJsonAsync($"{org.Url}/me/cards", new { uid = NewUid(), label = "" })).IsSuccessStatusCode);
        Assert.False((await member.DeleteAsync($"{org.Url}/me/cards/{cardId}")).IsSuccessStatusCode);
        // Blocking a lost card is still theirs to do.
        (await member.PutAsJsonAsync($"{org.Url}/me/cards/{cardId}/blocked", new { blocked = true })).EnsureSuccessStatusCode();
    }

    /// <summary>Charges one €1 beer to whatever staff tapped, scanned or typed; 402 means the card was found but is empty.</summary>
    private static async Task<HttpStatusCode> ChargeAsync(Org org, string card)
    {
        var beer = (await org.Admin.PostOkAsync($"{org.Url}/admin/products", new { name = "Beer", priceCents = 100, active = true })).Str("id");
        var sale = new { cardUid = card, items = new[] { new { productId = beer, quantity = 1 } }, requestId = Guid.NewGuid() };
        return (await org.Admin.PostAsJsonAsync($"{org.Url}/staff/charge", sale)).StatusCode;
    }

    [Fact]
    public async Task Bar_finds_a_card_by_chip_link_or_number()
    {
        var org = await NewOrgAsync(_app);
        var (_, code, uid) = await ReadyCardAsync(org);
        var member = await MemberAsync(org);
        await member.PostOkAsync($"{org.Url}/cards/{code}/link", new { });

        Assert.Equal(HttpStatusCode.PaymentRequired, await ChargeAsync(org, uid));
        Assert.Equal(HttpStatusCode.PaymentRequired, await ChargeAsync(org, $"https://tickets.test/c/{code}"));
        Assert.Equal(HttpStatusCode.PaymentRequired, await ChargeAsync(org, "0001"));
        Assert.Equal("Guest Tester", (await org.Admin.PostOkAsync($"{org.Url}/staff/lookup", new { cardUid = code })).Str("name"));
    }

    [Fact]
    public async Task Unlinked_card_is_refused_at_the_bar()
    {
        var org = await NewOrgAsync(_app);
        var (_, _, uid) = await ReadyCardAsync(org);

        var lookup = await org.Admin.PostAsJsonAsync($"{org.Url}/staff/lookup", new { cardUid = uid });
        Assert.Equal(HttpStatusCode.NotFound, lookup.StatusCode);
        Assert.Contains("isn't linked to anyone yet", await lookup.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Old_cards_still_pay()
    {
        var org = await NewOrgAsync(_app);
        var (_, code, uid) = await ReadyCardAsync(org);
        var member = await MemberAsync(org);
        await member.PostOkAsync($"{org.Url}/cards/{code}/link", new { });
        // A card linked before cards were issued: a serial number and a wallet, no link code.
        foreach (var file in Directory.GetFiles(Path.Combine(_app.DataFolder, "organisations"), "*.db"))
        {
            using var connection = new Microsoft.Data.Sqlite.SqliteConnection($"Data Source={file}");
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = "UPDATE NfcCards SET Code = NULL WHERE Uid = $uid";
            command.Parameters.AddWithValue("$uid", uid);
            command.ExecuteNonQuery();
        }

        Assert.Equal(HttpStatusCode.PaymentRequired, await ChargeAsync(org, uid));
        Assert.Single((await member.GetOkAsync($"{org.Url}/me/cards")).AsArray());
    }
}

/// <summary>A site whose public address isn't set yet: cards can be made but not written.</summary>
public class TestAppWithoutPublicUrl : TestApp
{
    protected override string PublicUrl => "";
}

public class CardWritingNeedsAnAddressTests(TestAppWithoutPublicUrl app) : IClassFixture<TestAppWithoutPublicUrl>
{
    [Fact]
    public async Task Writing_is_refused_without_a_public_address()
    {
        var admin = await app.NewUserAsync("Admin");
        var slug = (await admin.PostOkAsync("/api/orgs", new { name = $"Club {Guid.NewGuid():N}"[..20], description = "" })).Str("slug");
        var url = $"/api/orgs/{slug}/admin/cards";

        var writing = await admin.GetOkAsync($"{url}/writing");
        Assert.False(writing["ready"]!.GetValue<bool>());
        Assert.False(string.IsNullOrEmpty(writing.Str("reason")));
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync($"{url}/blank", new { })).StatusCode);
    }
}
