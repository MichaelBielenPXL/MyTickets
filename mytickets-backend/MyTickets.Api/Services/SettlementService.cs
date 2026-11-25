using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;

namespace MyTickets.Api.Services;

/// <summary>
/// Passes paid Stripe payments on to the organisation's own Stripe account, minus MyTickets' fee and what is set
/// aside for Stripe's costs of paying the organisation out; and notes those payouts and their costs.
/// </summary>
public class SettlementService(AppDbContext db, StripeClient stripe, IConfiguration config, TimeProvider clock, ILogger<SettlementService> log)
{
    /// <summary>The transfer of a payment the fees took whole: settled, with nothing sent.</summary>
    public const string NothingToTransfer = "none";

    /// <summary>
    /// Passes the organisation its money for a paid Stripe payment: the amount minus the platform fee, worked
    /// out from what Stripe actually charged. Safe to call again and again: it only ever transfers once.
    /// If Stripe can't be reached, or has not booked the charge yet, the outbox tries again later: this handles the
    /// <see cref="OutboxEvents.PaymentCompleted"/> event. Returns whether that is done: settled, or nothing to pass on.
    /// </summary>
    public async Task<bool> SettleAsync(Guid paymentId)
    {
        var payment = await db.Payments.FirstAsync(p => p.Id == paymentId);
        // Nothing to pass on: not paid through Stripe (the test checkout), or not (or no longer) paid.
        if (payment.Provider != StripeClient.ProviderName || payment.Status != PaymentStatus.Paid) return true;
        if (payment.TransferId is not null) return true;

        try
        {
            var charge = await stripe.GetChargeAsync(payment.ProviderReference!);
            if (charge is null) return false;
            var now = clock.GetUtcNow().UtcDateTime;
            if (charge.DirectTransferId is { } direct)
            {
                // Already with the organisation: paid straight into its account. Record that; never send it again.
                payment.ChargeId = charge.Id;
                payment.StripeFeeCents = charge.StripeFeeCents;
                payment.PlatformFeeCents = charge.ApplicationFeeCents ?? 0;
                payment.AccountFeeCents = 0;
                payment.PayoutFeeCents = 0;
                payment.SettledAt = now;
                payment.TransferId = direct;
                await db.SaveChangesAsync();
                return true;
            }
            var account = await db.StripeAccounts.AsNoTracking().FirstAsync();
            var items = await ItemPricesAsync(payment);
            var rules = FeeRules.From(config);
            var fee = Fees.PlatformFee(items, payment.AmountCents, charge.StripeFeeCents, rules);
            // Stripe's costs of paying the organisation out are set aside before the money goes to it (see Fees.PayoutCostsToSetAside).
            var payoutFee = Fees.PayoutCostsToSetAside(payment.AmountCents - fee, await PayoutCostsBalanceAsync(db), rules);

            payment.ChargeId = charge.Id;
            payment.StripeFeeCents = charge.StripeFeeCents;
            payment.PlatformFeeCents = fee;
            payment.AccountFeeCents = 0;
            payment.PayoutFeeCents = payoutFee;
            payment.SettledAt = now;
            var net = payment.AmountCents - fee - payoutFee;
            // Fees can take a whole small payment; there is then nothing to send, and Stripe refuses a transfer of 0.
            payment.TransferId = net > 0 ? await stripe.TransferAsync(account.AccountId, net, charge.Id, payment.Id) : NothingToTransfer;
            await db.SaveChangesAsync();
            return true;
        }
        catch (StripeException e)
        {
            log.LogWarning("Passing on payment {PaymentId} to the organisation failed, will try again: {Message}", paymentId, e.Message);
            return false;
        }
    }

    /// <summary>
    /// What was set aside from the organisation's payments for Stripe's payout costs, minus those costs so far.
    /// Above 0 it is the buffer still held for the next payouts; below 0, what the next money still has to cover.
    /// </summary>
    public static async Task<int> PayoutCostsBalanceAsync(AppDbContext db) =>
        await db.Payments.SumAsync(p => p.PayoutFeeCents ?? 0) - await db.BankPayouts.SumAsync(p => p.FeeCents + p.AccountFeeCents);

    /// <summary>
    /// Notes the payouts Stripe made to the organisation's bank since the last look, with what Stripe charged the
    /// platform for them: a fee on each, and for the first payout in a calendar month the monthly fee for an active
    /// payout account. They are paid from what was set aside for them (see Fees.PayoutCostsToSetAside). Returns how many were new.
    /// </summary>
    public async Task<int> RecordPayoutsAsync(CancellationToken ct = default)
    {
        if (!stripe.Configured) return 0;
        var account = await db.StripeAccounts.FirstOrDefaultAsync(ct);
        if (account is null) return 0;
        if (account.PayoutFeesSince is null)
        {
            account.PayoutFeesSince = clock.GetUtcNow().UtcDateTime;
            await db.SaveChangesAsync(ct);
            return 0;
        }
        var payouts = await stripe.ListPaidPayoutsAsync(account.AccountId, account.PayoutFeesSince.Value, ct);
        var ids = payouts.Select(p => p.Id).ToList();
        var known = (await db.BankPayouts.Where(p => ids.Contains(p.PayoutId)).Select(p => p.PayoutId).ToListAsync(ct)).ToHashSet();
        var rules = FeeRules.From(config);
        var fresh = payouts.Where(p => !known.Contains(p.Id)).OrderBy(p => p.CreatedAt).ToList();
        foreach (var p in fresh)
        {
            var (start, end) = Fees.MonthAround(p.CreatedAt);
            // Stripe charges the monthly fee once per month with payouts: on the first one, unless already charged.
            var monthCharged = await db.BankPayouts.AnyAsync(b => b.PaidAt >= start && b.PaidAt < end && b.AccountFeeCents > 0, ct)
                || db.BankPayouts.Local.Any(b => b.PaidAt >= start && b.PaidAt < end && b.AccountFeeCents > 0)
                // Before payouts were tracked, the month's fee was taken from the first payment instead.
                || await db.Payments.AnyAsync(x => x.SettledAt >= start && x.SettledAt < end && x.AccountFeeCents > 0, ct);
            db.BankPayouts.Add(new BankPayout
            {
                Id = Guid.NewGuid(), PayoutId = p.Id, AmountCents = p.AmountCents, PaidAt = p.CreatedAt,
                FeeCents = Fees.PayoutFee(p.AmountCents, rules, p.Instant), AccountFeeCents = monthCharged ? 0 : rules.MonthlyAccountFeeCents,
            });
        }
        await db.SaveChangesAsync(ct);
        return fresh.Count;
    }

    /// <summary>The prices the fee is counted on: each ticket separately, otherwise the whole payment as one item.</summary>
    private async Task<IReadOnlyCollection<int>> ItemPricesAsync(Payment payment)
    {
        if (payment.Purpose != PaymentPurpose.Tickets) return [payment.AmountCents];
        var prices = await db.Tickets.Where(t => t.PaymentId == payment.Id).Select(t => t.PricePaidCents).ToListAsync();
        return prices.Count > 0 ? prices : [payment.AmountCents];
    }
}
