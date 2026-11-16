using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;

namespace MyTickets.Api.Services;

/// <summary>
/// Where real money comes in. Implement this for a payment company (Mollie, Stripe, ...):
/// create the payment there and return the page the buyer must be sent to. When that company
/// reports the outcome, call <see cref="PaymentService.CompleteAsync"/> or <see cref="PaymentService.FailAsync"/>.
/// </summary>
public interface IPaymentProvider
{
    string Name { get; }
    Task<(string Reference, string CheckoutUrl)> CreateAsync(Payment payment, string organisationSlug, CancellationToken ct = default);
}

/// <summary>Stand-in used until a real payment company is connected: shows a test page where you click "Pay". No money moves.</summary>
public class FakePaymentProvider : IPaymentProvider
{
    public const string ProviderName = "Fake";
    public string Name => ProviderName;

    public Task<(string Reference, string CheckoutUrl)> CreateAsync(Payment payment, string organisationSlug, CancellationToken ct = default) =>
        Task.FromResult(($"fake-{payment.Id:N}", $"/{organisationSlug}/checkout/{payment.Id}"));
}

public class PaymentService(AppDbContext db, IPaymentProvider provider, WalletService wallets, MembershipService memberships, TenantContext tenant, TimeProvider clock)
{
    /// <summary>Records a pending payment and returns the address to send the buyer to.</summary>
    public async Task<string> StartAsync(Payment payment)
    {
        payment.Status = PaymentStatus.Pending;
        payment.Provider = provider.Name;
        payment.CreatedAt = clock.GetUtcNow().UtcDateTime;
        var (reference, url) = await provider.CreateAsync(payment, tenant.Required.Slug);
        payment.ProviderReference = reference;
        db.Payments.Add(payment);
        await db.SaveChangesAsync();
        return url;
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

    /// <summary>Gives up on payments nobody finished, so their reserved tickets go back on sale.</summary>
    public async Task<int> ExpireStaleAsync(TimeSpan olderThan)
    {
        var cutoff = clock.GetUtcNow().UtcDateTime - olderThan;
        var stale = await db.Payments.Where(p => p.Status == PaymentStatus.Pending && p.CreatedAt < cutoff)
            .Select(p => p.Id).ToListAsync();
        var expired = 0;
        foreach (var id in stale)
            if (await FailAsync(id)) expired++;
        return expired;
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
                    if (n > 0) log.LogInformation("Expired {Count} unfinished payments at {Slug}", n, organisation.Slug);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    log.LogError(ex, "Expiring unfinished payments failed for {Slug}", organisation.Slug);
                }
            }
        }
    }
}
