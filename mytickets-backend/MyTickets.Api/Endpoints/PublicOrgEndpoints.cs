using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

public static class PublicOrgEndpoints
{
    public record AccountCheckRequest(string? Email);

    public static void MapPublicOrgs(this IEndpointRouteBuilder app)
    {
        var orgs = app.MapGroup("/api/public/orgs");

        orgs.MapGet("/slug-availability", async (string? name, PlatformDbContext platform) =>
        {
            var trimmed = name?.Trim() ?? "";
            if (trimmed.Length is < 2 or > 80)
                return Results.Ok(new { Available = false, Slug = "", Reason = "Use an organisation name between 2 and 80 characters." });

            var slug = OrganisationSlug.FromName(trimmed);
            if (slug.Length == 0)
                return Results.Ok(new { Available = false, Slug = "", Reason = "This name cannot be used for an organisation page." });
            if (OrganisationSlug.IsReserved(slug))
                return Results.Ok(new { Available = false, Slug = slug, Reason = "This page address is reserved." });

            var exists = await platform.Tenants.AnyAsync(t => t.Slug == slug);
            return Results.Ok(new
            {
                Available = !exists,
                Slug = slug,
                Reason = exists ? "This organisation page address is already taken." : null,
            });
        }).RequireRateLimiting("auth");

        // "Enter your email to continue": tells the page whether to ask for the MyTickets password or offer sign-up.
        // This says no more than sign-up already does (which refuses an address that has an account),
        // and it is limited per visitor so it can't be used to test long lists of addresses.
        orgs.MapPost("/{slug}/account-check", async (AccountCheckRequest req, AccountService accounts) =>
        {
            var email = AccountService.Normalise(req.Email);
            if (email.Length is < 5 or > 200 || !email.Contains('@')) return Http.Error(400, "Enter a valid email address.");
            return Results.Ok(new { Exists = await accounts.FindAsync(email) is not null });
        }).RequireRateLimiting("auth");

        orgs.MapGet("/{slug}", async (string slug, AppDbContext db, IConfiguration config, TimeProvider clock) =>
        {
            var organisation = await db.Organisations.AsNoTracking().FirstOrDefaultAsync(o => o.Slug == slug);
            if (organisation is null) return Http.Error(404, "Organisation not found.");

            var now = clock.GetUtcNow().UtcDateTime;
            var tiers = await db.MembershipTiers.AsNoTracking()
                .Where(t => t.OrganisationId == organisation.Id && !t.Archived && t.IsPublic)
                .OrderBy(t => t.SortOrder).ThenBy(t => t.PriceCents).ThenBy(t => t.Name)
                .ToListAsync();
            var zone = MembershipService.LocalZone(config);
            var openTiers = tiers.Where(t => !t.HasEnded(now, zone)).Select(t => new
            {
                t.Id, t.Name, t.Description, t.PriceCents, t.EndsOn, t.IsPublic, t.RequiresApproval,
                t.TicketDiscountPercent, t.DrinkDiscountPercent,
            }).ToList();
            var events = await db.Events.AsNoTracking()
                .Where(e => e.OrganisationId == organisation.Id && e.Published).Where(Event.NotClosed(now))
                .OrderBy(e => e.StartsAt)
                .Select(e => new
                {
                    e.Id, e.Name, e.Location, e.StartsAt, e.EndsAt, e.ImageKey,
                    FromPriceCents = e.TicketTypes.Min(t => (int?)t.PriceCents),
                    SoldOut = e.TicketTypes.Any() && e.TicketTypes.All(t => t.Sold >= t.Capacity),
                }).ToListAsync();

            return Results.Ok(new
            {
                organisation.Slug, organisation.Name, organisation.Description, LogoUrl = Images.Url(organisation.LogoKey),
                organisation.BrandColor,
                Tiers = openTiers,
                HasInviteOnlyTiers = await db.MembershipTiers.AnyAsync(t => t.OrganisationId == organisation.Id && !t.Archived && !t.IsPublic),
                Events = events.Select(e => new { e.Id, e.Name, e.Location, e.StartsAt, e.EndsAt, ImageUrl = Images.Url(e.ImageKey), e.FromPriceCents, e.SoldOut }),
            });
        });

        orgs.MapGet("/{slug}/events/{eventId:guid}", async (string slug, Guid eventId, AppDbContext db, TimeProvider clock) =>
        {
            var organisationId = await db.Organisations.AsNoTracking()
                .Where(o => o.Slug == slug).Select(o => (Guid?)o.Id).FirstOrDefaultAsync();
            if (organisationId is null) return Http.Error(404, "Organisation not found.");

            var now = clock.GetUtcNow().UtcDateTime;
            var ev = await db.Events.AsNoTracking().Include(e => e.TicketTypes)
                .FirstOrDefaultAsync(e => e.Id == eventId && e.OrganisationId == organisationId && e.Published);
            if (ev is null) return Http.Error(404, "Event not found.");

            return Results.Ok(new
            {
                ev.Id, ev.Name, ev.Description, ev.Location, ev.StartsAt, ev.EndsAt, ImageUrl = Images.Url(ev.ImageKey),
                Status = ev.Status(now),
                TicketTypes = ev.TicketTypes.OrderBy(t => t.PriceCents).ThenBy(t => t.Name).Select(t => new
                {
                    t.Id, t.Name, t.PriceCents, YourPriceCents = t.PriceCents,
                    Available = t.Capacity - t.Sold, t.MaxPerUser, t.SalesStartAt, t.SalesEndAt,
                    OnSale = (t.SalesStartAt is null || t.SalesStartAt <= now) && (t.SalesEndAt is null || t.SalesEndAt > now) && ev.Status(now) != EventStatus.Closed,
                    MembersOnly = t.AllowedTierIds.Count > 0,
                }),
            });
        });
    }
}
