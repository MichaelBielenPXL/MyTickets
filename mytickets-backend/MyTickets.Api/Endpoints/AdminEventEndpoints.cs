using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services;
using static MyTickets.Api.Endpoints.AdminInput;

namespace MyTickets.Api.Endpoints;

/// <summary>Manage: events and the tickets sold for them.</summary>
public static class AdminEventEndpoints
{
    public record EventRequest(string? Name, string? Description, string? Location, DateTime StartsAt, DateTime? EndsAt, bool Published, string? ImageKey);
    public record TicketTypeRequest(string? Name, int PriceCents, int Capacity, int MaxPerUser, DateTime? SalesStartAt,
        DateTime? SalesEndAt, List<Guid>? AllowedTierIds);

    public static void MapAdminEvents(this RouteGroupBuilder admin)
    {
        // ---- Events and their tickets ----
        admin.MapGet("/events", async (HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var now = clock.GetUtcNow().UtcDateTime;
            var orgId = http.Org().Org.Id;
            var checkedIn = await db.Tickets.Where(t => t.TicketType.Event.OrganisationId == orgId && t.Status == TicketStatus.CheckedIn)
                .GroupBy(t => t.TicketTypeId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(g => g.Key, g => g.Count);
            var events = await db.Events.AsNoTracking().Include(e => e.TicketTypes).Where(e => e.OrganisationId == orgId)
                .OrderByDescending(e => e.StartsAt).ToListAsync();
            return Results.Ok(events.Select(e => new
            {
                e.Id, e.Name, e.Description, e.Location, e.StartsAt, e.EndsAt, e.Published, e.ImageKey, ImageUrl = Images.Url(e.ImageKey),
                Status = e.Status(now),
                TicketTypes = e.TicketTypes.OrderBy(t => t.PriceCents).ThenBy(t => t.Name).Select(t => new
                {
                    t.Id, t.Name, t.PriceCents, t.Capacity, t.Sold, t.MaxPerUser, t.SalesStartAt, t.SalesEndAt, t.AllowedTierIds,
                    CheckedIn = checkedIn.GetValueOrDefault(t.Id),
                }),
            }));
        });

        admin.MapPost("/events", async (EventRequest req, HttpContext http, AppDbContext db) =>
        {
            var ev = new Event { Id = Guid.NewGuid(), OrganisationId = http.Org().Org.Id, Name = "" };
            if (Apply(ev, req) is { } error) return error;
            db.Events.Add(ev);
            await db.SaveChangesAsync();
            return Results.Ok(new { ev.Id });
        });

        admin.MapPut("/events/{id:guid}", async (Guid id, EventRequest req, HttpContext http, AppDbContext db) =>
        {
            var orgId = http.Org().Org.Id;
            var ev = await db.Events.FirstOrDefaultAsync(e => e.Id == id && e.OrganisationId == orgId);
            if (ev is null) return Http.Error(404, "Event not found.");
            if (Apply(ev, req) is { } error) return error;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        admin.MapPost("/events/{id:guid}/ticket-types", async (Guid id, TicketTypeRequest req, HttpContext http, AppDbContext db) =>
        {
            var orgId = http.Org().Org.Id;
            if (!await db.Events.AnyAsync(e => e.Id == id && e.OrganisationId == orgId)) return Http.Error(404, "Event not found.");
            var type = new TicketType { Id = Guid.NewGuid(), EventId = id, Name = "" };
            if (await ApplyAsync(type, req, orgId, db) is { } error) return error;
            db.TicketTypes.Add(type);
            await db.SaveChangesAsync();
            return Results.Ok(new { type.Id });
        });

        admin.MapPut("/ticket-types/{id:guid}", async (Guid id, TicketTypeRequest req, HttpContext http, AppDbContext db) =>
        {
            var orgId = http.Org().Org.Id;
            if (!await db.TicketTypes.AnyAsync(t => t.Id == id && t.Event.OrganisationId == orgId)) return Http.Error(404, "Ticket not found.");
            var probe = new TicketType { Id = id, Name = "" };
            if (await ApplyAsync(probe, req, orgId, db) is { } error) return error;
            // Sold is deliberately left out and capacity is guarded in the WHERE, so an edit made
            // while tickets are selling can neither overwrite the count nor drop below it.
            var rows = await db.TicketTypes.Where(t => t.Id == id && t.Sold <= probe.Capacity).ExecuteUpdateAsync(s => s
                .SetProperty(t => t.Name, probe.Name).SetProperty(t => t.PriceCents, probe.PriceCents)
                .SetProperty(t => t.Capacity, probe.Capacity).SetProperty(t => t.MaxPerUser, probe.MaxPerUser)
                .SetProperty(t => t.SalesStartAt, probe.SalesStartAt).SetProperty(t => t.SalesEndAt, probe.SalesEndAt)
                .SetProperty(t => t.AllowedTierIds, probe.AllowedTierIds));
            return rows == 0 ? Http.Error(409, "You can't set the number of tickets below what is already sold.") : Results.NoContent();
        });
    }

    private static IResult? Apply(Event ev, EventRequest req)
    {
        if (BadName(req.Name)) return Http.Error(400, "Give the event a name.");
        var starts = Http.Utc(req.StartsAt);
        var ends = Http.Utc(req.EndsAt);
        if (starts.Year < 2000) return Http.Error(400, "Choose when the event starts.");
        if (ends <= starts) return Http.Error(400, "The event can't end before it starts.");
        if (req.ImageKey is not null && !Images.BelongsTo(req.ImageKey, ev.OrganisationId)) return Http.Error(400, "Upload the picture again.");
        ev.Name = req.Name!.Trim();
        ev.Description = req.Description?.Trim() ?? "";
        ev.Location = req.Location?.Trim() ?? "";
        ev.StartsAt = starts;
        ev.EndsAt = ends;
        ev.Published = req.Published;
        ev.ImageKey = req.ImageKey;
        return null;
    }

    private static async Task<IResult?> ApplyAsync(TicketType type, TicketTypeRequest req, Guid orgId, AppDbContext db)
    {
        if (BadName(req.Name)) return Http.Error(400, "Give the ticket a name.");
        if (BadPrice(req.PriceCents)) return Http.Error(400, "Invalid price.");
        if (req.Capacity is < 0 or > 1_000_000) return Http.Error(400, "Invalid number of tickets.");
        if (req.MaxPerUser is < 1 or > 100) return Http.Error(400, "Tickets per person must be between 1 and 100.");
        var start = Http.Utc(req.SalesStartAt);
        var end = Http.Utc(req.SalesEndAt);
        if (start is not null && end <= start) return Http.Error(400, "Sales can't end before they start.");
        var tiers = (req.AllowedTierIds ?? []).Distinct().ToList();
        if (tiers.Count > 0 && await db.MembershipTiers.CountAsync(t => t.OrganisationId == orgId && tiers.Contains(t.Id)) != tiers.Count)
            return Http.Error(400, "Unknown membership type.");
        type.Name = req.Name!.Trim();
        type.PriceCents = req.PriceCents;
        type.Capacity = req.Capacity;
        type.MaxPerUser = req.MaxPerUser;
        type.SalesStartAt = start;
        type.SalesEndAt = end;
        type.AllowedTierIds = tiers;
        return null;
    }
}
