namespace MyTickets.Api.Data;

/// <summary>
/// The organisation's account at Stripe (Stripe Connect, Express). Stripe holds their details and bank
/// account and pays them out; we only keep its id and the last status we saw. One row at most.
/// </summary>
public class StripeAccount
{
    public Guid OrganisationId { get; set; }
    public required string AccountId { get; set; }
    /// <summary>Stripe allows taking payments for this organisation.</summary>
    public bool ChargesEnabled { get; set; }
    /// <summary>Stripe allows paying the money out to their bank account.</summary>
    public bool PayoutsEnabled { get; set; }
    public bool DetailsSubmitted { get; set; }
    public DateTime CheckedAt { get; set; }
    /// <summary>
    /// From when the organisation pays Stripe's fee on its payouts: the first time they were checked. Payouts
    /// from before were the platform's to pay, as agreed then.
    /// </summary>
    public DateTime? PayoutFeesSince { get; set; }
}
