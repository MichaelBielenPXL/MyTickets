using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;

namespace MyTickets.Api.Services;

/// <summary>The door: letting people in on their tickets, and opening and closing an event.</summary>
public class DoorService(AppDbContext db, TimeProvider clock)
{
    /// <summary>Who came in, on which ticket, and how many more tickets they still have for tonight.</summary>
    public record CheckIn(string Name, string TicketType, int Remaining);

    /// <summary>
    /// Lets someone in: by the ticket's QR code, their member QR code, or the card of the person who bought it.
    /// Uses their first unused ticket; atomic, so the same ticket scanned at two doors at once only gets in once.
    /// </summary>
    public async Task<CheckIn> CheckInAsync(Guid organisationId, Guid eventId, string? code, string? cardUid, Guid staffId)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var ev = await db.Events.AsNoTracking().FirstOrDefaultAsync(e => e.Id == eventId && e.OrganisationId == organisationId)
            ?? throw AppProblem.NotFound("Event not found.");
        switch (ev.Status(now))
        {
            case EventStatus.Upcoming:
                throw AppProblem.Conflict($"The doors of {ev.Name} aren't open yet. Open them to start checking people in.");
            case EventStatus.Closed:
                throw AppProblem.Conflict($"{ev.Name} is closed. Reopen it to check people in.");
        }

        var found = await (await TicketsShownAsync(eventId, code, cardUid)).AsNoTracking()
            .Where(t => t.Status == TicketStatus.Valid || t.Status == TicketStatus.CheckedIn)
            .OrderBy(t => t.Status == TicketStatus.Valid ? 0 : 1).ThenBy(t => t.CreatedAt)
            .Select(t => new { t.Id, t.Status, t.CheckedInAt, Name = t.User.DisplayName, TicketType = t.TicketType.Name })
            .ToListAsync();
        if (found.Count == 0) throw AppProblem.NotFound("No ticket for this event.");

        foreach (var ticket in found.Where(t => t.Status == TicketStatus.Valid))
        {
            var rows = await db.Tickets.Where(t => t.Id == ticket.Id && t.Status == TicketStatus.Valid)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.Status, TicketStatus.CheckedIn)
                    .SetProperty(t => t.CheckedInAt, now).SetProperty(t => t.CheckedInByUserId, staffId));
            if (rows == 1) return new CheckIn(ticket.Name, ticket.TicketType, found.Count(t => t.Status == TicketStatus.Valid) - 1);
        }
        throw new AppProblem(409, "Already checked in.", details: new Dictionary<string, object?>
        {
            ["name"] = found[0].Name, ["checkedInAt"] = found.Max(t => t.CheckedInAt),
        });
    }

    /// <summary>The event's tickets the scanned code or tapped card points at.</summary>
    private async Task<IQueryable<Ticket>> TicketsShownAsync(Guid eventId, string? code, string? cardUid)
    {
        var tickets = db.Tickets.Where(t => t.EventId == eventId);
        if (MemberPasses.Normalise(code) is { } passCode)
        {
            // A member's QR code: let them in on their own ticket, as if they tapped their card.
            var userId = await db.Memberships.AsNoTracking().Where(m => m.PassCode == passCode).Select(m => (Guid?)m.UserId).FirstOrDefaultAsync()
                ?? throw AppProblem.NotFound("This member code is not known here.");
            return tickets.Where(t => t.UserId == userId);
        }
        if (!string.IsNullOrWhiteSpace(code))
        {
            var ticketCode = code.Trim().ToUpperInvariant();
            return tickets.Where(t => t.Code == ticketCode);
        }
        if (string.IsNullOrWhiteSpace(cardUid)) throw AppProblem.BadRequest("Scan a ticket or tap a card.");
        var card = await CardLookup.FindAsync(db, cardUid) ?? throw AppProblem.NotFound("This card is not known here.");
        if (card.Wallet is null) throw AppProblem.NotFound("This card isn't linked to anyone yet.");
        if (card.Blocked) throw AppProblem.Forbidden("This card is blocked.");
        var ownerId = card.Wallet.UserId;
        return tickets.Where(t => t.UserId == ownerId);
    }

    /// <summary>
    /// Opens the doors now, also before the start time, or opens a closed event again. A past end time is dropped,
    /// so the event stays open until it is closed; without an end time a reopened event runs a day from now.
    /// </summary>
    public async Task<EventStatus> OpenAsync(Guid organisationId, Guid eventId)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var ev = await FindAsync(organisationId, eventId);
        ev.ClosedAt = null;
        if (ev.StartsAt > now || ev.Status(now) == EventStatus.Closed) ev.OpenedAt = now;
        if (ev.EndsAt <= now) ev.EndsAt = null;
        if (ev.EndsAt is null && ev.StartsAt + Event.OpenWithoutEndTime <= now) ev.EndsAt = now + Event.OpenWithoutEndTime;
        await db.SaveChangesAsync();
        return ev.Status(now);
    }

    /// <summary>Closes the event: the door stops letting people in and ticket sales stop.</summary>
    public async Task<EventStatus> CloseAsync(Guid organisationId, Guid eventId)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var ev = await FindAsync(organisationId, eventId);
        ev.ClosedAt ??= now;
        await db.SaveChangesAsync();
        return ev.Status(now);
    }

    private async Task<Event> FindAsync(Guid organisationId, Guid eventId) =>
        await db.Events.FirstOrDefaultAsync(e => e.Id == eventId && e.OrganisationId == organisationId)
        ?? throw AppProblem.NotFound("Event not found.");
}
