namespace MyTickets.Api.Data;

public class TicketType
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public Event Event { get; set; } = null!;
    public required string Name { get; set; }
    public int PriceCents { get; set; }
    public int Capacity { get; set; }
    /// <summary>Tickets sold or reserved. Only ever changed with an atomic UPDATE so it cannot exceed Capacity.</summary>
    public int Sold { get; set; }
    public int MaxPerUser { get; set; } = 10;
    public DateTime? SalesStartAt { get; set; }
    public DateTime? SalesEndAt { get; set; }
    /// <summary>Empty means every active member may buy. Otherwise only members of these tiers.</summary>
    public List<Guid> AllowedTierIds { get; set; } = [];

    /// <summary>Within its sales window: from <see cref="SalesStartAt"/> (if set) until <see cref="SalesEndAt"/> (if set).</summary>
    public bool IsOnSale(DateTime now) => (SalesStartAt is null || SalesStartAt <= now) && (SalesEndAt is null || SalesEndAt > now);
}
