namespace MyTickets.Api.Services;

/// <summary>How MyTickets' fee and Stripe's payout costs are worked out; read from configuration (Stripe:*).</summary>
public record FeeRules(decimal PercentPerItem, int MaxCentsPerItem, int MinimumMarginCents, int MonthlyAccountFeeCents = 0,
    decimal PayoutFeePercent = 0, int PayoutFeeFixedCents = 0, decimal InstantPayoutFeePercent = 0, int PayoutBufferCents = 0)
{
    public static FeeRules From(IConfiguration config) => new(
        config.GetValue("Stripe:PlatformFeePercent", 5m),
        config.GetValue("Stripe:PlatformFeeMaxCentsPerItem", 150),
        config.GetValue("Stripe:MinimumMarginCents", 5),
        config.GetValue("Stripe:MonthlyAccountFeeCents", 200),
        config.GetValue("Stripe:PayoutFeePercent", 0.25m),
        config.GetValue("Stripe:PayoutFeeFixedCents", 10),
        config.GetValue("Stripe:InstantPayoutFeePercent", 1m),
        config.GetValue("Stripe:PayoutBufferCents", 250));
}

/// <summary>The fee sums themselves: plain arithmetic on cents, so they are easy to check.</summary>
public static class Fees
{
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

    /// <summary>
    /// What to set aside from a payment, before the rest goes to the organisation, so that Stripe's payout costs are
    /// paid for before Stripe charges them and the platform never pays them: Stripe's percentage on this money (it
    /// will be paid out), and whatever brings the buffer for the fixed costs (€2 a month, €0.10 a payout) back up.
    /// A shortfall after an expensive month is made up first. Never more than what is left of the payment.
    /// </summary>
    /// <param name="available">The payment minus the platform fee.</param>
    /// <param name="balance">Set aside so far minus payout costs so far: the buffer, or below 0 what is still owed.</param>
    public static int PayoutCostsToSetAside(int available, int balance, FeeRules rules)
    {
        var percentage = (int)Math.Ceiling(available * rules.PayoutFeePercent / 100m);
        return Math.Clamp(percentage + rules.PayoutBufferCents - balance, 0, available);
    }

    /// <summary>
    /// What Stripe charges the platform for one payout to the organisation's bank: a percentage plus a fixed part,
    /// and for an instant payout its extra percentage on top. Rounded up to the cent, so the platform never pays
    /// the difference.
    /// </summary>
    public static int PayoutFee(int payoutCents, FeeRules rules, bool instant = false) =>
        (int)Math.Ceiling(payoutCents * (rules.PayoutFeePercent + (instant ? rules.InstantPayoutFeePercent : 0)) / 100m) + rules.PayoutFeeFixedCents;

    /// <summary>The calendar month this moment falls in, in UTC, as Stripe bills its months.</summary>
    public static (DateTime Start, DateTime End) MonthAround(DateTime utc)
    {
        var first = new DateTime(utc.Year, utc.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        return (first, first.AddMonths(1));
    }
}
