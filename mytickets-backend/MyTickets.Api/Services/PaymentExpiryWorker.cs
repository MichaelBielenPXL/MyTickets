using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;

namespace MyTickets.Api.Services;

public class PaymentExpiryWorker(IServiceScopeFactory scopes, TenantScopes tenants, ILogger<PaymentExpiryWorker> log) : BackgroundService
{
    public static readonly TimeSpan ReservationTime = TimeSpan.FromMinutes(20);
    /// <summary>How often organisations' payouts to their bank are looked up (for Stripe's payout fee).</summary>
    private static readonly TimeSpan PayoutCheckInterval = TimeSpan.FromMinutes(15);
    private DateTime _payoutsCheckedAt = DateTime.MinValue;

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (await timer.WaitForNextTickAsync(stop))
        {
            List<Organisation> organisations;
            await using (var scope = scopes.CreateAsyncScope())
                organisations = (await scope.ServiceProvider.GetRequiredService<PlatformDbContext>().Tenants.AsNoTracking().ToListAsync(stop))
                    .Select(t => t.ToOrganisation()).ToList();

            var checkPayouts = DateTime.UtcNow - _payoutsCheckedAt >= PayoutCheckInterval;
            if (checkPayouts) _payoutsCheckedAt = DateTime.UtcNow;

            // Each organisation has its own database, so each is tidied on its own. One failing does not stop the rest.
            foreach (var organisation in organisations)
            {
                try
                {
                    await using var scope = await tenants.OpenAsync(organisation);
                    var payments = scope.ServiceProvider.GetRequiredService<PaymentService>();
                    var n = await payments.ExpireStaleAsync(ReservationTime);
                    if (n > 0) log.LogInformation("Closed {Count} unfinished payments at {Slug}", n, organisation.Slug);
                    // Events whose work is still to do, or failed and is due again: passing payments on, for one.
                    await scope.ServiceProvider.GetRequiredService<OutboxDispatcher>().ProcessDueAsync(ct: stop);
                    if (checkPayouts)
                    {
                        try
                        {
                            var found = await scope.ServiceProvider.GetRequiredService<SettlementService>().RecordPayoutsAsync(stop);
                            if (found > 0) log.LogInformation("Noted {Count} payouts to the bank at {Slug}", found, organisation.Slug);
                        }
                        catch (StripeException e)
                        {
                            log.LogWarning("Looking up payouts failed for {Slug}, will try again: {Message}", organisation.Slug, e.Message);
                        }
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    log.LogError(ex, "Tidying unfinished payments failed for {Slug}", organisation.Slug);
                }
            }
        }
    }
}
