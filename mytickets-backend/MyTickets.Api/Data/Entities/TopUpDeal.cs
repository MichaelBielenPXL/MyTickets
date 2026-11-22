namespace MyTickets.Api.Data;

/// <summary>
/// A top-up an organisation offers at its own price: pay €5, get 6 tokens. Members see these as the
/// buttons to top up with; any other amount still gives one token per euro.
/// </summary>
public class TopUpDeal
{
    public Guid Id { get; set; }
    public Guid OrganisationId { get; set; }
    public int PriceCents { get; set; }
    /// <summary>Tokens credited, in cents like every amount (600 = 6 tokens).</summary>
    public int TokensCents { get; set; }
    public int SortOrder { get; set; }
}
