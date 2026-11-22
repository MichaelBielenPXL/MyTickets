namespace MyTickets.Api.Data;

/// <summary>Someone asking for a membership type that needs an admin's approval.</summary>
public class MembershipRequest
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid TierId { get; set; }
    public MembershipTier Tier { get; set; } = null!;
    /// <summary>Pending until an admin decides; Approved until the membership starts (after paying, if paid); then Completed.</summary>
    public RequestStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? DecidedAt { get; set; }
    public Guid? DecidedByUserId { get; set; }
}

public enum RequestStatus { Pending, Approved, Rejected, Completed }
