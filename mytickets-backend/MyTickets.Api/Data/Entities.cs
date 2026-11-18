namespace MyTickets.Api.Data;

// All money is stored as whole euro cents.

/// <summary>
/// Stored by name, so roles can be added anywhere. Everyone from Barman up works at the event; what each
/// may do there is in <see cref="StaffTasks"/>. Only admins manage the organisation.
/// </summary>
public enum OrgRole { Member, Barman, Doorman, Staff, Admin }

/// <summary>The jobs at an event, each opened up to some roles.</summary>
public enum StaffTask { Bar, Door, CashTopUp, CheckCard }

public static class StaffTasks
{
    /// <summary>Barmen work the bar, doormen the door; staff and admins do everything. All of them can check a card.</summary>
    public static bool Can(OrgRole role, StaffTask task) => task switch
    {
        StaffTask.Bar => role is OrgRole.Barman or OrgRole.Staff or OrgRole.Admin,
        StaffTask.Door => role is OrgRole.Doorman or OrgRole.Staff or OrgRole.Admin,
        StaffTask.CashTopUp => role is OrgRole.Staff or OrgRole.Admin,
        StaffTask.CheckCard => role is not OrgRole.Member,
        _ => false,
    };

    public static IEnumerable<StaffTask> For(OrgRole role) => Enum.GetValues<StaffTask>().Where(t => Can(role, t));
}
public enum TicketStatus { Reserved, Valid, CheckedIn, Cancelled }
public enum PaymentPurpose { TopUp, Tickets, Membership }
public enum PaymentStatus { Pending, Paid, Failed }
public enum WalletTxType { TopUp, CashTopUp, Purchase, TicketPurchase, Adjustment, Return }

public class User
{
    public Guid Id { get; set; }
    public required string Email { get; set; }
    /// <summary>What staff see when the card is tapped: first and last name once given, the email's name until then.</summary>
    public required string DisplayName { get; set; }
    public string PasswordHash { get; set; } = "";
    public DateTime CreatedAt { get; set; }

    // ---- The details asked when choosing a membership (which ones, each organisation decides) ----
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Phone { get; set; }
    public string? Street { get; set; }
    public string? PostalCode { get; set; }
    public string? City { get; set; }
    public string? School { get; set; }
    public string? Faculty { get; set; }
    /// <summary>Free text, as people say it: "2nd bachelor", "Master 1".</summary>
    public string? StudyYear { get; set; }
    public DateTime? ProfileUpdatedAt { get; set; }
}

public class Organisation
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public required string Slug { get; set; }
    public string Description { get; set; } = "";
    /// <summary>Key of the logo in the image store, if one was uploaded.</summary>
    public string? LogoKey { get; set; }
    /// <summary>The organisation's own colour as "#rrggbb", used on its pages and member cards. Null: the house colour.</summary>
    public string? BrandColor { get; set; }
    public DateTime CreatedAt { get; set; }
    /// <summary>Which details are asked from members, see <see cref="Services.ProfileFields"/>. Empty: the defaults.</summary>
    public string ProfileFieldsJson { get; set; } = "";
}

/// <summary>A way of belonging to an organisation: free or paid, open to everyone or invite-only.</summary>
public class MembershipTier
{
    public Guid Id { get; set; }
    public Guid OrganisationId { get; set; }
    public required string Name { get; set; }
    public string Description { get; set; } = "";
    public int PriceCents { get; set; }
    /// <summary>
    /// The last day memberships of this type are valid (say, the end of the academic year), whenever
    /// people joined. Null: they never end.
    /// </summary>
    public DateOnly? EndsOn { get; set; }
    /// <summary>Public tiers can be joined by anyone. Non-public tiers need the invite code, or an admin assigns them.</summary>
    public bool IsPublic { get; set; } = true;
    public string? InviteCode { get; set; }
    public int TicketDiscountPercent { get; set; }
    public int DrinkDiscountPercent { get; set; }
    public bool Archived { get; set; }
    /// <summary>Where the admin put it in the list; the same order everywhere memberships are shown.</summary>
    public int SortOrder { get; set; }
    /// <summary>An admin has to approve each person before the membership starts (and before they can pay for it).</summary>
    public bool RequiresApproval { get; set; }

    /// <summary>The moment memberships of this type stop: the end of <see cref="EndsOn"/> on the local clock.</summary>
    public DateTime? ExpiresAt(TimeZoneInfo zone) =>
        EndsOn is { } day ? TimeZoneInfo.ConvertTimeToUtc(day.ToDateTime(TimeOnly.MinValue).AddDays(1), zone) : null;

    public bool HasEnded(DateTime now, TimeZoneInfo zone) => ExpiresAt(zone) is { } end && end <= now;
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
    /// <summary>
    /// For bar sales: the part of the amount that is deposit, positive for cups going out and negative for cups
    /// coming back. Deposit money is held for the guest, not earned, so it is kept apart from the takings.
    /// </summary>
    public int DepositCents { get; set; }
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
    public bool IsDeposit { get; set; }
    /// <summary>For a drink: the deposit (a cup) charged with every one sold, added by the till itself.</summary>
    public Guid? DepositProductId { get; set; }
    /// <summary>The tab it shows under at the till; none puts it under "Other".</summary>
    public Guid? CategoryId { get; set; }
    /// <summary>The tile colour at the till, one of <see cref="ProductColors.All"/>, so bartenders find it at a glance.</summary>
    public string? Color { get; set; }
}

/// <summary>A tab at the bar till (Beer, Soft drinks, Food...), in the order the admin put them.</summary>
public class ProductCategory
{
    public Guid Id { get; set; }
    public Guid OrganisationId { get; set; }
    public required string Name { get; set; }
    public int SortOrder { get; set; }
}

public static class ProductColors
{
    public static readonly string[] All = ["grey", "red", "orange", "yellow", "green", "teal", "blue", "indigo", "purple", "pink"];
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

    // ---- Settling a Stripe payment with the organisation, after it is paid ----
    /// <summary>Stripe's charge for this payment.</summary>
    public string? ChargeId { get; set; }
    /// <summary>What Stripe charged the platform for this payment.</summary>
    public int? StripeFeeCents { get; set; }
    /// <summary>What the platform kept. Never less than <see cref="StripeFeeCents"/> plus the minimum margin.</summary>
    public int? PlatformFeeCents { get; set; }
    /// <summary>The transfer of the rest to the organisation. Null until it is done.</summary>
    public string? TransferId { get; set; }
}


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
}

public enum RequestStatus { Pending, Approved, Rejected, Completed }

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
