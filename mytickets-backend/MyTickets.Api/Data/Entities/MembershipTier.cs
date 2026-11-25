namespace MyTickets.Api.Data;

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
