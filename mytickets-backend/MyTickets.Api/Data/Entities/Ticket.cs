namespace MyTickets.Api.Data;

public class Ticket
{
    public Guid Id { get; set; }
    public Guid TicketTypeId { get; set; }
    public TicketType TicketType { get; set; } = null!;
    public Guid EventId { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    /// <summary>Secret shown as the QR code.</summary>
    public required string Code { get; set; }
    public TicketStatus Status { get; set; }
    public int PricePaidCents { get; set; }
    public Guid? PaymentId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? CheckedInAt { get; set; }
    public Guid? CheckedInByUserId { get; set; }
}

public enum TicketStatus { Reserved, Valid, CheckedIn, Cancelled }
