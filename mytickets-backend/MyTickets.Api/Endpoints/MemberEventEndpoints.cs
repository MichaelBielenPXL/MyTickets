using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

/// <summary>An event's page for a member, with their own prices, and ordering tickets (see <see cref="TicketOrderService"/>).</summary>
public static class MemberEventEndpoints
{
    public record OrderRequest(List<TicketOrderService.Item>? Items, string? PayWith);

    public static void MapMemberEvents(this RouteGroupBuilder org)
    {
        org.MapGet("/events/{eventId:guid}", async (Guid eventId, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var (o, membership) = http.Org();
            var userId = http.User.UserId();
            var now = clock.GetUtcNow().UtcDateTime;
            var ev = await db.Events.AsNoTracking().Include(e => e.TicketTypes)
                .FirstOrDefaultAsync(e => e.Id == eventId && e.OrganisationId == o.Id && e.Published);
            if (ev is null) return Http.Error(404, "Event not found.");
            var owned = await db.Tickets.Where(t => t.EventId == ev.Id && t.UserId == userId && t.Status != TicketStatus.Cancelled)
                .GroupBy(t => t.TicketTypeId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(g => g.Key, g => g.Count);
            var active = membership?.IsActive(now) == true;
            var discount = active ? membership!.Tier.TicketDiscountPercent : 0;
            return Results.Ok(new
            {
                ev.Id, ev.Name, ev.Description, ev.Location, ev.StartsAt, ev.EndsAt, ImageUrl = Images.Url(ev.ImageKey),
                Status = ev.Status(now),
                TicketTypes = ev.TicketTypes.OrderBy(t => t.PriceCents).ThenBy(t => t.Name).Select(t => new
                {
                    t.Id, t.Name, t.PriceCents, YourPriceCents = Prices.Discounted(t.PriceCents, discount),
                    Available = t.Capacity - t.Sold, t.MaxPerUser, t.SalesStartAt, t.SalesEndAt,
                    OnSale = t.IsOnSale(now) && ev.Status(now) != EventStatus.Closed,
                    AllowedForYou = active && (t.AllowedTierIds.Count == 0 || t.AllowedTierIds.Contains(membership!.TierId)),
                    MembersOnly = t.AllowedTierIds.Count > 0,
                    Owned = owned.GetValueOrDefault(t.Id),
                }),
            });
        });

        org.MapPost("/events/{eventId:guid}/order", async (Guid eventId, OrderRequest req, HttpContext http, TicketOrderService orders) =>
        {
            var (organisation, membership) = http.Org();
            return Results.Ok(await orders.OrderAsync(organisation, membership, http.User.UserId(), eventId, req.Items, req.PayWith == "wallet"));
        });
    }
}
