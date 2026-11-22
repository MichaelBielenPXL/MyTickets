namespace MyTickets.Api.Data;

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
