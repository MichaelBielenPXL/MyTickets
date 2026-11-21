using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;

namespace MyTickets.Tests;

public class FlowTests : IClassFixture<TestApp>
{
    private readonly TestApp _app;
    public FlowTests(TestApp app) => _app = app;

    private record Org(HttpClient Admin, string Slug, string FreeTierId)
    {
        public string Url => $"/api/orgs/{Slug}";
    }

    private async Task<Org> NewOrgAsync()
    {
        var admin = await _app.NewUserAsync("Admin");
        var created = await admin.PostOkAsync("/api/orgs", new { name = $"Club {Guid.NewGuid():N}"[..20], description = "" });
        var slug = created.Str("slug");
        var org = await admin.GetOkAsync($"/api/orgs/{slug}");
        return new Org(admin, slug, org["tiers"]![0]!.Str("id"));
    }

    private static async Task<(string EventId, string TicketTypeId)> NewEventAsync(Org org, int priceCents, int capacity, object? allowedTierIds = null)
    {
        var ev = await org.Admin.PostOkAsync($"{org.Url}/admin/events", new
        {
            name = "Party", description = "", location = "Hall", startsAt = DateTime.UtcNow.AddDays(7), published = true,
        });
        var type = await org.Admin.PostOkAsync($"{org.Url}/admin/events/{ev.Str("id")}/ticket-types", new
        {
            name = "Regular", priceCents, capacity, maxPerUser = 10, allowedTierIds,
        });
        // A week away, so open the doors early: these tests check people in today.
        await org.Admin.PostOkAsync($"{org.Url}/staff/events/{ev.Str("id")}/open", new { });
        return (ev.Str("id"), type.Str("id"));
    }

    private async Task<HttpClient> NewMemberAsync(Org org, string name = "Guest")
    {
        var user = await _app.NewGuestAsync(org.Slug, name);
        await user.PostOkAsync($"{org.Url}/join", new { tierId = org.FreeTierId });
        return user;
    }

    /// <summary>The organisation issues and writes a card, the member taps it to claim it; returns the chip's serial.</summary>
    private static async Task<string> LinkCardAsync(HttpClient user, Org org, string? uid = null)
    {
        uid ??= Convert.ToHexString(Guid.NewGuid().ToByteArray())[..14];
        var card = (await org.Admin.PostOkAsync($"{org.Url}/admin/cards", new { count = 1 }))[0]!;
        await org.Admin.PostOkAsync($"{org.Url}/admin/cards/{card.Str("id")}/written", new { uid, locked = true });
        await user.PostOkAsync($"{org.Url}/cards/{card.Str("code")}/link", new { });
        return uid;
    }

    private static async Task TopUpAsync(HttpClient user, Org org, int cents) =>
        await user.PayAsync(await user.PostOkAsync($"{org.Url}/wallet/topup", new { amountCents = cents }));

    private static async Task<int> BalanceAsync(HttpClient user, Org org) =>
        (await user.GetOkAsync($"{org.Url}/wallet")).Int("balanceCents");

    [Fact]
    public async Task Public_slug_check_normalizes_names_and_rejects_taken_reserved_and_empty_slugs()
    {
        var admin = await _app.NewUserAsync("Slug owner");
        var takenName = $"Dance {Guid.NewGuid():N}";
        var taken = await admin.PostOkAsync("/api/orgs", new { name = takenName, description = "" });
        using var client = _app.CreateClient();

        var available = await client.GetOkAsync("/api/public/orgs/slug-availability?name=New%20Dance%20Club");
        Assert.True(available["available"]!.GetValue<bool>());
        Assert.Equal("new-dance-club", available.Str("slug"));

        var duplicate = await client.GetOkAsync($"/api/public/orgs/slug-availability?name={Uri.EscapeDataString(takenName)}");
        Assert.False(duplicate["available"]!.GetValue<bool>());
        Assert.Equal(taken.Str("slug"), duplicate.Str("slug"));

        var reserved = await client.GetOkAsync("/api/public/orgs/slug-availability?name=login");
        Assert.False(reserved["available"]!.GetValue<bool>());
        Assert.NotNull(reserved["reason"]);

        var emptySlug = await client.GetOkAsync("/api/public/orgs/slug-availability?name=%21%3F%23");
        Assert.False(emptySlug["available"]!.GetValue<bool>());
    }

    [Fact]
    public async Task Public_organisation_and_event_reads_show_only_public_information()
    {
        var org = await NewOrgAsync();
        var (eventId, _) = await NewEventAsync(org, priceCents: 1200, capacity: 40);
        await org.Admin.PostOkAsync($"{org.Url}/admin/events", new
        {
            name = "Draft event", description = "Not public", location = "Back room", startsAt = DateTime.UtcNow.AddDays(8), published = false,
        });
        using var visitor = _app.CreateClient();

        var publicOrg = await visitor.GetOkAsync($"/api/public/orgs/{org.Slug}");
        Assert.Equal(org.Slug, publicOrg.Str("slug"));
        Assert.False(publicOrg.AsObject().ContainsKey("membership"));
        Assert.False(publicOrg.AsObject().ContainsKey("balanceCents"));
        Assert.Equal("Party", Assert.Single(publicOrg["events"]!.AsArray())!.Str("name"));

        var publicEvent = await visitor.GetOkAsync($"/api/public/orgs/{org.Slug}/events/{eventId}");
        Assert.Equal("Party", publicEvent.Str("name"));
        Assert.False(publicEvent["ticketTypes"]![0]!.AsObject().ContainsKey("owned"));
        Assert.False(publicEvent["ticketTypes"]![0]!.AsObject().ContainsKey("allowedForYou"));
        Assert.Equal(1200, publicEvent["ticketTypes"]![0]!.Int("priceCents"));
    }

    [Fact]
    public async Task Registration_creates_the_user_and_first_organisation_with_admin_membership()
    {
        using var client = _app.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"founder-{Guid.NewGuid():N}@example.com", password = "correct horse", acceptTerms = true, displayName = "Founder",
            organisationName = "Moonlight Society",
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var created = JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
        Assert.Equal("moonlight-society", created.Str("organisationSlug"));

        var org = await client.GetOkAsync("/api/orgs/moonlight-society");
        Assert.Equal("Admin", org["membership"]!.Str("role"));
        Assert.Equal("Member", org["membership"]!.Str("tier"));
        Assert.Equal(0, org.Int("balanceCents"));
    }

    [Fact]
    public async Task Registration_requires_accepting_the_terms_and_privacy_policy()
    {
        var org = await NewOrgAsync();
        using var client = _app.CreateClient();
        var email = $"terms-{Guid.NewGuid():N}@example.com";

        var member = await client.PostAsJsonAsync("/api/auth/register", new { email, password = "correct horse", joinOrganisationSlug = org.Slug });
        Assert.Equal(HttpStatusCode.BadRequest, member.StatusCode);
        Assert.Contains("terms of service", await member.Content.ReadAsStringAsync());
        var organiser = await client.PostAsJsonAsync("/api/auth/register",
            new { email, password = "correct horse", acceptTerms = false, displayName = "Founder", organisationName = $"Terms {Guid.NewGuid():N}"[..20] });
        Assert.Equal(HttpStatusCode.BadRequest, organiser.StatusCode);

        // Nothing was created: the same address can still sign up once the terms are accepted.
        (await client.PostAsJsonAsync("/api/auth/register",
            new { email, password = "correct horse", acceptTerms = true, joinOrganisationSlug = org.Slug })).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Members_see_every_membership_they_had_newest_first()
    {
        var org = await NewOrgAsync();
        var fan = (await org.Admin.PostOkAsync($"{org.Url}/admin/tiers", new { name = "Fan", priceCents = 0, isPublic = true })).Str("id");
        var guest = await _app.NewGuestAsync(org.Slug, "Hilde");
        Assert.Empty((await guest.GetOkAsync($"{org.Url}/me/memberships")).AsArray());

        await guest.PostOkAsync($"{org.Url}/join", new { tierId = org.FreeTierId });
        await guest.PostOkAsync($"{org.Url}/join", new { tierId = fan });

        var history = (await guest.GetOkAsync($"{org.Url}/me/memberships")).AsArray();
        Assert.Equal(["Fan", "Member"], history.Select(p => p!.Str("tierName")));
        Assert.True(history[0]!["current"]!.GetValue<bool>());
        Assert.False(history[1]!["current"]!.GetValue<bool>());

        var member = (await org.Admin.GetOkAsync($"{org.Url}/admin/members")).AsArray().Single(m => m!.Str("displayName").StartsWith("Hilde"))!;

        // An admin ending the membership closes the running period rather than adding one.
        (await org.Admin.PutAsJsonAsync($"{org.Url}/admin/members/{member.Str("id")}",
            new { role = "Member", tierId = fan, expiresAt = DateTime.UtcNow.AddMinutes(-1) })).EnsureSuccessStatusCode();
        history = (await guest.GetOkAsync($"{org.Url}/me/memberships")).AsArray();
        Assert.Equal(2, history.Count);
        Assert.False(history[0]!["current"]!.GetValue<bool>());
    }

    [Fact]
    public async Task Staff_and_admins_look_members_up_by_name_or_card_and_see_their_details_and_history()
    {
        var org = await NewOrgAsync();
        var fan = (await org.Admin.PostOkAsync($"{org.Url}/admin/tiers", new { name = "Fan", priceCents = 0, isPublic = true })).Str("id");
        var guest = await _app.NewGuestAsync(org.Slug, "Ingrid");
        await guest.PostOkAsync($"{org.Url}/join", new { tierId = org.FreeTierId });
        await guest.PostOkAsync($"{org.Url}/join", new { tierId = fan });
        var card = await LinkCardAsync(guest, org);

        // By name, in any case; a typed % is just a character, not "everyone".
        var found = (await org.Admin.GetOkAsync($"{org.Url}/staff/members?search=ingRID")).AsArray();
        var id = Assert.Single(found)!.Str("id");
        Assert.Empty((await org.Admin.GetOkAsync($"{org.Url}/staff/members?search=%25")).AsArray());
        // By card: checking it says which member it is.
        Assert.Equal(id, (await org.Admin.PostOkAsync($"{org.Url}/staff/lookup", new { cardUid = card })).Str("memberId"));

        var details = await org.Admin.GetOkAsync($"{org.Url}/staff/members/{id}");
        Assert.Equal("Ingrid", details.Str("firstName"));
        Assert.Equal("Fan", details.Str("tier"));
        Assert.Single(details["cards"]!.AsArray());
        Assert.Equal(["Fan", "Member"], details["history"]!.AsArray().Select(p => p!.Str("tierName")));

        Assert.Equal("Optional", details["fields"]!.Str("phone"));
        Assert.Equal("Ingrid", details["profile"]!.Str("firstName"));

        // Admins can correct the details, with the same checks as the member's own form; nobody else can.
        var corrected = new { firstName = "Ingrid", lastName = "Peeters", phone = "0470 12 34 56" };
        (await org.Admin.PutAsJsonAsync($"{org.Url}/admin/members/{id}/profile", corrected)).EnsureSuccessStatusCode();
        details = await org.Admin.GetOkAsync($"{org.Url}/staff/members/{id}");
        Assert.Equal("Ingrid Peeters", details.Str("displayName"));
        Assert.Equal("0470 12 34 56", details.Str("phone"));
        Assert.Equal(HttpStatusCode.BadRequest,
            (await org.Admin.PutAsJsonAsync($"{org.Url}/admin/members/{id}/profile", new { firstName = "", lastName = "" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await guest.PutAsJsonAsync($"{org.Url}/admin/members/{id}/profile", corrected)).StatusCode);

        // A barman checks cards but does not look into people's details; nor do members.
        var barman = await NewMemberAsync(org, "Bram");
        var bram = (await org.Admin.GetOkAsync($"{org.Url}/admin/members")).AsArray().Single(m => m!.Str("displayName").StartsWith("Bram"))!;
        (await org.Admin.PutAsJsonAsync($"{org.Url}/admin/members/{bram.Str("id")}",
            new { role = "Barman", tierId = bram.Str("tierId"), expiresAt = (DateTime?)null })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Forbidden, (await barman.GetAsync($"{org.Url}/staff/members/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await barman.GetAsync($"{org.Url}/staff/members?search=Ingrid")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await guest.GetAsync($"{org.Url}/staff/members/{id}")).StatusCode);
    }

    [Fact]
    public async Task Registration_rejects_taken_or_reserved_organisation_names_without_creating_an_account()
    {
        var admin = await _app.NewUserAsync("Existing owner");
        var name = $"Lantern {Guid.NewGuid():N}";
        await admin.PostOkAsync("/api/orgs", new { name, description = "" });
        using var client = _app.CreateClient();
        var email = $"blocked-{Guid.NewGuid():N}@example.com";
        var taken = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email, password = "correct horse", acceptTerms = true, displayName = "Blocked", organisationName = name,
        });
        Assert.Equal(HttpStatusCode.Conflict, taken.StatusCode);
        var takenLogin = await client.PostAsJsonAsync("/api/auth/login", new { email, password = "correct horse" });
        Assert.Equal(HttpStatusCode.Unauthorized, takenLogin.StatusCode);

        var reservedEmail = $"reserved-{Guid.NewGuid():N}@example.com";
        var reserved = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email = reservedEmail, password = "correct horse", acceptTerms = true, displayName = "Reserved", organisationName = "tickets",
        });
        Assert.Equal(HttpStatusCode.BadRequest, reserved.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.PostAsJsonAsync("/api/auth/login", new { email = reservedEmail, password = "correct horse" })).StatusCode);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("こんにちは")]
    [InlineData("?!#")]
    public async Task Registration_rejects_names_without_a_public_slug_before_creating_an_account(string organisationName)
    {
        using var client = _app.CreateClient();
        var email = $"invalid-{Guid.NewGuid():N}@example.com";
        var response = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email, password = "correct horse", acceptTerms = true, displayName = "Invalid name", organisationName,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.PostAsJsonAsync("/api/auth/login", new { email, password = "correct horse" })).StatusCode);
    }

    [Fact]
    public async Task Contextual_member_registration_creates_no_new_organisation_or_membership()
    {
        var org = await NewOrgAsync();
        using var admin = org.Admin;
        await admin.PostOkAsync($"{org.Url}/admin/tiers", new
        {
            name = "Supporter", priceCents = 2500, endsOn = MembershipDates.NextSummer, isPublic = true,
        });
        var orgsBefore = await admin.GetOkAsync("/api/orgs");
        using var visitor = _app.CreateClient();
        var response = await visitor.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"member-{Guid.NewGuid():N}@example.com", password = "correct horse", acceptTerms = true, displayName = "New member",
            joinOrganisationSlug = org.Slug,
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var created = JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
        Assert.Equal(org.Slug, created.Str("organisationSlug"));
        Assert.Null((await visitor.GetOkAsync(org.Url))["membership"]);
        Assert.Equal(orgsBefore.AsArray().Count, (await admin.GetOkAsync("/api/orgs")).AsArray().Count);
    }

    [Fact]
    public async Task Concurrent_registration_for_the_same_organisation_slug_returns_one_conflict()
    {
        using var firstClient = _app.CreateClient();
        using var secondClient = _app.CreateClient();
        var orgName = $"Shared {Guid.NewGuid():N}";
        var first = firstClient.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"first-{Guid.NewGuid():N}@example.com", password = "correct horse", acceptTerms = true, displayName = "First", organisationName = orgName,
        });
        var second = secondClient.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"second-{Guid.NewGuid():N}@example.com", password = "correct horse", acceptTerms = true, displayName = "Second", organisationName = orgName,
        });
        var responses = await Task.WhenAll(first, second);
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Guest_buys_a_ticket_online_and_gets_in_with_their_card()
    {
        var org = await NewOrgAsync();
        var (eventId, typeId) = await NewEventAsync(org, priceCents: 1200, capacity: 50);
        var guest = await NewMemberAsync(org);
        var card = await LinkCardAsync(guest, org);

        var order = await guest.PostOkAsync($"{org.Url}/events/{eventId}/order", new { items = new[] { new { ticketTypeId = typeId, quantity = 1 } } });
        Assert.Equal(1200, order.Int("totalCents"));
        Assert.Empty((await guest.GetOkAsync($"{org.Url}/me/tickets")).AsArray()); // not paid yet
        await guest.PayAsync(order);
        var ticket = Assert.Single((await guest.GetOkAsync($"{org.Url}/me/tickets")).AsArray())!;
        Assert.Equal("Valid", ticket.Str("status"));

        var checkedIn = await org.Admin.PostOkAsync($"{org.Url}/staff/checkin", new { eventId, cardUid = card });
        Assert.Equal("Guest Tester", checkedIn.Str("name"));
        var again = await org.Admin.PostAsJsonAsync($"{org.Url}/staff/checkin", new { eventId, cardUid = card });
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
    }

    [Fact]
    public async Task Doors_open_at_the_start_or_earlier_by_hand_and_a_closed_event_stops_check_ins_and_sales()
    {
        var org = await NewOrgAsync();
        var ev = await org.Admin.PostOkAsync($"{org.Url}/admin/events", new { name = "Open end", description = "", location = "Hall", startsAt = DateTime.UtcNow.AddHours(2), published = true });
        var eventId = ev.Str("id");
        var typeId = (await org.Admin.PostOkAsync($"{org.Url}/admin/events/{eventId}/ticket-types", new { name = "Regular", priceCents = 0, capacity = 10, maxPerUser = 10 })).Str("id");
        var guest = await NewMemberAsync(org);
        await guest.PostOkAsync($"{org.Url}/events/{eventId}/order", new { items = new[] { new { ticketTypeId = typeId, quantity = 2 } } });
        var code = (await guest.GetOkAsync($"{org.Url}/me/tickets"))[0]!.Str("code");

        // Two hours before the start the door says it isn't open yet.
        var early = await org.Admin.PostAsJsonAsync($"{org.Url}/staff/checkin", new { eventId, code });
        Assert.Equal(HttpStatusCode.Conflict, early.StatusCode);
        Assert.Contains("aren't open yet", await early.Content.ReadAsStringAsync());
        Assert.Equal("Upcoming", (await org.Admin.GetOkAsync($"{org.Url}/staff/context"))["events"]![0]!.Str("status"));

        // Opened early by hand: people get in.
        Assert.Equal("Open", (await org.Admin.PostOkAsync($"{org.Url}/staff/events/{eventId}/open", new { })).Str("status"));
        await org.Admin.PostOkAsync($"{org.Url}/staff/checkin", new { eventId, code });

        // Closed (it has no end time): no more check-ins, no more sales, and it leaves the lists.
        Assert.Equal("Closed", (await org.Admin.PostOkAsync($"{org.Url}/staff/events/{eventId}/close", new { })).Str("status"));
        var second = (await guest.GetOkAsync($"{org.Url}/me/tickets")).AsArray().First(t => t!.Str("status") == "Valid")!.Str("code");
        Assert.Equal(HttpStatusCode.Conflict, (await org.Admin.PostAsJsonAsync($"{org.Url}/staff/checkin", new { eventId, code = second })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await guest.PostAsJsonAsync($"{org.Url}/events/{eventId}/order", new { items = new[] { new { ticketTypeId = typeId, quantity = 1 } } })).StatusCode);
        Assert.Empty((await guest.GetOkAsync(org.Url))["events"]!.AsArray());
        Assert.Empty((await org.Admin.GetOkAsync($"{org.Url}/staff/context"))["events"]!.AsArray());
        Assert.Equal("Closed", (await org.Admin.GetOkAsync($"{org.Url}/admin/events"))[0]!.Str("status"));

        // Reopened, it works again.
        await org.Admin.PostOkAsync($"{org.Url}/staff/events/{eventId}/open", new { });
        await org.Admin.PostOkAsync($"{org.Url}/staff/checkin", new { eventId, code = second });
    }

    [Fact]
    public async Task Ticket_qr_code_checks_in_once_even_when_scanned_at_two_doors()
    {
        var org = await NewOrgAsync();
        var (eventId, typeId) = await NewEventAsync(org, priceCents: 0, capacity: 5);
        var guest = await NewMemberAsync(org);
        await guest.PostOkAsync($"{org.Url}/events/{eventId}/order", new { items = new[] { new { ticketTypeId = typeId, quantity = 1 } } });
        var code = (await guest.GetOkAsync($"{org.Url}/me/tickets"))[0]!.Str("code");

        var scans = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ =>
            org.Admin.PostAsJsonAsync($"{org.Url}/staff/checkin", new { eventId, code })));
        Assert.Equal(1, scans.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.Equal(7, scans.Count(r => r.StatusCode == HttpStatusCode.Conflict));
    }

    [Fact]
    public async Task Tickets_are_never_oversold_when_many_people_buy_at_once()
    {
        var org = await NewOrgAsync();
        var (eventId, typeId) = await NewEventAsync(org, priceCents: 0, capacity: 5);
        var guests = new List<HttpClient>();
        for (var i = 0; i < 12; i++) guests.Add(await NewMemberAsync(org, $"Guest{i}"));

        var orders = await Task.WhenAll(guests.Select(g =>
            g.PostAsJsonAsync($"{org.Url}/events/{eventId}/order", new { items = new[] { new { ticketTypeId = typeId, quantity = 1 } } })));
        Assert.Equal(5, orders.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.Equal(7, orders.Count(r => r.StatusCode == HttpStatusCode.Conflict));

        var events = await org.Admin.GetOkAsync($"{org.Url}/admin/events");
        Assert.Equal(5, events[0]!["ticketTypes"]![0]!.Int("sold"));
    }

    [Fact]
    public async Task Cancelled_checkout_puts_the_tickets_back_on_sale()
    {
        var org = await NewOrgAsync();
        var (eventId, typeId) = await NewEventAsync(org, priceCents: 1000, capacity: 1);
        var first = await NewMemberAsync(org);
        var second = await NewMemberAsync(org);
        var items = new { items = new[] { new { ticketTypeId = typeId, quantity = 1 } } };

        var order = await first.PostOkAsync($"{org.Url}/events/{eventId}/order", items);
        Assert.Equal(HttpStatusCode.Conflict, (await second.PostAsJsonAsync($"{org.Url}/events/{eventId}/order", items)).StatusCode);

        var paymentId = order.Str("checkoutUrl").Split('/').Last();
        (await first.PostAsync($"{org.Url}/payments/{paymentId}/test-cancel", null)).EnsureSuccessStatusCode();
        await second.PayAsync(await second.PostOkAsync($"{org.Url}/events/{eventId}/order", items));
        Assert.Single((await second.GetOkAsync($"{org.Url}/me/tickets")).AsArray());
        Assert.Empty((await first.GetOkAsync($"{org.Url}/me/tickets")).AsArray());
    }

    [Fact]
    public async Task Bar_charges_the_wallet_and_refuses_when_credit_runs_out()
    {
        var org = await NewOrgAsync();
        var beer = (await org.Admin.PostOkAsync($"{org.Url}/admin/products", new { name = "Beer", priceCents = 250, active = true })).Str("id");
        var guest = await NewMemberAsync(org);
        var card = await LinkCardAsync(guest, org);
        await TopUpAsync(guest, org, 1000);
        Assert.Equal(1000, await BalanceAsync(guest, org));

        var sale = await org.Admin.PostOkAsync($"{org.Url}/staff/charge", new { cardUid = card, items = new[] { new { productId = beer, quantity = 3 } } });
        Assert.Equal(750, sale.Int("totalCents"));
        Assert.Equal(250, sale.Int("balanceCents"));

        var tooMuch = await org.Admin.PostAsJsonAsync($"{org.Url}/staff/charge", new { cardUid = card, items = new[] { new { productId = beer, quantity = 2 } } });
        Assert.Equal(HttpStatusCode.PaymentRequired, tooMuch.StatusCode);
        Assert.Equal(250, await BalanceAsync(guest, org));
    }

    [Fact]
    public async Task Returned_cups_put_their_deposit_back_on_the_card()
    {
        var org = await NewOrgAsync();
        var beer = (await org.Admin.PostOkAsync($"{org.Url}/admin/products", new { name = "Beer", priceCents = 300, active = true })).Str("id");
        var cup = (await org.Admin.PostOkAsync($"{org.Url}/admin/products", new { name = "Cup", priceCents = 100, active = true, isDeposit = true })).Str("id");
        // A membership with a bar discount: it must apply to the beer but never to the deposit.
        var tier = (await org.Admin.PostOkAsync($"{org.Url}/admin/tiers", new { name = "Fan", priceCents = 0, isPublic = true, drinkDiscountPercent = 50 })).Str("id");
        var guest = await _app.NewGuestAsync(org.Slug);
        await guest.PostOkAsync($"{org.Url}/join", new { tierId = tier });
        var card = await LinkCardAsync(guest, org);
        await TopUpAsync(guest, org, 1000);

        // Two beers at half price (3,00) plus two cups at full deposit (2,00).
        var bought = await org.Admin.PostOkAsync($"{org.Url}/staff/charge", new { cardUid = card, items = new[] { new { productId = beer, quantity = 2 }, new { productId = cup, quantity = 2 } } });
        Assert.Equal(500, bought.Int("totalCents"));
        Assert.Equal(500, await BalanceAsync(guest, org));

        // Next round: one beer, one new cup, both old cups back. 1,50 + 1,00 - 2,00 = 0,50 to pay.
        var round = await org.Admin.PostOkAsync($"{org.Url}/staff/charge", new { cardUid = card, items = new[] { new { productId = beer, quantity = 1 }, new { productId = cup, quantity = 1 }, new { productId = cup, quantity = -2 } } });
        Assert.Equal(50, round.Int("totalCents"));

        // Going home: the last cup back gives the deposit back in full, and a retry does not pay it twice.
        var handBack = new { cardUid = card, requestId = Guid.NewGuid(), items = new[] { new { productId = cup, quantity = -1 } } };
        var returned = await org.Admin.PostOkAsync($"{org.Url}/staff/charge", handBack);
        Assert.Equal(-100, returned.Int("totalCents"));
        Assert.Equal(550, returned.Int("balanceCents"));
        await org.Admin.PostOkAsync($"{org.Url}/staff/charge", handBack);
        Assert.Equal(550, await BalanceAsync(guest, org));

        // The guest sees it in their history, and the bar's takings no longer count the returned deposits.
        var history = (await guest.GetOkAsync($"{org.Url}/wallet"))["transactions"]!.AsArray();
        Assert.Contains(history, t => t!.Str("type") == "Return" && t!.Int("amountCents") == 100 && t!.Str("description") == "1× Cup returned");
        Assert.Equal(450, (await org.Admin.GetOkAsync($"{org.Url}/admin/summary")).Int("barRevenueCents"));

        // Only deposits can come back: nobody gets credit for "returning" a beer.
        var beerBack = await org.Admin.PostAsJsonAsync($"{org.Url}/staff/charge", new { cardUid = card, items = new[] { new { productId = beer, quantity = -1 } } });
        Assert.Equal(HttpStatusCode.BadRequest, beerBack.StatusCode);
        Assert.Equal(550, await BalanceAsync(guest, org));
    }

    [Fact]
    public async Task Drinks_that_come_in_a_cup_charge_its_deposit_and_a_returned_cup_swaps_for_free()
    {
        var org = await NewOrgAsync();
        var cup = (await org.Admin.PostOkAsync($"{org.Url}/admin/products", new { name = "Cup", priceCents = 100, active = true, isDeposit = true })).Str("id");
        var beer = (await org.Admin.PostOkAsync($"{org.Url}/admin/products", new { name = "Beer", priceCents = 300, active = true, depositProductId = cup })).Str("id");
        var crisps = (await org.Admin.PostOkAsync($"{org.Url}/admin/products", new { name = "Crisps", priceCents = 200, active = true })).Str("id");
        var guest = await NewMemberAsync(org);
        var card = await LinkCardAsync(guest, org);
        await TopUpAsync(guest, org, 2000);

        // The phone only sends the beers and crisps: the server adds a cup per beer, none for the crisps.
        var first = await org.Admin.PostOkAsync($"{org.Url}/staff/charge", new { cardUid = card, items = new[] { new { productId = beer, quantity = 2 }, new { productId = crisps, quantity = 1 } } });
        Assert.Equal(1000, first.Int("totalCents"));
        Assert.Equal(200, first.Int("depositCents"));

        // Two empty cups back for two new beers: the deposits cancel out, only the beer is paid.
        var swap = await org.Admin.PostOkAsync($"{org.Url}/staff/charge", new { cardUid = card, items = new[] { new { productId = beer, quantity = 2 }, new { productId = cup, quantity = -2 } } });
        Assert.Equal(600, swap.Int("totalCents"));
        Assert.Equal(0, swap.Int("depositCents"));

        // Going home with one cup back.
        var back = await org.Admin.PostOkAsync($"{org.Url}/staff/charge", new { cardUid = card, items = new[] { new { productId = cup, quantity = -1 } } });
        Assert.Equal(-100, back.Int("totalCents"));
        Assert.Equal(500, back.Int("balanceCents"));

        var history = (await guest.GetOkAsync($"{org.Url}/wallet"))["transactions"]!.AsArray();
        Assert.Contains(history, t => t!.Str("description") == "2× Beer, 1× Crisps, 2× Cup deposit");
        Assert.Contains(history, t => t!.Str("description") == "2× Beer");

        // One cup is still out: its euro is held for the guest, not counted as takings.
        var summary = await org.Admin.GetOkAsync($"{org.Url}/admin/summary");
        Assert.Equal(1400, summary.Int("barRevenueCents"));
        Assert.Equal(100, summary.Int("depositsHeldCents"));
    }

    [Fact]
    public async Task A_drink_only_comes_with_a_real_deposit_and_a_deposit_in_use_stays_one()
    {
        var org = await NewOrgAsync();
        var crisps = (await org.Admin.PostOkAsync($"{org.Url}/admin/products", new { name = "Crisps", priceCents = 200, active = true })).Str("id");
        var notADeposit = await org.Admin.PostAsJsonAsync($"{org.Url}/admin/products", new { name = "Beer", priceCents = 300, active = true, depositProductId = crisps });
        Assert.Equal(HttpStatusCode.BadRequest, notADeposit.StatusCode);

        var cup = (await org.Admin.PostOkAsync($"{org.Url}/admin/products", new { name = "Cup", priceCents = 100, active = true, isDeposit = true })).Str("id");
        await org.Admin.PostOkAsync($"{org.Url}/admin/products", new { name = "Beer", priceCents = 300, active = true, depositProductId = cup });
        var stillUsed = await org.Admin.PutAsJsonAsync($"{org.Url}/admin/products/{cup}", new { name = "Cup", priceCents = 100, active = true, isDeposit = false });
        Assert.Equal(HttpStatusCode.Conflict, stillUsed.StatusCode);
    }

    [Fact]
    public async Task The_admin_orders_the_bar_menu_and_memberships_and_can_delete_items()
    {
        var org = await NewOrgAsync();
        async Task<string> Add(object product) => (await org.Admin.PostOkAsync($"{org.Url}/admin/products", product)).Str("id");
        var cup = await Add(new { name = "Cup", priceCents = 100, active = true, isDeposit = true });
        var beer = await Add(new { name = "Beer", priceCents = 300, active = true, depositProductId = cup });
        var cola = await Add(new { name = "Cola", priceCents = 250, active = true });

        (await org.Admin.PutAsJsonAsync($"{org.Url}/admin/products/order", new { ids = new[] { cola, beer, cup } })).EnsureSuccessStatusCode();
        var menu = (await org.Admin.GetOkAsync($"{org.Url}/staff/context"))["products"]!.AsArray().Select(p => p!.Str("name"));
        Assert.Equal(["Cola", "Beer", "Cup"], menu);

        // A cup that drinks still come with stays; an item nobody depends on can go.
        Assert.Equal(HttpStatusCode.Conflict, (await org.Admin.DeleteAsync($"{org.Url}/admin/products/{cup}")).StatusCode);
        (await org.Admin.DeleteAsync($"{org.Url}/admin/products/{cola}")).EnsureSuccessStatusCode();
        Assert.DoesNotContain((await org.Admin.GetOkAsync($"{org.Url}/admin/products")).AsArray(), p => p!.Str("name") == "Cola");

        // Memberships: a new one goes last, and the chosen order is what members see, not cheapest first.
        var gold = (await org.Admin.PostOkAsync($"{org.Url}/admin/tiers", new { name = "Gold", priceCents = 2500, isPublic = true })).Str("id");
        var silver = (await org.Admin.PostOkAsync($"{org.Url}/admin/tiers", new { name = "Silver", priceCents = 1000, isPublic = true })).Str("id");
        Assert.Equal("Silver", (await org.Admin.GetOkAsync($"{org.Url}/admin/tiers")).AsArray().Last()!.Str("name"));
        (await org.Admin.PutAsJsonAsync($"{org.Url}/admin/tiers/order", new { ids = new[] { gold, silver, org.FreeTierId } })).EnsureSuccessStatusCode();
        var shown = (await org.Admin.GetOkAsync($"{org.Url}")).AsObject()["tiers"]!.AsArray().Select(t => t!.Str("name"));
        Assert.Equal(["Gold", "Silver", "Member"], shown);

        var unknown = await org.Admin.PutAsJsonAsync($"{org.Url}/admin/tiers/order", new { ids = new[] { Guid.NewGuid() } });
        Assert.Equal(HttpStatusCode.Conflict, unknown.StatusCode);
    }

    [Fact]
    public async Task The_till_gets_categories_in_order_and_coloured_tiles()
    {
        var org = await NewOrgAsync();
        var beers = (await org.Admin.PostOkAsync($"{org.Url}/admin/categories", new { name = "Bier" })).Str("id");
        var softs = (await org.Admin.PostOkAsync($"{org.Url}/admin/categories", new { name = "Fris" })).Str("id");
        (await org.Admin.PutAsJsonAsync($"{org.Url}/admin/categories/order", new { ids = new[] { softs, beers } })).EnsureSuccessStatusCode();
        await org.Admin.PostOkAsync($"{org.Url}/admin/products", new { name = "Pils", priceCents = 250, active = true, categoryId = beers, color = "yellow" });
        await org.Admin.PostOkAsync($"{org.Url}/admin/products", new { name = "Cola", priceCents = 250, active = true, categoryId = softs, color = "red" });

        var till = await org.Admin.GetOkAsync($"{org.Url}/staff/context");
        Assert.Equal(["Fris", "Bier"], till["categories"]!.AsArray().Select(c => c!.Str("name")));
        var pils = till["products"]!.AsArray().Single(p => p!.Str("name") == "Pils")!;
        Assert.Equal(beers, pils.Str("categoryId"));
        Assert.Equal("yellow", pils.Str("color"));

        // Unknown colours and other organisations' categories are refused.
        Assert.Equal(HttpStatusCode.BadRequest, (await org.Admin.PostAsJsonAsync($"{org.Url}/admin/products", new { name = "X", priceCents = 1, active = true, color = "#ff0000" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await org.Admin.PostAsJsonAsync($"{org.Url}/admin/products", new { name = "X", priceCents = 1, active = true, categoryId = Guid.NewGuid() })).StatusCode);

        // Deleting a category keeps its items, now without a tab.
        (await org.Admin.DeleteAsync($"{org.Url}/admin/categories/{beers}")).EnsureSuccessStatusCode();
        till = await org.Admin.GetOkAsync($"{org.Url}/staff/context");
        Assert.Single(till["categories"]!.AsArray());
        Assert.Null(till["products"]!.AsArray().Single(p => p!.Str("name") == "Pils")!["categoryId"]);
    }

    [Fact]
    public async Task Organisations_sell_tokens_at_their_own_price_with_top_up_deals()
    {
        var org = await NewOrgAsync();
        // A typo that would give away far too much, and two deals at the same price, are refused.
        Assert.Equal(HttpStatusCode.BadRequest, (await org.Admin.PutAsJsonAsync($"{org.Url}/admin/topup-deals", new[] { new { priceCents = 500, tokensCents = 6000 } })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await org.Admin.PutAsJsonAsync($"{org.Url}/admin/topup-deals",
            new[] { new { priceCents = 500, tokensCents = 600 }, new { priceCents = 500, tokensCents = 700 } })).StatusCode);

        var saved = await org.Admin.PutAsJsonAsync($"{org.Url}/admin/topup-deals",
            new[] { new { priceCents = 500, tokensCents = 600 }, new { priceCents = 2000, tokensCents = 2500 } });
        saved.EnsureSuccessStatusCode();

        var guest = await NewMemberAsync(org);
        var deals = (await guest.GetOkAsync($"{org.Url}/wallet"))["deals"]!.AsArray();
        Assert.Equal([500, 2000], deals.Select(d => d!.Int("priceCents")));
        var fiveForSix = deals[0]!.Str("id");

        // Pay €5, get 6 tokens. The overview counts the €5 that came in.
        await guest.PayAsync(await guest.PostOkAsync($"{org.Url}/wallet/topup", new { amountCents = 0, dealId = fiveForSix }));
        Assert.Equal(600, await BalanceAsync(guest, org));
        Assert.Equal(500, (await org.Admin.GetOkAsync($"{org.Url}/admin/summary")).Int("onlineTopUpsCents"));

        // With deals on offer, an amount of your own is not allowed.
        var ownAmount = await guest.PostAsJsonAsync($"{org.Url}/wallet/topup", new { amountCents = 700 });
        Assert.Equal(HttpStatusCode.Conflict, ownAmount.StatusCode);
        Assert.Equal(600, await BalanceAsync(guest, org));

        // A deal taken away in the meantime can't be bought.
        await org.Admin.PutAsJsonAsync($"{org.Url}/admin/topup-deals", Array.Empty<object>());
        var gone = await guest.PostAsJsonAsync($"{org.Url}/wallet/topup", new { amountCents = 0, dealId = fiveForSix });
        Assert.Equal(HttpStatusCode.Conflict, gone.StatusCode);
        Assert.Empty((await guest.GetOkAsync($"{org.Url}/wallet"))["deals"]!.AsArray());

        // Without deals, any amount gives one token per euro again.
        await TopUpAsync(guest, org, 700);
        Assert.Equal(1300, await BalanceAsync(guest, org));
    }

    [Fact]
    public async Task Online_top_ups_start_at_five_euro_so_the_card_fee_stays_small()
    {
        var org = await NewOrgAsync();
        var guest = await NewMemberAsync(org);

        var tooSmall = await guest.PostAsJsonAsync($"{org.Url}/wallet/topup", new { amountCents = 499 });
        Assert.Equal(HttpStatusCode.BadRequest, tooSmall.StatusCode);
        Assert.Contains("5,00", await tooSmall.Content.ReadAsStringAsync());
        Assert.Equal(500, (await guest.GetOkAsync($"{org.Url}/wallet")).Int("minTopUpCents"));
        await guest.PostOkAsync($"{org.Url}/wallet/topup", new { amountCents = 500 });

        // Cash at the bar costs no card fee, so a couple of euro is fine there.
        var card = await LinkCardAsync(guest, org);
        await org.Admin.PostOkAsync($"{org.Url}/staff/topup", new { cardUid = card, amountCents = 200 });
    }

    [Fact]
    public async Task Barmen_work_the_bar_and_doormen_the_door_and_both_can_check_a_card()
    {
        var org = await NewOrgAsync();
        var beer = (await org.Admin.PostOkAsync($"{org.Url}/admin/products", new { name = "Beer", priceCents = 300, active = true })).Str("id");
        var (eventId, _) = await NewEventAsync(org, 1000, 100);
        var guest = await NewMemberAsync(org, "Gina");
        var card = await LinkCardAsync(guest, org);
        await TopUpAsync(guest, org, 1000);

        async Task<HttpClient> WithRole(string name, string role)
        {
            var client = await NewMemberAsync(org, name);
            var member = (await org.Admin.GetOkAsync($"{org.Url}/admin/members")).AsArray()
                .Single(m => m!.Str("displayName").StartsWith(name))!;
            (await org.Admin.PutAsJsonAsync($"{org.Url}/admin/members/{member.Str("id")}",
                new { role, tierId = member.Str("tierId"), expiresAt = (DateTime?)null })).EnsureSuccessStatusCode();
            return client;
        }
        var barman = await WithRole("Bart", "Barman");
        var doorman = await WithRole("Dora", "Doorman");
        var charge = new { cardUid = card, items = new[] { new { productId = beer, quantity = 1 } } };
        var checkIn = new { eventId, cardUid = card };
        var cash = new { cardUid = card, amountCents = 500 };

        Assert.Equal(["Bar", "CheckCard"], (await barman.GetOkAsync($"{org.Url}/staff/context"))["tasks"]!.AsArray().Select(t => t!.GetValue<string>()));
        await barman.PostOkAsync($"{org.Url}/staff/charge", charge);
        await barman.PostOkAsync($"{org.Url}/staff/lookup", new { cardUid = card });
        Assert.Equal(HttpStatusCode.Forbidden, (await barman.PostAsJsonAsync($"{org.Url}/staff/checkin", checkIn)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await barman.PostAsJsonAsync($"{org.Url}/staff/topup", cash)).StatusCode);

        Assert.Equal(["Door", "CheckCard"], (await doorman.GetOkAsync($"{org.Url}/staff/context"))["tasks"]!.AsArray().Select(t => t!.GetValue<string>()));
        await doorman.PostOkAsync($"{org.Url}/staff/lookup", new { cardUid = card });
        Assert.Equal(HttpStatusCode.Forbidden, (await doorman.PostAsJsonAsync($"{org.Url}/staff/charge", charge)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await doorman.PostAsJsonAsync($"{org.Url}/staff/topup", cash)).StatusCode);
        // No ticket for this guest: the door answers, so the doorman got past the role check.
        Assert.NotEqual(HttpStatusCode.Forbidden, (await doorman.PostAsJsonAsync($"{org.Url}/staff/checkin", checkIn)).StatusCode);

        // Neither of them manages anything.
        Assert.Equal(HttpStatusCode.Forbidden, (await barman.GetAsync($"{org.Url}/admin/products")).StatusCode);
        Assert.Equal(["Bar", "Door", "CashTopUp", "CheckCard", "MemberInfo"], (await org.Admin.GetOkAsync($"{org.Url}/staff/context"))["tasks"]!.AsArray().Select(t => t!.GetValue<string>()));
    }

    [Fact]
    public async Task Wallet_never_goes_negative_when_several_bars_charge_at_once()
    {
        var org = await NewOrgAsync();
        var beer = (await org.Admin.PostOkAsync($"{org.Url}/admin/products", new { name = "Beer", priceCents = 300, active = true })).Str("id");
        var guest = await NewMemberAsync(org);
        var card = await LinkCardAsync(guest, org);
        await TopUpAsync(guest, org, 1000);

        var sales = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ =>
            org.Admin.PostAsJsonAsync($"{org.Url}/staff/charge", new { cardUid = card, items = new[] { new { productId = beer, quantity = 1 } } })));
        Assert.Equal(3, sales.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.Equal(7, sales.Count(r => r.StatusCode == HttpStatusCode.PaymentRequired));
        Assert.Equal(100, await BalanceAsync(guest, org));
    }

    [Fact]
    public async Task A_sale_sent_twice_is_only_charged_once()
    {
        var org = await NewOrgAsync();
        var beer = (await org.Admin.PostOkAsync($"{org.Url}/admin/products", new { name = "Beer", priceCents = 300, active = true })).Str("id");
        var guest = await NewMemberAsync(org);
        var card = await LinkCardAsync(guest, org);
        await org.Admin.PostOkAsync($"{org.Url}/staff/topup", new { cardUid = card, amountCents = 1000 }); // cash at the door

        var sale = new { cardUid = card, requestId = Guid.NewGuid(), items = new[] { new { productId = beer, quantity = 1 } } };
        await org.Admin.PostOkAsync($"{org.Url}/staff/charge", sale);
        var repeat = await org.Admin.PostOkAsync($"{org.Url}/staff/charge", sale);
        Assert.True(repeat["alreadyProcessed"]!.GetValue<bool>());
        Assert.Equal(700, await BalanceAsync(guest, org));
    }

    [Fact]
    public async Task Paid_and_invite_only_memberships_give_their_benefits()
    {
        var org = await NewOrgAsync();
        var paid = (await org.Admin.PostOkAsync($"{org.Url}/admin/tiers", new
        {
            name = "Premium", priceCents = 2500, endsOn = MembershipDates.NextSummer, isPublic = true, ticketDiscountPercent = 50, drinkDiscountPercent = 20,
        })).Str("id");
        await org.Admin.PostOkAsync($"{org.Url}/admin/tiers", new { name = "Crew", priceCents = 0, isPublic = false, inviteCode = "CREW2026", ticketDiscountPercent = 100 });
        var (eventId, typeId) = await NewEventAsync(org, priceCents: 1000, capacity: 50);
        var items = new { items = new[] { new { ticketTypeId = typeId, quantity = 1 } } };

        // Paid: nothing changes until the payment goes through, then tickets are half price.
        var premium = await _app.NewGuestAsync(org.Slug, "Premium");
        var join = await premium.PostOkAsync($"{org.Url}/join", new { tierId = paid });
        Assert.Null((await premium.GetOkAsync(org.Url))["membership"]);
        await premium.PayAsync(join);
        var membership = (await premium.GetOkAsync(org.Url))["membership"]!;
        Assert.Equal("Premium", membership.Str("tier"));
        Assert.NotNull(membership["expiresAt"]);
        Assert.Equal(500, (await premium.PostOkAsync($"{org.Url}/events/{eventId}/order", items)).Int("totalCents"));

        // Invite-only: hidden, can't be joined by id, opens with the code, and gets in free.
        var crew = await _app.NewGuestAsync(org.Slug, "Crew");
        var visible = (await crew.GetOkAsync(org.Url))["tiers"]!.AsArray();
        Assert.DoesNotContain(visible, t => t!.Str("name") == "Crew");
        Assert.Equal(HttpStatusCode.BadRequest, (await crew.PostAsJsonAsync($"{org.Url}/join", new { tierId = Guid.Empty, inviteCode = "WRONG" })).StatusCode);
        await crew.PostOkAsync($"{org.Url}/join", new { tierId = Guid.Empty, inviteCode = "CREW2026" });
        var free = await crew.PostOkAsync($"{org.Url}/events/{eventId}/order", items);
        Assert.Equal(0, free.Int("totalCents"));
        Assert.Null(free["checkoutUrl"]);
    }

    [Fact]
    public async Task Members_only_tickets_and_wallet_payment()
    {
        var org = await NewOrgAsync();
        var vip = (await org.Admin.PostOkAsync($"{org.Url}/admin/tiers", new { name = "VIP", priceCents = 0, isPublic = true })).Str("id");
        var (eventId, typeId) = await NewEventAsync(org, priceCents: 800, capacity: 10, allowedTierIds: new[] { vip });
        var items = new { payWith = "wallet", items = new[] { new { ticketTypeId = typeId, quantity = 1 } } };

        var regular = await NewMemberAsync(org);
        Assert.Equal(HttpStatusCode.Forbidden, (await regular.PostAsJsonAsync($"{org.Url}/events/{eventId}/order", items)).StatusCode);

        var member = await _app.NewGuestAsync(org.Slug, "Vip");
        await member.PostOkAsync($"{org.Url}/join", new { tierId = vip });
        Assert.Equal(HttpStatusCode.PaymentRequired, (await member.PostAsJsonAsync($"{org.Url}/events/{eventId}/order", items)).StatusCode);
        await TopUpAsync(member, org, 1000);
        await member.PostOkAsync($"{org.Url}/events/{eventId}/order", items);
        Assert.Equal(200, await BalanceAsync(member, org));
        Assert.Single((await member.GetOkAsync($"{org.Url}/me/tickets")).AsArray());

        // The failed attempts above must not have used up any tickets.
        var events = await org.Admin.GetOkAsync($"{org.Url}/admin/events");
        Assert.Equal(1, events[0]!["ticketTypes"]![0]!.Int("sold"));
    }

    [Fact]
    public async Task Staff_areas_are_closed_to_guests_and_a_blocked_card_stops_working()
    {
        var org = await NewOrgAsync();
        var guest = await NewMemberAsync(org);
        var card = await LinkCardAsync(guest, org);

        Assert.Equal(HttpStatusCode.Forbidden, (await guest.GetAsync($"{org.Url}/admin/members")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await guest.PostAsJsonAsync($"{org.Url}/staff/topup", new { cardUid = card, amountCents = 5000 })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _app.CreateClient().GetAsync("/api/orgs")).StatusCode);

        var cardId = (await guest.GetOkAsync($"{org.Url}/me/cards"))[0]!.Str("id");
        (await guest.PutAsJsonAsync($"{org.Url}/me/cards/{cardId}/blocked", new { blocked = true })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Forbidden, (await org.Admin.PostAsJsonAsync($"{org.Url}/staff/lookup", new { cardUid = card })).StatusCode);
    }

    [Fact]
    public async Task The_same_person_at_two_organisations_has_two_separate_accounts()
    {
        var first = await NewOrgAsync();
        var second = await NewOrgAsync();
        var beer = (await second.Admin.PostOkAsync($"{second.Url}/admin/products", new { name = "Beer", priceCents = 100, active = true })).Str("id");
        var email = $"gijs-{Guid.NewGuid():N}@example.com";

        // Registering at the first organisation says nothing about the second.
        var atFirst = await _app.NewGuestAsync(first.Slug, "Gijs", email);
        await atFirst.PostOkAsync($"{first.Url}/join", new { tierId = first.FreeTierId });
        var card = await LinkCardAsync(atFirst, first);
        await TopUpAsync(atFirst, first, 2000);
        Assert.Equal(HttpStatusCode.Unauthorized, (await atFirst.GetAsync($"{second.Url}/wallet")).StatusCode);
        var login = await _app.CreateClient().PostAsJsonAsync("/api/auth/login", new { email, password = "correct horse", acceptTerms = true, organisationSlug = second.Slug });
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);

        // The same email address can sign up there too, and starts from nothing.
        var again = await atFirst.PostAsJsonAsync("/api/auth/register", new { email, password = "another password", acceptTerms = true, displayName = "Gijs", joinOrganisationSlug = second.Slug });
        Assert.True(again.IsSuccessStatusCode, await again.Content.ReadAsStringAsync());
        (await atFirst.PutAsJsonAsync($"{second.Url}/me/profile", new { firstName = "Gijs", lastName = "Jazz" })).EnsureSuccessStatusCode();
        await atFirst.PostOkAsync($"{second.Url}/join", new { tierId = second.FreeTierId });
        Assert.Equal(2000, await BalanceAsync(atFirst, first));
        Assert.Equal(0, await BalanceAsync(atFirst, second));
        Assert.Empty((await atFirst.GetOkAsync($"{second.Url}/me/cards")).AsArray());

        // The card linked at the first organisation is unknown at the second, until it is linked there as well.
        var charge = new { cardUid = card, items = new[] { new { productId = beer, quantity = 1 } } };
        Assert.Equal(HttpStatusCode.NotFound, (await second.Admin.PostAsJsonAsync($"{second.Url}/staff/charge", charge)).StatusCode);
        await LinkCardAsync(atFirst, second, card);
        Assert.Equal(HttpStatusCode.PaymentRequired, (await second.Admin.PostAsJsonAsync($"{second.Url}/staff/charge", charge)).StatusCode);

        // The browser is now signed in to both, with a different account at each.
        var me = await atFirst.GetOkAsync("/api/auth/me");
        var accounts = me["memberships"]!.AsArray();
        Assert.Equal(2, accounts.Count);
        Assert.NotEqual(accounts[0]!.Str("userId"), accounts[1]!.Str("userId"));
        Assert.False(me["isOwner"]!.GetValue<bool>());

        // Each password only works where it was chosen.
        var fresh = _app.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await fresh.PostAsJsonAsync("/api/auth/login", new { email, password = "another password", organisationSlug = first.Slug })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await fresh.PostAsJsonAsync("/api/auth/login", new { email, password = "another password", organisationSlug = second.Slug })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await fresh.GetAsync($"{first.Url}/wallet")).StatusCode);

        // Signing out of one organisation leaves the other signed in.
        (await atFirst.PostAsJsonAsync("/api/auth/logout", new { organisationSlug = second.Slug })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Unauthorized, (await atFirst.GetAsync($"{second.Url}/wallet")).StatusCode);
        Assert.Equal(2000, await BalanceAsync(atFirst, first));
    }

    [Fact]
    public async Task Each_organisation_keeps_its_data_in_its_own_database()
    {
        var first = await NewOrgAsync();
        var second = await NewOrgAsync();
        var (eventId, _) = await NewEventAsync(first, priceCents: 0, capacity: 5);
        var guest = await NewMemberAsync(first);

        // Nothing of the first organisation can be reached through the second, even with the right ids.
        Assert.Equal(HttpStatusCode.NotFound, (await second.Admin.GetAsync($"{second.Url}/events/{eventId}")).StatusCode);
        Assert.Single((await first.Admin.GetOkAsync($"{first.Url}/admin/events")).AsArray());
        Assert.Empty((await second.Admin.GetOkAsync($"{second.Url}/admin/events")).AsArray());
        var guestEmail = (await guest.GetOkAsync("/api/auth/me"))["memberships"]![0]!.Str("email");
        Assert.Contains((await first.Admin.GetOkAsync($"{first.Url}/admin/members")).AsArray(), m => m!.Str("email") == guestEmail);
        Assert.DoesNotContain((await second.Admin.GetOkAsync($"{second.Url}/admin/members")).AsArray(), m => m!.Str("email") == guestEmail);

        // On disk: one database file per organisation, and the guest's email address is in exactly one of them.
        var files = Directory.GetFiles(Path.Combine(_app.DataFolder, "organisations"), "*.db");
        var organisations = (await first.Admin.GetOkAsync("/api/orgs")).AsArray().Count;
        Assert.Equal(organisations, files.Length);
        Assert.Equal(1, files.Count(file => DatabaseContains(file, guestEmail)));
        Assert.False(DatabaseContains(Path.Combine(_app.DataFolder, "platform.db"), guestEmail));
    }

    private static bool DatabaseContains(string file, string email)
    {
        using var connection = new Microsoft.Data.Sqlite.SqliteConnection($"Data Source={file};Mode=ReadOnly;Pooling=False");
        connection.Open();
        using var tables = connection.CreateCommand();
        tables.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('Users', 'OwnerAccounts')";
        var names = new List<string>();
        using (var reader = tables.ExecuteReader()) while (reader.Read()) names.Add(reader.GetString(0));
        foreach (var table in names)
        {
            using var count = connection.CreateCommand();
            count.CommandText = $"SELECT COUNT(*) FROM \"{table}\" WHERE \"Email\" = $email";
            count.Parameters.AddWithValue("$email", email);
            if ((long)count.ExecuteScalar()! > 0) return true;
        }
        return false;
    }

    [Fact]
    public async Task Entering_an_email_tells_whether_there_is_an_account_at_that_organisation()
    {
        var first = await NewOrgAsync();
        var second = await NewOrgAsync();
        var email = $"gijs-{Guid.NewGuid():N}@example.com";
        await _app.NewGuestAsync(first.Slug, "Gijs", email);
        var visitor = _app.CreateClient();

        async Task<bool> ExistsAt(Org org, string address) =>
            (await visitor.PostOkAsync($"/api/public/orgs/{org.Slug}/account-check", new { email = address }))["exists"]!.GetValue<bool>();

        Assert.True(await ExistsAt(first, email));
        Assert.True(await ExistsAt(first, $"  {email.ToUpperInvariant()} "));
        // An account at one organisation is not an account at another.
        Assert.False(await ExistsAt(second, email));
        Assert.False(await ExistsAt(first, "nobody@example.com"));
        Assert.Equal(HttpStatusCode.BadRequest, (await visitor.PostAsJsonAsync($"/api/public/orgs/{first.Slug}/account-check", new { email = "not an address" })).StatusCode);
    }

    [Fact]
    public async Task One_owner_login_opens_every_organisation_they_created()
    {
        var email = $"olga-{Guid.NewGuid():N}@example.com";
        var owner = _app.CreateClient();
        var firstName = $"First {Guid.NewGuid():N}"[..20];
        var registered = await owner.PostOkAsync("/api/auth/register", new { email, password = "correct horse", acceptTerms = true, displayName = "Olga", organisationName = firstName });
        var first = $"/api/orgs/{registered.Str("organisationSlug")}";
        var second = $"/api/orgs/{(await owner.PostOkAsync("/api/orgs", new { name = $"Second {Guid.NewGuid():N}"[..20] })).Str("slug")}";
        await owner.PostOkAsync($"{first}/admin/products", new { name = "Beer", priceCents = 250, active = true });

        // A fresh browser signs in once, on the front page, and is an admin in both.
        var elsewhere = _app.CreateClient();
        await elsewhere.PostOkAsync("/api/auth/login", new { email, password = "correct horse" });
        var me = await elsewhere.GetOkAsync("/api/auth/me");
        Assert.True(me["isOwner"]!.GetValue<bool>());
        Assert.Equal(2, me["memberships"]!.AsArray().Count);
        Assert.All(me["memberships"]!.AsArray(), m => Assert.Equal("Admin", m!.Str("role")));
        Assert.Single((await elsewhere.GetOkAsync($"{first}/admin/products")).AsArray());
        Assert.Empty((await elsewhere.GetOkAsync($"{second}/admin/products")).AsArray());

        // Someone who only has a guest account cannot add organisations, and an owner's email is taken for sign-up.
        var guest = await _app.NewGuestAsync(first.Split('/').Last());
        Assert.Equal(HttpStatusCode.Forbidden, (await guest.PostAsJsonAsync("/api/orgs", new { name = "Sneaky" })).StatusCode);
        var twice = await _app.CreateClient().PostAsJsonAsync("/api/auth/register", new { email, password = "correct horse", acceptTerms = true, displayName = "Olga", organisationName = $"Third {Guid.NewGuid():N}"[..20] });
        Assert.Equal(HttpStatusCode.Conflict, twice.StatusCode);
    }

    [Fact]
    public async Task Admin_can_edit_tickets_but_not_below_what_is_sold()
    {
        var org = await NewOrgAsync();
        var (eventId, typeId) = await NewEventAsync(org, priceCents: 0, capacity: 5);
        var guest = await NewMemberAsync(org);
        await guest.PostOkAsync($"{org.Url}/events/{eventId}/order", new { items = new[] { new { ticketTypeId = typeId, quantity = 2 } } });

        var tooLow = await org.Admin.PutAsJsonAsync($"{org.Url}/admin/ticket-types/{typeId}", new { name = "Regular", priceCents = 0, capacity = 1, maxPerUser = 10 });
        Assert.Equal(HttpStatusCode.Conflict, tooLow.StatusCode);
        var ok = await org.Admin.PutAsJsonAsync($"{org.Url}/admin/ticket-types/{typeId}", new
        {
            name = "Early bird", priceCents = 500, capacity = 2, maxPerUser = 4, salesEndAt = DateTime.UtcNow.AddDays(1), allowedTierIds = new[] { org.FreeTierId },
        });
        Assert.Equal(HttpStatusCode.NoContent, ok.StatusCode);
        var type = (await org.Admin.GetOkAsync($"{org.Url}/admin/events"))[0]!["ticketTypes"]![0]!;
        Assert.Equal("Early bird", type.Str("name"));
        Assert.Equal(2, type.Int("sold"));
        Assert.Single(type["allowedTierIds"]!.AsArray());
        var detail = await guest.GetOkAsync($"{org.Url}/events/{eventId}");
        Assert.Equal(0, detail["ticketTypes"]![0]!.Int("available"));
    }
}

public class ImageAndSettingsTests : IClassFixture<TestApp>
{
    private readonly TestApp _app;
    public ImageAndSettingsTests(TestApp app) => _app = app;

    // The smallest valid PNG: one transparent pixel.
    private static readonly byte[] Png = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==");

    private static MultipartFormDataContent Upload(byte[] bytes, string fileName, string contentType)
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(contentType);
        return new MultipartFormDataContent { { file, "file", fileName } };
    }

    private async Task<(HttpClient Admin, string Url)> NewOrgAsync()
    {
        var admin = await _app.NewUserAsync("Admin");
        var created = await admin.PostOkAsync("/api/orgs", new { name = $"Club {Guid.NewGuid():N}"[..20], description = "" });
        return (admin, $"/api/orgs/{created.Str("slug")}");
    }

    [Fact]
    public async Task Admin_renames_the_organisation_and_gives_it_a_logo()
    {
        var (admin, url) = await NewOrgAsync();

        var response = await admin.PostAsync($"{url}/admin/images", Upload(Png, "logo.png", "image/png"));
        var uploaded = JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
        Assert.True(response.IsSuccessStatusCode, uploaded.ToJsonString());
        var saved = await admin.PutAsJsonAsync($"{url}/admin/organisation", new { name = "Renamed Club", description = "New words", logoKey = uploaded.Str("key") });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);

        // The page moves to the new name; the old address is gone.
        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync(url)).StatusCode);
        url = "/api/orgs/renamed-club";

        // The new name and logo show up everywhere straight away, cached lists included.
        var org = await admin.GetOkAsync(url);
        Assert.Equal("Renamed Club", org.Str("name"));
        Assert.Equal(uploaded.Str("url"), org.Str("logoUrl"));
        var listed = (await admin.GetOkAsync("/api/orgs")).AsArray().Single(o => o!.Str("name") == "Renamed Club")!;
        Assert.Equal(uploaded.Str("url"), listed.Str("logoUrl"));
        var me = await admin.GetOkAsync("/api/auth/me");
        Assert.Contains(me["memberships"]!.AsArray(), m => m!.Str("name") == "Renamed Club" && m!["logoUrl"] is not null);

        // Visitors who are not signed in see the logo on the public page too.
        var visitor = _app.CreateClient();
        var slug = url.Split('/').Last();
        Assert.Equal(uploaded.Str("url"), (await visitor.GetOkAsync($"/api/public/orgs/{slug}")).Str("logoUrl"));
        var picture = await visitor.GetAsync(uploaded.Str("url"));
        Assert.Equal("image/png", picture.Content.Headers.ContentType!.MediaType);
        Assert.Equal(Png, await picture.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task Renaming_keeps_page_addresses_unique_and_leaves_them_alone_otherwise()
    {
        var (first, firstUrl) = await NewOrgAsync();
        var (second, secondUrl) = await NewOrgAsync();
        var firstName = (await first.GetOkAsync(firstUrl)).Str("name");
        var secondName = (await second.GetOkAsync(secondUrl)).Str("name");

        // Taking another organisation's name, or a page of the site itself, is refused and changes nothing.
        Assert.Equal(HttpStatusCode.Conflict, (await second.PutAsJsonAsync($"{secondUrl}/admin/organisation", new { name = firstName })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await second.PutAsJsonAsync($"{secondUrl}/admin/organisation", new { name = "Tickets" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await second.PutAsJsonAsync($"{secondUrl}/admin/organisation", new { name = "?!" })).StatusCode);
        Assert.Equal(secondName, (await second.GetOkAsync(secondUrl)).Str("name"));

        // Changing only the description keeps the address exactly as it was.
        var saved = await second.PutAsJsonAsync($"{secondUrl}/admin/organisation", new { name = secondName, description = "Now with words" });
        Assert.Equal(secondUrl.Split('/').Last(), JsonNode.Parse(await saved.Content.ReadAsStringAsync())!.Str("slug"));

        // Members keep their membership and credit across a rename.
        var guest = await _app.NewGuestAsync(firstUrl.Split('/').Last());
        var tierId = (await guest.GetOkAsync(firstUrl))["tiers"]![0]!.Str("id");
        await guest.PostOkAsync($"{firstUrl}/join", new { tierId });
        var renamed = $"Moved {Guid.NewGuid():N}"[..18];
        var moved = JsonNode.Parse(await (await first.PutAsJsonAsync($"{firstUrl}/admin/organisation", new { name = renamed })).Content.ReadAsStringAsync())!.Str("slug");
        Assert.NotNull((await guest.GetOkAsync($"/api/orgs/{moved}"))["membership"]);
        Assert.Equal(0, (await guest.GetOkAsync($"/api/orgs/{moved}/wallet")).Int("balanceCents"));
    }

    [Fact]
    public async Task An_organisation_colours_its_pages_and_member_cards()
    {
        var (admin, url) = await NewOrgAsync();
        var slug = url.Split('/').Last();
        var name = (await admin.GetOkAsync(url)).Str("name");

        // Anything but a "#rrggbb" colour is refused and changes nothing.
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync($"{url}/admin/organisation", new { name, brandColor = "red" })).StatusCode);
        Assert.Null((await admin.GetOkAsync(url))["brandColor"]);
        // White text has to read on it: a pale yellow is refused.
        var pale = await admin.PutAsJsonAsync($"{url}/admin/organisation", new { name, brandColor = "#f5e663" });
        Assert.Equal(HttpStatusCode.BadRequest, pale.StatusCode);
        Assert.Contains("hard to read", await pale.Content.ReadAsStringAsync());

        await admin.PutAsJsonAsync($"{url}/admin/organisation", new { name, brandColor = "#9F1239" });
        Assert.Equal("#9f1239", (await admin.GetOkAsync($"{url}/admin/organisation")).Str("brandColor"));
        Assert.Equal("#9f1239", (await admin.GetOkAsync(url)).Str("brandColor"));
        // Visitors who have not signed in see the same colour on the public page.
        Assert.Equal("#9f1239", (await _app.CreateClient().GetOkAsync($"/api/public/orgs/{slug}")).Str("brandColor"));

        // Saving without a colour goes back to the house colour.
        await admin.PutAsJsonAsync($"{url}/admin/organisation", new { name });
        Assert.Null((await admin.GetOkAsync(url))["brandColor"]);
    }

    [Fact]
    public async Task Uploads_must_be_real_pictures_from_an_admin()
    {
        var (admin, url) = await NewOrgAsync();

        // A script wearing a picture's name and type is refused: only the content counts.
        var fake = await admin.PostAsync($"{url}/admin/images", Upload("<svg onload=alert(1)>"u8.ToArray(), "logo.png", "image/png"));
        Assert.Equal(HttpStatusCode.BadRequest, fake.StatusCode);

        var guest = await _app.NewGuestAsync(url.Split('/').Last());
        Assert.Equal(HttpStatusCode.Forbidden, (await guest.PostAsync($"{url}/admin/images", Upload(Png, "a.png", "image/png"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await guest.PutAsJsonAsync($"{url}/admin/organisation", new { name = "Hacked" })).StatusCode);

        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync("/api/images/orgs/..%2F..%2Fmytickets.db")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync($"/api/images/orgs/{Guid.Empty:N}/{Guid.Empty:N}.png")).StatusCode);
    }

    [Fact]
    public async Task One_organisation_cannot_use_another_organisations_picture()
    {
        var (first, firstUrl) = await NewOrgAsync();
        var (second, secondUrl) = await NewOrgAsync();
        var response = await first.PostAsync($"{firstUrl}/admin/images", Upload(Png, "logo.png", "image/png"));
        var key = JsonNode.Parse(await response.Content.ReadAsStringAsync())!.Str("key");

        var stolen = await second.PutAsJsonAsync($"{secondUrl}/admin/organisation", new { name = "Second", logoKey = key });
        Assert.Equal(HttpStatusCode.BadRequest, stolen.StatusCode);
        var onEvent = await second.PostAsJsonAsync($"{secondUrl}/admin/events", new { name = "Party", startsAt = DateTime.UtcNow.AddDays(3), imageKey = key });
        Assert.Equal(HttpStatusCode.BadRequest, onEvent.StatusCode);

        var own = await first.PostOkAsync($"{firstUrl}/admin/events", new { name = "Party", startsAt = DateTime.UtcNow.AddDays(3), published = true, imageKey = key });
        var shown = await first.GetOkAsync($"{firstUrl}/events/{own.Str("id")}");
        Assert.Equal($"/api/images/{key}", shown.Str("imageUrl"));
    }
}
