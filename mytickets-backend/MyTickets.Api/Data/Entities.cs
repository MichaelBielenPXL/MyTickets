namespace MyTickets.Api.Data;

// All money is stored as whole euro cents.

/// <summary>
/// Stored by name, so roles can be added anywhere. Everyone from Barman up works at the event; what each
/// may do there is in <see cref="StaffTasks"/>. Only admins manage the organisation.
/// </summary>
public enum OrgRole { Member, Barman, Doorman, Staff, Admin }

/// <summary>The jobs at an event, each opened up to some roles.</summary>
public enum StaffTask { Bar, Door, CashTopUp, CheckCard, MemberInfo }

public static class StaffTasks
{
    /// <summary>
    /// Barmen work the bar, doormen the door; staff and admins do everything. All of them can check a card;
    /// only staff and admins look up members' details and history.
    /// </summary>
    public static bool Can(OrgRole role, StaffTask task) => task switch
    {
        StaffTask.Bar => role is OrgRole.Barman or OrgRole.Staff or OrgRole.Admin,
        StaffTask.Door => role is OrgRole.Doorman or OrgRole.Staff or OrgRole.Admin,
        StaffTask.CashTopUp => role is OrgRole.Staff or OrgRole.Admin,
        StaffTask.CheckCard => role is not OrgRole.Member,
        StaffTask.MemberInfo => role is OrgRole.Staff or OrgRole.Admin,
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

    /// <summary>When they agreed to the terms of service and privacy policy, and which version (see <see cref="Services.Legal"/>).</summary>
    public DateTime? TermsAcceptedAt { get; set; }
    public string? TermsVersion { get; set; }
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
    /// <summary>How its printed cards look, see <see cref="Services.CardDesigns"/>. Empty: the defaults.</summary>
    public string CardDesignJson { get; set; } = "";
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
    /// <summary>What the member's QR code (on the home page and in Apple or Google Wallet) holds. Made the first time it is shown.</summary>
    public string? PassCode { get; set; }

    public bool IsActive(DateTime now) => ExpiresAt is null || ExpiresAt > now;
}

/// <summary>
/// One stretch on one membership type: the history behind <see cref="Membership"/>, which only holds the current one.
/// A new row each time someone joins (again, say the next academic year) or moves to another type.
/// </summary>
public class MembershipPeriod
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    /// <summary>No foreign key: the history stays when a membership type is deleted later.</summary>
    public Guid TierId { get; set; }
    /// <summary>The type's name back then, so renaming "2025-2026" to "2026-2027" does not rewrite history.</summary>
    public required string TierName { get; set; }
    public DateTime StartedAt { get; set; }
    /// <summary>When it stopped or will stop. Null: it never ends.</summary>
    public DateTime? EndsAt { get; set; }
}

public class Wallet
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid OrganisationId { get; set; }
    public int BalanceCents { get; set; }
    /// <summary>An admin let this member link one more card within the year (a lost card); used up by that link.</summary>
    public bool ExtraCardAllowed { get; set; }
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

/// <summary>
/// A card the organisation issued: made in Manage, written to a chip, then claimed by a member, whose wallet it
/// pays from. Cards linked before cards were issued have no link code.
/// </summary>
public class NfcCard
{
    public Guid Id { get; set; }
    /// <summary>The card's number, 1, 2, 3… within the organisation. Not printed on it, and never used to find it.</summary>
    public int Number { get; set; }
    /// <summary>The code in the card's link and printed QR; see <see cref="Services.CardCodes"/>.</summary>
    public string? Code { get; set; }
    /// <summary>The chip's serial number, upper-case hex without separators; null until the card is written.</summary>
    public string? Uid { get; set; }
    /// <summary>The wallet the card pays from; null while nobody has claimed it.</summary>
    public Guid? WalletId { get; set; }
    public Wallet? Wallet { get; set; }
    public string Label { get; set; } = "";
    public bool Blocked { get; set; }
    /// <summary>The chip was made read-only after writing, so its link can't be changed.</summary>
    public bool Locked { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? WrittenAt { get; set; }
    public DateTime? LinkedAt { get; set; }
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
    /// <summary>Set when staff open the doors before the start time.</summary>
    public DateTime? OpenedAt { get; set; }
    /// <summary>Set when staff close the event: no more check-ins or ticket sales.</summary>
    public DateTime? ClosedAt { get; set; }
    public List<TicketType> TicketTypes { get; set; } = [];

    /// <summary>
    /// An event without an end time stays open until someone closes it, but never longer than this after its
    /// start: a forgotten event shouldn't sell tickets for ever.
    /// </summary>
    public static readonly TimeSpan OpenWithoutEndTime = TimeSpan.FromHours(24);

    /// <summary>Upcoming until it starts (or is opened early), open until it ends (or is closed), then closed.</summary>
    public EventStatus Status(DateTime now) =>
        ClosedAt is not null || (EndsAt ?? StartsAt + OpenWithoutEndTime) <= now ? EventStatus.Closed
        : OpenedAt is not null || StartsAt <= now ? EventStatus.Open
        : EventStatus.Upcoming;

    /// <summary><see cref="Status"/> is not Closed, written so the database can do the filtering.</summary>
    public static System.Linq.Expressions.Expression<Func<Event, bool>> NotClosed(DateTime now)
    {
        var startedLongAgo = now - OpenWithoutEndTime;
        return e => e.ClosedAt == null && (e.EndsAt != null ? e.EndsAt > now : e.StartsAt > startedLongAgo);
    }
}

public enum EventStatus { Upcoming, Open, Closed }

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
    /// <summary>For top-ups: the tokens credited once paid, when a deal gives more than one per euro. Null means AmountCents.</summary>
    public int? TokensCents { get; set; }
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
