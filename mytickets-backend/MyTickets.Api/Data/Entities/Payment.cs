namespace MyTickets.Api.Data;

// All money is stored as whole euro cents, as everywhere in the app.

public class Payment
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid OrganisationId { get; set; }
    public int AmountCents { get; set; }
    public PaymentPurpose Purpose { get; set; }
    public PaymentStatus Status { get; set; }
    public string Description { get; set; } = "";
    /// <summary>For membership payments: the tier being bought.</summary>
    public Guid? TierId { get; set; }
    /// <summary>For top-ups: the tokens credited once paid, when a deal gives more than one per euro. Null means AmountCents.</summary>
    public int? TokensCents { get; set; }
    public string Provider { get; set; } = "";
    public string? ProviderReference { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    // ---- Settling a Stripe payment with the organisation, after it is paid ----
    /// <summary>Stripe's charge for this payment.</summary>
    public string? ChargeId { get; set; }
    /// <summary>What Stripe charged the platform for this payment.</summary>
    public int? StripeFeeCents { get; set; }
    /// <summary>What the platform kept. Never less than <see cref="StripeFeeCents"/> plus the minimum margin.</summary>
    public int? PlatformFeeCents { get; set; }
    /// <summary>
    /// Only on payments settled before payouts were tracked: their share of Stripe's monthly payout-account fee.
    /// That fee now comes with the month's first payout and is paid back through <see cref="PayoutFeeCents"/>.
    /// </summary>
    public int? AccountFeeCents { get; set; }
    /// <summary>
    /// Set aside from this payment for Stripe's costs of paying the organisation out (see <see cref="BankPayout"/>):
    /// the percentage on this money, and topping up the small buffer that pays the fixed costs before Stripe charges them.
    /// </summary>
    public int? PayoutFeeCents { get; set; }
    /// <summary>When the money was passed on to the organisation.</summary>
    public DateTime? SettledAt { get; set; }
    /// <summary>The transfer of the rest to the organisation. Null until it is done.</summary>
    public string? TransferId { get; set; }
}

public enum PaymentPurpose { TopUp, Tickets, Membership }

public enum PaymentStatus { Pending, Paid, Failed }
