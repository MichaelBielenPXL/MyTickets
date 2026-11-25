namespace MyTickets.Api.Data;

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
