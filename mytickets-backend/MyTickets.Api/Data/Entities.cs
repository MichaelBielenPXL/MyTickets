namespace MyTickets.Api.Data;

// All money is stored as whole euro cents.

public enum OrgRole { Member, Staff, Admin }
public enum TicketStatus { Reserved, Valid, CheckedIn, Cancelled }
public enum PaymentPurpose { TopUp, Tickets, Membership }
public enum PaymentStatus { Pending, Paid, Failed }
public enum WalletTxType { TopUp, CashTopUp, Purchase, TicketPurchase, Adjustment, Return }

public class User
{
    public Guid Id { get; set; }
    public required string Email { get; set; }
    public required string DisplayName { get; set; }
    public string PasswordHash { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public class Organisation
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public required string Slug { get; set; }
    public string Description { get; set; } = "";
    /// <summary>Key of the logo in the image store, if one was uploaded.</summary>
    public string? LogoKey { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>A way of belonging to an organisation: free or paid, open to everyone or invite-only.</summary>
public class MembershipTier
{
    public Guid Id { get; set; }
    public Guid OrganisationId { get; set; }
    public required string Name { get; set; }
    public string Description { get; set; } = "";
    public int PriceCents { get; set; }
    /// <summary>How long a membership lasts once bought. Null means it never expires.</summary>
    public int? DurationDays { get; set; }
    /// <summary>Public tiers can be joined by anyone. Non-public tiers need the invite code, or an admin assigns them.</summary>
    public bool IsPublic { get; set; } = true;
    public string? InviteCode { get; set; }
    public int TicketDiscountPercent { get; set; }
    public int DrinkDiscountPercent { get; set; }
    public bool Archived { get; set; }
}

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

    public bool IsActive(DateTime now) => ExpiresAt is null || ExpiresAt > now;
}

public class Wallet
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid OrganisationId { get; set; }
    public int BalanceCents { get; set; }
}

public class WalletTransaction
{
    public Guid Id { get; set; }
    public Guid WalletId { get; set; }
    /// <summary>Positive adds credit, negative spends it.</summary>
    public int AmountCents { get; set; }
    public WalletTxType Type { get; set; }
    public string Description { get; set; } = "";
    public Guid? PerformedByUserId { get; set; }
    public Guid? PaymentId { get; set; }
    /// <summary>Set by the staff app so a retried request can never charge twice.</summary>
    public Guid? RequestId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class NfcCard
{
    public Guid Id { get; set; }
    /// <summary>Card serial number, upper-case hex without separators.</summary>
    public required string Uid { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string Label { get; set; } = "";
    public bool Blocked { get; set; }
    public DateTime LinkedAt { get; set; }
}

public class Event
{
    public Guid Id { get; set; }
    public Guid OrganisationId { get; set; }
    public required string Name { get; set; }
    public string Description { get; set; } = "";
    public string Location { get; set; } = "";
    public string? ImageKey { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    public bool Published { get; set; }
    public List<TicketType> TicketTypes { get; set; } = [];
}

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
}

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

public class Product
{
    public Guid Id { get; set; }
    public Guid OrganisationId { get; set; }
    public required string Name { get; set; }
    public int PriceCents { get; set; }
    public bool Active { get; set; } = true;
    public int SortOrder { get; set; }
    /// <summary>A deposit, such as a reusable cup: staff can take it back and the price returns to the wallet.</summary>
    public bool Returnable { get; set; }
}

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
    public string Provider { get; set; } = "";
    public string? ProviderReference { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}
