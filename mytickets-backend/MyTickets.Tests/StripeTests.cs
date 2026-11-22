using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MyTickets.Api.Data;
using MyTickets.Api.Services;

namespace MyTickets.Tests;

/// <summary>An organisation set up for selling: its admin, address, id, one free membership type and one event.</summary>
public record ShopSetup(HttpClient Admin, string Slug, Guid OrganisationId, string TierId, string EventId, string TicketTypeId)
{
    public string Url => $"/api/orgs/{Slug}";
}

public static class Shops
{
    public static async Task<ShopSetup> NewShopAsync(this TestApp app, int priceCents = 1250, int capacity = 10)
    {
        var admin = await app.NewUserAsync("Admin");
        var slug = (await admin.GetOkAsync("/api/auth/me"))["memberships"]![0]!.Str("slug");
        var url = $"/api/orgs/{slug}";
        var tierId = (await admin.GetOkAsync(url))["tiers"]![0]!.Str("id");
        var ev = await admin.PostOkAsync($"{url}/admin/events", new { name = "Party", startsAt = DateTime.UtcNow.AddDays(7), published = true });
        var type = await admin.PostOkAsync($"{url}/admin/events/{ev.Str("id")}/ticket-types", new { name = "Regular", priceCents, capacity, maxPerUser = 10 });
        Organisation organisation;
        using (var scope = app.Services.CreateScope())
            organisation = (await scope.ServiceProvider.GetRequiredService<AppCache>().OrganisationBySlugAsync(slug))!;
        return new ShopSetup(admin, slug, organisation.Id, tierId, ev.Str("id"), type.Str("id"));
    }

    public static async Task<HttpClient> NewBuyerAsync(this TestApp app, ShopSetup shop)
    {
        var buyer = await app.NewGuestAsync(shop.Slug);
        await buyer.PostOkAsync($"{shop.Url}/join", new { tierId = shop.TierId });
        return buyer;
    }

    public static Task<HttpResponseMessage> OrderAsync(this HttpClient buyer, ShopSetup shop, int quantity = 1) =>
        buyer.PostAsJsonAsync($"{shop.Url}/events/{shop.EventId}/order",
            new { items = new[] { new { ticketTypeId = shop.TicketTypeId, quantity } }, payWith = "online" });

    public static async Task<int> SoldAsync(this ShopSetup shop) =>
        (await shop.Admin.GetOkAsync($"{shop.Url}/admin/events"))[0]!["ticketTypes"]![0]!.Int("sold");
}

public class StripeTests : IClassFixture<StripeTestApp>
{
    private readonly StripeTestApp _app;
    public StripeTests(StripeTestApp app) => _app = app;

    private FakeStripe Stripe => _app.Stripe;

    /// <summary>An organisation that has signed up with Stripe and been approved.</summary>
    private async Task<ShopSetup> PayingShopAsync(int capacity = 10)
    {
        var shop = await _app.NewShopAsync(capacity: capacity);
        await shop.Admin.PostOkAsync($"{shop.Url}/admin/payouts/onboarding", new { });
        Stripe.Approve(Stripe.LastAccountId);
        Assert.Equal("active", (await shop.Admin.GetOkAsync($"{shop.Url}/admin/payouts")).Str("status"));
        return shop;
    }

    private Task<HttpResponseMessage> StripeSendsAsync(HttpRequestMessage webhook) => _app.CreateClient().SendAsync(webhook);

    [Fact]
    public async Task An_organisation_signs_up_on_Stripe_and_is_ready_once_Stripe_approves()
    {
        var shop = await _app.NewShopAsync();
        var member = await _app.NewBuyerAsync(shop);
        Assert.Equal("not-started", (await shop.Admin.GetOkAsync($"{shop.Url}/admin/payouts")).Str("status"));
        Assert.Equal(HttpStatusCode.Forbidden, (await member.PostAsJsonAsync($"{shop.Url}/admin/payouts/onboarding", new { })).StatusCode);

        var started = await shop.Admin.PostOkAsync($"{shop.Url}/admin/payouts/onboarding", new { });
        var accountId = Stripe.LastAccountId;
        Assert.Equal($"https://connect.stripe.com/setup/e/{accountId}", started.Str("url"));
        var request = Stripe.Accounts[accountId].Request;
        // Created with Accounts v2: an Express dashboard, in Belgium, the platform paying Stripe's fees.
        Assert.Equal("express", request["dashboard"]);
        Assert.Equal("be", request["identity.country"]);
        Assert.Equal("application", request["defaults.responsibilities.fees_collector"]);
        Assert.Equal("true", request["configuration.merchant.capabilities.bancontact_payments.requested"]);
        Assert.Equal("true", request["configuration.recipient.capabilities.stripe_balance.stripe_transfers.requested"]);
        Assert.Equal(shop.OrganisationId.ToString(), request["metadata.organisationId"]);

        // Halfway: Stripe still needs details, and buyers can't pay online yet.
        var status = await shop.Admin.GetOkAsync($"{shop.Url}/admin/payouts");
        Assert.Equal("incomplete", status.Str("status"));
        Assert.Equal(2, status.Int("requirementsDue"));
        var buyer = await _app.NewBuyerAsync(shop);
        var order = await buyer.OrderAsync(shop);
        Assert.Equal(HttpStatusCode.Conflict, order.StatusCode);
        Assert.Contains("can't take online payments yet", await order.Content.ReadAsStringAsync());
        Assert.Equal(0, await shop.SoldAsync());

        // Coming back to finish signing up uses the same Stripe account, not a second one.
        await shop.Admin.PostOkAsync($"{shop.Url}/admin/payouts/onboarding", new { });
        Assert.Equal(accountId, Stripe.LastAccountId);

        Stripe.Approve(accountId);
        Assert.Equal("active", (await shop.Admin.GetOkAsync($"{shop.Url}/admin/payouts")).Str("status"));
        Assert.Equal($"https://connect.stripe.com/express/{accountId}", (await shop.Admin.PostOkAsync($"{shop.Url}/admin/payouts/dashboard", new { })).Str("url"));
    }

    [Fact]
    public async Task A_top_up_paid_on_Stripe_goes_to_the_organisation_and_is_credited_once()
    {
        var shop = await PayingShopAsync();
        var buyer = await _app.NewBuyerAsync(shop);
        var accountId = Stripe.LastAccountId;

        var started = await buyer.PostOkAsync($"{shop.Url}/wallet/topup", new { amountCents = 1250 });
        var sessionId = Stripe.LastSessionId;
        var request = Stripe.Sessions[sessionId].Request;
        var paymentId = Guid.Parse(request["metadata[paymentId]"]);

        Assert.Equal($"https://checkout.stripe.com/c/pay/{sessionId}", started.Str("checkoutUrl"));
        Assert.Equal("1250", request["line_items[0][price_data][unit_amount]"]);
        Assert.Equal("eur", request["line_items[0][price_data][currency]"]);
        // The organisation is the seller; its money is passed on after payment, once Stripe's cost is known.
        Assert.Equal(accountId, request["payment_intent_data[on_behalf_of]"]);
        Assert.Equal(paymentId.ToString(), request["payment_intent_data[transfer_group]"]);
        Assert.False(request.ContainsKey("payment_intent_data[application_fee_amount]"));
        Assert.Equal($"https://tickets.example.org/{shop.Slug}/checkout/{paymentId}", request["success_url"]);
        Assert.Equal($"https://tickets.example.org/{shop.Slug}/checkout/{paymentId}?cancelled=1", request["cancel_url"]);

        // Stripe reports while the buyer is still on its page: nothing yet.
        Assert.Equal(HttpStatusCode.OK, (await StripeSendsAsync(FakeStripe.Webhook("checkout.session.completed", sessionId, shop.OrganisationId))).StatusCode);
        Assert.Equal(0, (await buyer.GetOkAsync($"{shop.Url}/wallet")).Int("balanceCents"));

        // Paid: credited. Stripe sending the event again does not credit twice.
        Stripe.Pay(sessionId);
        await StripeSendsAsync(FakeStripe.Webhook("checkout.session.completed", sessionId, shop.OrganisationId));
        await StripeSendsAsync(FakeStripe.Webhook("checkout.session.completed", sessionId, shop.OrganisationId));
        Assert.Equal(1250, (await buyer.GetOkAsync($"{shop.Url}/wallet")).Int("balanceCents"));
        Assert.Equal("Paid", (await buyer.GetOkAsync($"{shop.Url}/payments/{paymentId}")).Str("status"));

        // And passed on to the organisation exactly once: €12.50 minus 5% (€0.62, more than Stripe's €0.55 + €0.05),
        // minus €2.53 set aside for Stripe's payout costs: the €2.50 buffer, and 0.25% of the €11.88 (€0.03).
        var transfer = Assert.Single(Stripe.Transfers.Values, t => t["metadata[paymentId]"] == paymentId.ToString());
        Assert.Equal("935", transfer["amount"]);
        Assert.Equal(accountId, transfer["destination"]);
        Assert.Equal($"ch_{sessionId}", transfer["source_transaction"]);

        // The admin overview shows it line by line: paid, MyTickets' fee, set aside for payout costs, and what was sent on.
        var summary = await shop.Admin.GetOkAsync($"{shop.Url}/admin/summary");
        var topUps = summary["sources"]!.AsArray().Single(s => s!.Str("purpose") == "TopUp")!;
        Assert.Equal([1250, 62, 253, 935], new[] { "paidCents", "feeCents", "payoutFeeCents", "netCents" }.Select(topUps.Int));
        Assert.Equal(0, summary["sources"]!.AsArray().Single(s => s!.Str("purpose") == "Tickets")!.Int("paidCents"));
        Assert.Equal(935, summary["payout"]!.Int("youGetCents"));
        Assert.Equal(253, summary["bankPayouts"]!.Int("bufferCents"));
        var line = Assert.Single(summary["payments"]!.AsArray())!;
        Assert.Equal((false, 935), (line["test"]!.GetValue<bool>(), line.Int("netCents")));
    }

    [Fact]
    public async Task The_platform_never_pays_more_to_Stripe_than_it_keeps()
    {
        var shop = await PayingShopAsync();
        var accountId = Stripe.LastAccountId;
        var buyer = await _app.NewBuyerAsync(shop);
        // A €12.50 top-up paid with an expensive (say, non-European) card: Stripe charges €0.90, more than 5%.
        await buyer.PostOkAsync($"{shop.Url}/wallet/topup", new { amountCents = 1250 });
        var sessionId = Stripe.LastSessionId;
        var paymentId = Guid.Parse(Stripe.Sessions[sessionId].Request["metadata[paymentId]"]);
        Stripe.NextStripeFeeCents = 90;
        try
        {
            Stripe.Pay(sessionId);
            await buyer.PostOkAsync($"{shop.Url}/payments/{paymentId}/refresh", new { });
        }
        finally
        {
            Stripe.NextStripeFeeCents = 55;
        }

        // The platform keeps €0.95: Stripe's €0.90 plus €0.05. The organisation gets the rest, minus the payout buffer (€2.53).
        Assert.Equal("902", Stripe.TransferFor(paymentId)!["amount"]);
        Assert.Equal(accountId, Stripe.TransferFor(paymentId)!["destination"]);
    }

    [Fact]
    public async Task If_passing_the_money_on_fails_the_buyer_still_gets_their_tickets_and_it_is_retried()
    {
        var shop = await PayingShopAsync();
        var buyer = await _app.NewBuyerAsync(shop);
        (await buyer.OrderAsync(shop)).EnsureSuccessStatusCode();
        var sessionId = Stripe.LastSessionId;
        var paymentId = Guid.Parse(Stripe.Sessions[sessionId].Request["metadata[paymentId]"]);
        Stripe.Pay(sessionId);
        Stripe.FailTransfers = true;
        try
        {
            Assert.Equal("Paid", (await buyer.PostOkAsync($"{shop.Url}/payments/{paymentId}/refresh", new { })).Str("status"));
            Assert.Single((await buyer.GetOkAsync($"{shop.Url}/me/tickets")).AsArray());
            Assert.Null(Stripe.TransferFor(paymentId));
        }
        finally
        {
            Stripe.FailTransfers = false;
        }

        // The payment and its "pass it on" event were saved together; the failed try is on the event, to retry later.
        var waiting = Assert.Single(await OutboxAsync(shop.Slug));
        Assert.Equal((OutboxEvents.PaymentCompleted, 1, (DateTime?)null), (waiting.Type, waiting.Attempts, waiting.ProcessedAt));
        Assert.NotNull(waiting.LastError);
        Assert.True(waiting.NextAttemptAt > DateTime.UtcNow);

        // The background tidy-up passes it on, once, even when run again.
        await TidyUpAsync(shop.Slug);
        await TidyUpAsync(shop.Slug);
        Assert.Equal("935", Stripe.TransferFor(paymentId)!["amount"]);
        var done = Assert.Single(await OutboxAsync(shop.Slug));
        Assert.Equal((2, (string?)null), (done.Attempts, done.LastError));
        Assert.NotNull(done.ProcessedAt);
    }

    [Fact]
    public async Task Payout_costs_too_big_for_one_payment_come_off_the_next_ones_and_nothing_is_sent_for_nothing()
    {
        // €1 tickets: Stripe's €0.55 plus €0.05 leaves €0.40 per ticket.
        var shop = await _app.NewShopAsync(priceCents: 100, capacity: 20);
        await shop.Admin.PostOkAsync($"{shop.Url}/admin/payouts/onboarding", new { });
        Stripe.Approve(Stripe.LastAccountId);
        // Looking at Payouts picks up that Stripe approved it.
        await shop.Admin.GetOkAsync($"{shop.Url}/admin/payouts");
        await RecordPayoutsAsync(shop.Slug);
        // A €10 payout, the first this month: €0.13 fee plus the month's €2 = €2.13 owed.
        Stripe.PayOut(Stripe.LastAccountId, 1_000);
        Assert.Equal(1, await RecordPayoutsAsync(shop.Slug));

        async Task<Guid> BuyAsync()
        {
            var buyer = await _app.NewBuyerAsync(shop);
            (await buyer.OrderAsync(shop)).EnsureSuccessStatusCode();
            var paymentId = Guid.Parse(Stripe.Sessions[Stripe.LastSessionId].Request["metadata[paymentId]"]);
            Stripe.Pay(Stripe.LastSessionId);
            await buyer.PostOkAsync($"{shop.Url}/payments/{paymentId}/refresh", new { });
            return paymentId;
        }

        // Eleven tickets' €0.40 each go to the €2.13, then to the €2.50 buffer for the next payouts: nothing is sent
        // for them (Stripe refuses €0 anyway).
        for (var i = 0; i < 11; i++) Assert.Null(Stripe.TransferFor(await BuyAsync()));
        // The twelfth fills the buffer (€0.23, plus a cent for Stripe's 0.25%) and the organisation gets the rest;
        // after that, all of it but that cent.
        Assert.Equal("16", Stripe.TransferFor(await BuyAsync())!["amount"]);
        Assert.Equal("40", Stripe.TransferFor(await BuyAsync())!["amount"]);
    }

    [Fact]
    public async Task The_organisation_pays_Stripe_s_fee_on_each_payout_to_its_bank_from_its_next_money()
    {
        var shop = await PayingShopAsync();
        var accountId = Stripe.LastAccountId;
        // A payout from before payout fees were passed on: the platform's to pay, as agreed then.
        Stripe.PayOut(accountId, 50_000, DateTimeOffset.UtcNow.AddDays(-1));
        Assert.Equal(0, await RecordPayoutsAsync(shop.Slug));
        Assert.Equal(0, await RecordPayoutsAsync(shop.Slug));

        // Stripe pays €100 out to the bank: 0.25% (€0.25) + €0.10, and €2 as the first payout this month.
        // Looking again does not count it twice; a second payout this month costs only its own fee.
        Stripe.PayOut(accountId, 10_000);
        Assert.Equal(1, await RecordPayoutsAsync(shop.Slug));
        Assert.Equal(0, await RecordPayoutsAsync(shop.Slug));
        Stripe.PayOut(accountId, 2_000, DateTimeOffset.UtcNow.AddMinutes(1));
        Assert.Equal(1, await RecordPayoutsAsync(shop.Slug));

        // The next top-up: €12.50 minus MyTickets' €0.62, the payout costs so far (€0.35 + €2 + €0.15), and the buffer
        // for the next ones (€2.50, plus 0.25% of this money: €0.03).
        var buyer = await _app.NewBuyerAsync(shop);
        await buyer.PostOkAsync($"{shop.Url}/wallet/topup", new { amountCents = 1250 });
        var paymentId = Guid.Parse(Stripe.Sessions[Stripe.LastSessionId].Request["metadata[paymentId]"]);
        Stripe.Pay(Stripe.LastSessionId);
        await buyer.PostOkAsync($"{shop.Url}/payments/{paymentId}/refresh", new { });
        Assert.Equal("685", Stripe.TransferFor(paymentId)!["amount"]);

        var summary = await shop.Admin.GetOkAsync($"{shop.Url}/admin/summary");
        Assert.Equal(503, summary["payout"]!.Int("payoutFeeCents"));
        Assert.Equal(253, summary["bankPayouts"]!.Int("bufferCents"));
        var payouts = summary["bankPayouts"]!["payouts"]!.AsArray();
        Assert.Equal([(2_000, 15, 0), (10_000, 35, 200)], payouts.Select(p => (p!.Int("amountCents"), p!.Int("feeCents"), p!.Int("accountFeeCents"))));
        Assert.Equal(250, summary["bankPayouts"]!.Int("feeCents"));
        Assert.Equal(0, summary["bankPayouts"]!.Int("owedCents"));
    }

    [Fact]
    public void Stripe_s_payout_fee_is_a_quarter_percent_rounded_up_plus_ten_cents_and_more_for_instant_payouts()
    {
        var rules = new FeeRules(5m, 150, 5, PayoutFeePercent: 0.25m, PayoutFeeFixedCents: 10, InstantPayoutFeePercent: 1m);
        Assert.Equal(35, Fees.PayoutFee(10_000, rules));
        // Never rounded in the platform's disadvantage: €12.34 is €0.03085, so €0.04.
        Assert.Equal(14, Fees.PayoutFee(1_234, rules));
        Assert.Equal(12, Fees.PayoutFee(600, rules));
        // Instant: 1% on top of the standard fee, the most Stripe could charge for it.
        Assert.Equal(135, Fees.PayoutFee(10_000, rules, instant: true));
    }

    [Fact]
    public void Payout_costs_are_set_aside_before_the_money_goes_out_and_the_buffer_tops_itself_up()
    {
        var rules = new FeeRules(5m, 150, 5, PayoutFeePercent: 0.25m, PayoutFeeFixedCents: 10, PayoutBufferCents: 250);
        // A first €100: 0.25% (€0.25) and the whole €2.50 buffer.
        Assert.Equal(275, Fees.PayoutCostsToSetAside(10_000, 0, rules));
        // Buffer full: only the 0.25%.
        Assert.Equal(25, Fees.PayoutCostsToSetAside(10_000, 250, rules));
        // A payout used €2.35 of the buffer: that comes back first.
        Assert.Equal(260, Fees.PayoutCostsToSetAside(10_000, 15, rules));
        // Never more than there is.
        Assert.Equal(40, Fees.PayoutCostsToSetAside(40, -213, rules));
    }

    private async Task<int> RecordPayoutsAsync(string slug)
    {
        Organisation organisation;
        using (var lookup = _app.Services.CreateScope())
            organisation = (await lookup.ServiceProvider.GetRequiredService<AppCache>().OrganisationBySlugAsync(slug))!;
        await using var scope = await _app.Services.GetRequiredService<TenantScopes>().OpenAsync(organisation);
        return await scope.ServiceProvider.GetRequiredService<SettlementService>().RecordPayoutsAsync();
    }

    [Fact]
    public async Task A_payment_Stripe_already_paid_straight_to_the_organisation_counts_as_sent_and_is_never_sent_again()
    {
        var shop = await PayingShopAsync();
        var buyer = await _app.NewBuyerAsync(shop);
        await buyer.PostOkAsync($"{shop.Url}/wallet/topup", new { amountCents = 2000 });
        var sessionId = Stripe.LastSessionId;
        var paymentId = Guid.Parse(Stripe.Sessions[sessionId].Request["metadata[paymentId]"]);
        // As payments worked at first: the money went to the organisation's account at payment time, minus a €1 fee.
        Stripe.Pay(sessionId);
        Stripe.Sessions[sessionId] = Stripe.Sessions[sessionId] with { DirectTo = ("tr_direct", 100) };

        await buyer.PostOkAsync($"{shop.Url}/payments/{paymentId}/refresh", new { });
        await TidyUpAsync(shop.Slug);

        Assert.Null(Stripe.TransferFor(paymentId));
        var line = Assert.Single((await shop.Admin.GetOkAsync($"{shop.Url}/admin/summary"))["payments"]!.AsArray())!;
        Assert.Equal(1900, line.Int("netCents"));
    }

    [Fact]
    public async Task Webhooks_without_Stripe_s_signature_change_nothing()
    {
        var shop = await PayingShopAsync();
        var buyer = await _app.NewBuyerAsync(shop);
        (await buyer.OrderAsync(shop)).EnsureSuccessStatusCode();
        var sessionId = Stripe.LastSessionId;
        Stripe.Pay(sessionId);

        var forged = FakeStripe.Webhook("checkout.session.completed", sessionId, shop.OrganisationId, secret: "whsec_guessed");
        Assert.Equal(HttpStatusCode.BadRequest, (await StripeSendsAsync(forged)).StatusCode);
        var unsigned = FakeStripe.Webhook("checkout.session.completed", sessionId, shop.OrganisationId);
        unsigned.Headers.Remove("Stripe-Signature");
        Assert.Equal(HttpStatusCode.BadRequest, (await StripeSendsAsync(unsigned)).StatusCode);
        Assert.Empty((await buyer.GetOkAsync($"{shop.Url}/me/tickets")).AsArray());

        // Genuine but about another organisation: that organisation has no such payment.
        var other = await PayingShopAsync();
        await StripeSendsAsync(FakeStripe.Webhook("checkout.session.completed", sessionId, other.OrganisationId));
        Assert.Empty((await buyer.GetOkAsync($"{shop.Url}/me/tickets")).AsArray());

        // A Stripe payment can't be finished by pressing the test checkout's "Pay" button.
        var paymentId = Stripe.Sessions[sessionId].Request["metadata[paymentId]"];
        Assert.Equal(HttpStatusCode.NotFound, (await buyer.PostAsync($"{shop.Url}/payments/{paymentId}/test-pay", null)).StatusCode);

        await StripeSendsAsync(FakeStripe.Webhook("checkout.session.completed", sessionId, shop.OrganisationId));
        Assert.Single((await buyer.GetOkAsync($"{shop.Url}/me/tickets")).AsArray());
    }

    [Fact]
    public async Task Coming_back_from_Stripe_settles_the_payment_without_waiting_for_the_webhook()
    {
        var shop = await PayingShopAsync();
        var buyer = await _app.NewBuyerAsync(shop);
        (await buyer.OrderAsync(shop, 2)).EnsureSuccessStatusCode();
        var sessionId = Stripe.LastSessionId;
        var paymentId = Stripe.Sessions[sessionId].Request["metadata[paymentId]"];

        Assert.Equal("Pending", (await buyer.PostOkAsync($"{shop.Url}/payments/{paymentId}/refresh", new { })).Str("status"));
        Stripe.Pay(sessionId);
        Assert.Equal("Paid", (await buyer.PostOkAsync($"{shop.Url}/payments/{paymentId}/refresh", new { })).Str("status"));
        Assert.Equal(2, (await buyer.GetOkAsync($"{shop.Url}/me/tickets")).AsArray().Count);
    }

    [Fact]
    public async Task Going_back_from_Stripe_closes_the_page_and_puts_the_tickets_back_on_sale()
    {
        var shop = await PayingShopAsync(capacity: 1);
        var first = await _app.NewBuyerAsync(shop);
        var second = await _app.NewBuyerAsync(shop);
        (await first.OrderAsync(shop)).EnsureSuccessStatusCode();
        var sessionId = Stripe.LastSessionId;
        var paymentId = Stripe.Sessions[sessionId].Request["metadata[paymentId]"];
        Assert.Equal(HttpStatusCode.Conflict, (await second.OrderAsync(shop)).StatusCode);

        Assert.Equal("Failed", (await first.PostOkAsync($"{shop.Url}/payments/{paymentId}/cancel", new { })).Str("status"));
        // Closed at Stripe too, so it can't be paid later in another tab.
        Assert.Equal("expired", Stripe.Sessions[sessionId].Status);
        Assert.Equal(0, await shop.SoldAsync());
        (await second.OrderAsync(shop)).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Going_back_after_all_does_not_undo_a_payment_that_went_through()
    {
        var shop = await PayingShopAsync();
        var buyer = await _app.NewBuyerAsync(shop);
        (await buyer.OrderAsync(shop)).EnsureSuccessStatusCode();
        var sessionId = Stripe.LastSessionId;
        Stripe.Pay(sessionId);

        var paymentId = Stripe.Sessions[sessionId].Request["metadata[paymentId]"];
        Assert.Equal("Paid", (await buyer.PostOkAsync($"{shop.Url}/payments/{paymentId}/cancel", new { })).Str("status"));
        Assert.Single((await buyer.GetOkAsync($"{shop.Url}/me/tickets")).AsArray());
    }

    [Fact]
    public async Task If_Stripe_cannot_start_the_payment_nothing_is_charged_and_the_tickets_go_back()
    {
        var shop = await PayingShopAsync(capacity: 1);
        var buyer = await _app.NewBuyerAsync(shop);
        Stripe.FailCreates = true;
        try
        {
            var response = await buyer.OrderAsync(shop);
            Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
            Assert.Contains("Nothing was charged", await response.Content.ReadAsStringAsync());
            Assert.Equal(0, await shop.SoldAsync());
        }
        finally
        {
            Stripe.FailCreates = false;
        }
        (await buyer.OrderAsync(shop)).EnsureSuccessStatusCode();
        Assert.Equal(1, await shop.SoldAsync());
    }

    [Fact]
    public async Task Unfinished_payments_are_checked_with_Stripe_instead_of_given_up()
    {
        var shop = await PayingShopAsync();
        var buyer = await _app.NewBuyerAsync(shop);
        (await buyer.OrderAsync(shop)).EnsureSuccessStatusCode();
        var sessionId = Stripe.LastSessionId;

        // Stripe's page is still open: keep holding the tickets.
        Assert.Equal(0, await TidyUpAsync(shop.Slug));
        Assert.Equal(1, await shop.SoldAsync());

        // The webhook never came (as on a laptop), but the check finds the payment and delivers.
        Stripe.Pay(sessionId);
        await TidyUpAsync(shop.Slug);
        Assert.Single((await buyer.GetOkAsync($"{shop.Url}/me/tickets")).AsArray());
    }

    /// <summary>Runs the background tidy-up for one organisation right now, treating every payment as old.</summary>
    private async Task<int> TidyUpAsync(string slug)
    {
        Organisation organisation;
        using (var lookup = _app.Services.CreateScope())
            organisation = (await lookup.ServiceProvider.GetRequiredService<AppCache>().OrganisationBySlugAsync(slug))!;
        await using var scope = await _app.Services.GetRequiredService<TenantScopes>().OpenAsync(organisation);
        var expired = await scope.ServiceProvider.GetRequiredService<PaymentService>().ExpireStaleAsync(TimeSpan.Zero, TimeSpan.Zero);
        // As the worker does next: the outbox, as if every retry were due already.
        await scope.ServiceProvider.GetRequiredService<OutboxDispatcher>().ProcessDueAsync(asOf: DateTime.UtcNow.AddDays(1));
        return expired;
    }

    /// <summary>The organisation's outbox, oldest first.</summary>
    private async Task<List<OutboxMessage>> OutboxAsync(string slug)
    {
        Organisation organisation;
        using (var lookup = _app.Services.CreateScope())
            organisation = (await lookup.ServiceProvider.GetRequiredService<AppCache>().OrganisationBySlugAsync(slug))!;
        await using var scope = await _app.Services.GetRequiredService<TenantScopes>().OpenAsync(organisation);
        return await scope.ServiceProvider.GetRequiredService<AppDbContext>().Outbox.AsNoTracking().OrderBy(m => m.CreatedAt).ToListAsync();
    }
}

public class PlatformFeeTests
{
    private static readonly FeeRules Rules = new(PercentPerItem: 5m, MaxCentsPerItem: 150, MinimumMarginCents: 5);

    private static int Fee(int stripeFeeCents, params int[] ticketPrices) =>
        Fees.PlatformFee(ticketPrices, ticketPrices.Sum(), stripeFeeCents, Rules);

    [Theory]
    [InlineData(2000, 55, 100)]  // 5% of €20 = €1.00; Stripe €0.55: the organisation keeps 95%
    [InlineData(1250, 44, 62)]   // 5% = €0.625, rounded down
    [InlineData(5000, 100, 150)] // 5% would be €2.50: capped at €1.50 per ticket
    [InlineData(500, 33, 38)]    // 5% = €0.25 is less than Stripe's €0.33: €0.33 + €0.05
    [InlineData(10000, 175, 180)] // a €100 ticket: the cap would lose money, so Stripe's €1.75 + €0.05
    public void One_ticket(int price, int stripeFee, int expectedFee) => Assert.Equal(expectedFee, Fee(stripeFee, price));

    [Fact]
    public void The_cap_counts_per_ticket() =>
        // Four €50 tickets: €1.50 each, while Stripe charges once for the whole order.
        Assert.Equal(600, Fee(325, 5000, 5000, 5000, 5000));

    [Fact]
    public void The_fee_never_exceeds_the_payment() => Assert.Equal(50, Fee(80, 50));
}

public class NoPaymentsTests : IClassFixture<NoPaymentsTestApp>
{
    private readonly NoPaymentsTestApp _app;
    public NoPaymentsTests(NoPaymentsTestApp app) => _app = app;

    [Fact]
    public async Task Without_online_payments_buyers_are_told_and_no_tickets_are_held()
    {
        var shop = await _app.NewShopAsync();
        var buyer = await _app.NewBuyerAsync(shop);

        var order = await buyer.OrderAsync(shop);
        Assert.Equal(HttpStatusCode.Conflict, order.StatusCode);
        Assert.Contains("Online payments are not available", await order.Content.ReadAsStringAsync());
        Assert.Equal(0, await shop.SoldAsync());
        Assert.Equal(HttpStatusCode.Conflict, (await buyer.PostAsJsonAsync($"{shop.Url}/wallet/topup", new { amountCents = 1000 })).StatusCode);
        Assert.Equal("unavailable", (await shop.Admin.GetOkAsync($"{shop.Url}/admin/payouts")).Str("status"));
    }
}
