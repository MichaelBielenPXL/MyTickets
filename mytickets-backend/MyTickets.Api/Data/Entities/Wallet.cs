namespace MyTickets.Api.Data;

public class Wallet
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid OrganisationId { get; set; }
    public int BalanceCents { get; set; }
    /// <summary>An admin let this member link one more card within the year (a lost card); used up by that link.</summary>
    public bool ExtraCardAllowed { get; set; }
}
