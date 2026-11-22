namespace MyTickets.Api.Data;

public class Membership
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid OrganisationId { get; set; }
    public Organisation Organisation { get; set; } = null!;
    public Guid TierId { get; set; }
    public MembershipTier Tier { get; set; } = null!;
    public OrgRole Role { get; set; }
    public DateTime JoinedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    /// <summary>What the member's QR code (on the home page and in Apple or Google Wallet) holds. Made the first time it is shown.</summary>
    public string? PassCode { get; set; }

    public bool IsActive(DateTime now) => ExpiresAt is null || ExpiresAt > now;
}
