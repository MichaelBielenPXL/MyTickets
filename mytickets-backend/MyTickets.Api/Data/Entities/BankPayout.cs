namespace MyTickets.Api.Data;

/// <summary>
/// A payout from the organisation's Stripe account to its bank. Stripe charges the platform a fee for each
/// (0.25% + €0.10), and €2 for every month with payouts; they are paid from what was set aside from the
/// organisation's payments for them, before the money went to it.
/// </summary>
public class BankPayout
{
    public Guid Id { get; set; }
    /// <summary>Stripe's id for the payout ("po_..."), so each is counted once.</summary>
    public required string PayoutId { get; set; }
    public int AmountCents { get; set; }
    public int FeeCents { get; set; }
    /// <summary>Stripe's monthly fee for an active payout account, carried by the month's first payout; 0 on the others.</summary>
    public int AccountFeeCents { get; set; }
    public DateTime PaidAt { get; set; }
}
