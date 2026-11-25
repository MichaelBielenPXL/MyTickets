namespace MyTickets.Api.Data;

/// <summary>
/// Which organisation an issued card belongs to, so a card's link (<c>/c/{code}</c>) needs no organisation name and
/// keeps working after a rename. Holds nothing about people.
/// </summary>
public class CardCode
{
    public required string Code { get; set; }
    public Guid TenantId { get; set; }
}
