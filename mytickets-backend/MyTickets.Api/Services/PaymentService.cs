using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;

namespace MyTickets.Api.Services;

/// <summary>Stand-in for a real payment page, for trying things out: a page with "Pay" and "Cancel". No money moves.</summary>
public static class TestCheckout
{
    public const string ProviderName = "Fake";

    /// <summary>Only on a developer's machine, or when explicitly switched on. Never quietly on a live site.</summary>
    public static bool Allowed(IConfiguration config, IHostEnvironment environment) =>
        config.GetValue<bool?>("Payments:UseTestCheckout") ?? environment.IsDevelopment();
}

/// <summary>This organisation can't take online payments. The message tells the buyer what is going on.</summary>
public class PaymentsNotSetUpException(string message) : Exception(message)
{
    public static PaymentsNotSetUpException For(string organisationName) =>
        new($"{organisationName} can't take online payments yet. Pay with your tokens, or ask the organisers.");
}

/// <summary>
/// Takes payments with Stripe Connect: the buyer pays on Stripe's page, the organisation is the seller and
/// gets the money (minus the platform fee), and Stripe pays it out to their bank. Each payment is also
/// recorded in the organisation's own database, which is what tickets, credit and memberships go by.
/// </summary>
public class PaymentService(AppDbContext db, WalletService wallets, MembershipService memberships, TenantContext tenant,
    StripeClient stripe, IConfiguration config, IHostEnvironment environment,
    IHttpContextAccessor httpContext, ILogger<PaymentService> log, TimeProvider clock)
{
    /// <summary>The smallest amount Stripe accepts.</summary>
    public const int MinimumOnlinePaymentCents = 50;

    /// <summary>How long Stripe's page stays open. Stripe's minimum; tickets are held for the buyer that long.</summary>
    public static readonly TimeSpan CheckoutLifetime = TimeSpan.FromMinutes(30);

    /// <summary>Starts a payment that reserves nothing: records it, then hands back the address to send the buyer to.</summary>
    public async Task<string> StartAsync(Payment payment)
    {
        await PrepareAsync(payment);
        await db.SaveChangesAsync();
        return await CheckoutAsync(payment.Id);
    }

    /// <summary>
    /// Adds a pending payment to the database work in progress, without saving. Use this when the payment is
    /// saved together with what it reserves (tickets), then call <see cref="CheckoutAsync"/> after the commit.
    /// Throws <see cref="PaymentsNotSetUpException"/> before anything is reserved when there is no way to pay.
    /// </summary>
    public async Task PrepareAsync(Payment payment)
    {
        string provider;
        if (stripe.Configured)
        {
            var account = await db.StripeAccounts.AsNoTracking().FirstOrDefaultAsync();
            if (account is not { ChargesEnabled: true }) throw PaymentsNotSetUpException.For(tenant.Required.Name);
            provider = StripeClient.ProviderName;
        }
        else if (TestCheckout.Allowed(config, environment)) provider = TestCheckout.ProviderName;
        else throw new PaymentsNotSetUpException("Online payments are not available yet. Pay with your tokens, or ask the organisers.");

        // Stripe refuses card payments under €0.50.
        if (provider == StripeClient.ProviderName && payment.AmountCents < MinimumOnlinePaymentCents)
            throw new PaymentsNotSetUpException($"Online payments start at {Endpoints.Http.Euro(MinimumOnlinePaymentCents)}. Pay with your tokens instead.");

        payment.Status = PaymentStatus.Pending;
        payment.CreatedAt = clock.GetUtcNow().UtcDateTime;
        payment.Provider = provider;
        db.Payments.Add(payment);
    }

    /// <summary>
    /// Opens the payment page for a saved, pending payment and returns its address: Stripe's page, or the
    /// test checkout on a developer's machine. Talking to Stripe happens outside any database transaction, so
    /// a slow answer does not hold up everyone else. If Stripe can't start the payment, it is closed again
    /// and anything it reserved goes back on sale.
    /// </summary>
    public async Task<string> CheckoutAsync(Guid paymentId)
    {
        var organisation = tenant.Required;
        var payment = await db.Payments.FirstAsync(p => p.Id == paymentId);
        if (payment.Provider == TestCheckout.ProviderName)
        {
            payment.ProviderReference = $"fake-{payment.Id:N}";
            await db.SaveChangesAsync();
            return $"/{organisation.Slug}/checkout/{payment.Id}";
        }

        try
        {
            var account = await db.StripeAccounts.AsNoTracking().FirstOrDefaultAsync()
                ?? throw PaymentsNotSetUpException.For(organisation.Name);
            var page = $"{SiteAddress()}/{organisation.Slug}/checkout/{payment.Id}";
            var session = await stripe.CreateCheckoutAsync(new StripeCheckoutRequest(
                payment.AmountCents, $"{organisation.Name}: {payment.Description}",
                // Stripe sends the buyer back here; that page then asks how it went.
                ReturnUrl: page, CancelUrl: $"{page}?cancelled=1",
                payment.Id, organisation.Id, account.AccountId,
                ExpiresAt: clock.GetUtcNow().UtcDateTime + CheckoutLifetime + TimeSpan.FromMinutes(1)));
            payment.ProviderReference = session.Id;
            await db.SaveChangesAsync();
            return session.Url ?? throw new StripeException("Stripe did not send a payment page.");
        }
        catch (Exception e) when (e is StripeException or PaymentsNotSetUpException)
        {
            if (payment.ProviderReference is null) await FailAsync(payment.Id);
            throw;
        }
    }

    /// <summary>
    /// Asks Stripe how a payment is doing and acts on the answer. Only Stripe's own answer counts, never
    /// what a browser says.
    /// </summary>
    public async Task<PaymentStatus> SyncAsync(Guid paymentId)
    {
        var payment = await db.Payments.AsNoTracking().FirstOrDefaultAsync(p => p.Id == paymentId)
            ?? throw new KeyNotFoundException("Payment not found.");
        if (payment.Status != PaymentStatus.Pending || payment.Provider != StripeClient.ProviderName) return payment.Status;
        if (payment.ProviderReference is null)
        {
            // Never reached Stripe (the app stopped half-way). After the reservation time there is nothing to wait for.
            if (payment.CreatedAt < clock.GetUtcNow().UtcDateTime - CheckoutLifetime) await FailAsync(payment.Id);
            return await StatusOf(payment.Id);
        }

        var session = await stripe.GetCheckoutAsync(payment.ProviderReference);
        if (session.IsPaid)
        {
            await CompleteAsync(payment.Id);
            await SettleAsync(payment.Id);
        }
        else if (session.IsExpired) await FailAsync(payment.Id);
        return await StatusOf(payment.Id);
    }

    /// <summary>
    /// Passes the organisation its money for a paid Stripe payment: the amount minus the platform fee, worked
    /// out from what Stripe actually charged. Safe to call again and again: it only ever transfers once.
    /// If Stripe can't be reached, or has not booked the charge yet, it is simply tried again later.
    /// Returns whether the payment is settled.
    /// </summary>
    public async Task<bool> SettleAsync(Guid paymentId)
    {
        var payment = await db.Payments.FirstAsync(p => p.Id == paymentId);
        if (payment.Provider != StripeClient.ProviderName || payment.Status != PaymentStatus.Paid) return false;
        if (payment.TransferId is not null) return true;

        try
        {
            var charge = await stripe.GetChargeAsync(payment.ProviderReference!);
            if (charge is null) return false;
            var account = await db.StripeAccounts.AsNoTracking().FirstAsync();
            var items = await ItemPricesAsync(payment);
            var fee = PlatformFee(items, payment.AmountCents, charge.StripeFeeCents, CurrentFeeRules());

            payment.ChargeId = charge.Id;
            payment.StripeFeeCents = charge.StripeFeeCents;
            payment.PlatformFeeCents = fee;
            payment.TransferId = await stripe.TransferAsync(account.AccountId, payment.AmountCents - fee, charge.Id, payment.Id);
            await db.SaveChangesAsync();
            return true;
        }
        catch (StripeException e)
        {
            log.LogWarning("Passing on payment {PaymentId} to the organisation failed, will try again: {Message}", paymentId, e.Message);
            return false;
        }
    }

    /// <summary>The buyer pressed "back" on Stripe's page: close it there, so it can't be paid later, and release what it held.</summary>
    public async Task<PaymentStatus> CancelAsync(Guid paymentId)
    {
        var payment = await db.Payments.AsNoTracking().FirstAsync(p => p.Id == paymentId);
        if (payment.Status == PaymentStatus.Pending && payment.Provider == StripeClient.ProviderName && payment.ProviderReference is not null)
        {
            try { await stripe.ExpireCheckoutAsync(payment.ProviderReference); }
            catch (StripeException e)
            {
                // Already paid or already closed: the check below finds out which.
                log.LogInformation("Closing Stripe page for payment {PaymentId}: {Message}", paymentId, e.Message);
            }
        }
        return await SyncAsync(paymentId);
    }

    /// <summary>For Stripe's webhook: finds our payment by Stripe's page id and brings it up to date. Unknown ids are ignored.</summary>
    public async Task SyncByCheckoutIdAsync(string sessionId)
    {
        var paymentId = await db.Payments.AsNoTracking()
            .Where(p => p.Provider == StripeClient.ProviderName && p.ProviderReference == sessionId)
            .Select(p => (Guid?)p.Id).FirstOrDefaultAsync();
        if (paymentId is { } id) await SyncAsync(id);
    }

    /// <summary>
    /// Marks the payment paid and hands over what was bought. Safe to call more than once:
    /// only the first call does anything. Returns false if the payment was not pending.
    /// </summary>
    public async Task<bool> CompleteAsync(Guid paymentId)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        var now = clock.GetUtcNow().UtcDateTime;
        var claimed = await db.Payments.Where(p => p.Id == paymentId && p.Status == PaymentStatus.Pending)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Status, PaymentStatus.Paid).SetProperty(p => p.CompletedAt, now));
        if (claimed == 0) return false;

        var payment = await db.Payments.AsNoTracking().FirstAsync(p => p.Id == paymentId);
        switch (payment.Purpose)
        {
            case PaymentPurpose.TopUp:
                var wallet = await wallets.GetOrCreateAsync(payment.UserId, payment.OrganisationId);
                await wallets.CreditAsync(wallet.Id, payment.AmountCents, WalletTxType.TopUp, "Online top-up", paymentId: payment.Id);
                break;
            case PaymentPurpose.Tickets:
                await db.Tickets.Where(t => t.PaymentId == payment.Id && t.Status == TicketStatus.Reserved)
                    .ExecuteUpdateAsync(s => s.SetProperty(t => t.Status, TicketStatus.Valid));
                break;
            case PaymentPurpose.Membership:
                var tier = await db.MembershipTiers.FirstAsync(t => t.Id == payment.TierId);
                await memberships.ApplyTierAsync(payment.UserId, payment.OrganisationId, tier);
                break;
        }
        await tx.CommitAsync();
        return true;
    }

    /// <summary>Marks the payment failed and puts any reserved tickets back on sale. Safe to call more than once.</summary>
    public async Task<bool> FailAsync(Guid paymentId)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        var now = clock.GetUtcNow().UtcDateTime;
        var claimed = await db.Payments.Where(p => p.Id == paymentId && p.Status == PaymentStatus.Pending)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Status, PaymentStatus.Failed).SetProperty(p => p.CompletedAt, now));
        if (claimed == 0) return false;

        var reserved = await db.Tickets.Where(t => t.PaymentId == paymentId && t.Status == TicketStatus.Reserved)
            .GroupBy(t => t.TicketTypeId).Select(g => new { TicketTypeId = g.Key, Count = g.Count() }).ToListAsync();
        foreach (var r in reserved)
            await db.TicketTypes.Where(t => t.Id == r.TicketTypeId)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.Sold, t => t.Sold - r.Count));
        await db.Tickets.Where(t => t.PaymentId == paymentId && t.Status == TicketStatus.Reserved).ExecuteDeleteAsync();
        await tx.CommitAsync();
        return true;
    }

    /// <summary>
    /// Tidies up unfinished payments. Test-checkout payments nobody finished are given up, so their tickets go
    /// back on sale. Stripe payments are never given up on our own say (the buyer may have paid and the webhook
    /// not arrived): they are checked with Stripe, whose page closes by itself after <see cref="CheckoutLifetime"/>.
    /// </summary>
    public async Task<int> ExpireStaleAsync(TimeSpan olderThan, TimeSpan? checkStripeAfter = null)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var expired = 0;
        var stale = await db.Payments
            .Where(p => p.Status == PaymentStatus.Pending && p.Provider == TestCheckout.ProviderName && p.CreatedAt < now - olderThan)
            .Select(p => p.Id).ToListAsync();
        foreach (var id in stale)
            if (await FailAsync(id)) expired++;

        var stripeCutoff = now - (checkStripeAfter ?? TimeSpan.FromMinutes(2));
        var waiting = await db.Payments
            .Where(p => p.Status == PaymentStatus.Pending && p.Provider == StripeClient.ProviderName && p.CreatedAt < stripeCutoff)
            .OrderBy(p => p.CreatedAt).Select(p => p.Id).Take(50).ToListAsync();
        foreach (var id in waiting)
        {
            try
            {
                if (await SyncAsync(id) == PaymentStatus.Failed) expired++;
            }
            catch (StripeException e)
            {
                log.LogWarning("Checking Stripe payment {PaymentId} failed: {Message}", id, e.Message);
            }
        }

        // Paid, but the organisation's share was not passed on yet (Stripe was down, or slow to book the charge).
        var unsettled = await db.Payments
            .Where(p => p.Status == PaymentStatus.Paid && p.Provider == StripeClient.ProviderName && p.TransferId == null)
            .OrderBy(p => p.CompletedAt).Select(p => p.Id).Take(50).ToListAsync();
        foreach (var id in unsettled) await SettleAsync(id);
        return expired;
    }

    /// <summary>How the platform fee is worked out. See <see cref="PlatformFee"/>.</summary>
    public record FeeRules(decimal PercentPerItem, int MaxCentsPerItem, int MinimumMarginCents);

    private FeeRules CurrentFeeRules() => new(
        config.GetValue("Stripe:PlatformFeePercent", 5m),
        config.GetValue("Stripe:PlatformFeeMaxCentsPerItem", 150),
        config.GetValue("Stripe:MinimumMarginCents", 5));

    /// <summary>
    /// The platform's cut of one payment: a percentage of every item (each ticket, or the top-up or membership)
    /// with a cap per item, but never less than what Stripe charged for the payment plus a small margin, so the
    /// platform never pays to process a payment. Whole cents, rounded down, never more than the payment.
    /// </summary>
    public static int PlatformFee(IReadOnlyCollection<int> itemPriceCents, int amountCents, int stripeFeeCents, FeeRules rules)
    {
        var commission = itemPriceCents.Sum(price => Math.Min((int)Math.Floor(price * rules.PercentPerItem / 100m), rules.MaxCentsPerItem));
        var fee = Math.Max(commission, stripeFeeCents + rules.MinimumMarginCents);
        return Math.Clamp(fee, 0, amountCents);
    }

    /// <summary>The prices the fee is counted on: each ticket separately, otherwise the whole payment as one item.</summary>
    private async Task<IReadOnlyCollection<int>> ItemPricesAsync(Payment payment)
    {
        if (payment.Purpose != PaymentPurpose.Tickets) return [payment.AmountCents];
        var prices = await db.Tickets.Where(t => t.PaymentId == payment.Id).Select(t => t.PricePaidCents).ToListAsync();
        return prices.Count > 0 ? prices : [payment.AmountCents];
    }

    private Task<PaymentStatus> StatusOf(Guid paymentId) => db.Payments.Where(p => p.Id == paymentId).Select(p => p.Status).FirstAsync();

    /// <summary>The address people reach this site at: App:PublicUrl when set, otherwise the address of this request.</summary>
    private string SiteAddress()
    {
        if (config["App:PublicUrl"] is { Length: > 0 } configured) return configured.TrimEnd('/');
        var request = httpContext.HttpContext?.Request
            ?? throw new InvalidOperationException("Set App:PublicUrl so payments started outside a web request know where to send buyers back to.");
        return $"{request.Scheme}://{request.Host}";
    }
}

public class PaymentExpiryWorker(IServiceScopeFactory scopes, TenantScopes tenants, ILogger<PaymentExpiryWorker> log) : BackgroundService
{
    public static readonly TimeSpan ReservationTime = TimeSpan.FromMinutes(20);

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (await timer.WaitForNextTickAsync(stop))
        {
            List<Organisation> organisations;
            await using (var scope = scopes.CreateAsyncScope())
                organisations = (await scope.ServiceProvider.GetRequiredService<PlatformDbContext>().Tenants.AsNoTracking().ToListAsync(stop))
                    .Select(t => t.ToOrganisation()).ToList();

            // Each organisation has its own database, so each is tidied on its own. One failing does not stop the rest.
            foreach (var organisation in organisations)
            {
                try
                {
                    await using var scope = await tenants.OpenAsync(organisation);
                    var n = await scope.ServiceProvider.GetRequiredService<PaymentService>().ExpireStaleAsync(ReservationTime);
                    if (n > 0) log.LogInformation("Closed {Count} unfinished payments at {Slug}", n, organisation.Slug);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    log.LogError(ex, "Tidying unfinished payments failed for {Slug}", organisation.Slug);
                }
            }
        }
    }
}
