using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

/// <summary>
/// Organisations: the list, adding one, and an organisation's page for someone signed in there. What a member does
/// there has its own files: joining (<see cref="JoinEndpoints"/>), events and tickets (<see cref="MemberEventEndpoints"/>),
/// and the wallet (<see cref="WalletEndpoints"/>).
/// </summary>
public static class OrgEndpoints
{
    public record CreateOrgRequest(string? Name, string? Description);

    public static void MapOrgs(this IEndpointRouteBuilder app)
    {
        var orgs = app.MapGroup("/api/orgs").RequireAuthorization();

        // Every organisation, marked with whether this browser is signed in there.
        // Every organisation, marked with whether this account has joined it.
        orgs.MapGet("", async (HttpContext http, AppCache cache, AccountService accounts) =>
        {
            var joined = Sessions.AccountId(http) is { } accountId
                ? (await accounts.RecordsAsync(accountId)).Select(r => r.Tenant.Id).ToHashSet()
                : [];
            var all = await cache.OrganisationsAsync();
            return Results.Ok(all.Select(o => new { o.Slug, o.Name, o.Description, LogoUrl = Images.Url(o.LogoKey), Joined = joined.Contains(o.Id) }));
        });

        // Starting another organisation. It gets its own database; nothing is shared with the account's other ones.
        orgs.MapPost("", async (CreateOrgRequest req, HttpContext http, PlatformDbContext platform, OrganisationProvisioner provisioner,
            AccountService accounts, IConfiguration config) =>
        {
            var owner = Sessions.AccountId(http) is { } accountId ? await accounts.FindAsync(accountId) : null;
            if (owner is null) return Http.Error(401, "Sign in to start an organisation.");
            if (!OrganisationProvisioner.MayCreate(config, owner.Email)) return Http.Error(403, "You are not allowed to create organisations.");
            var name = req.Name?.Trim() ?? "";
            if (name.Length is < 2 or > 80) return Http.Error(400, "Give the organisation a name of 2 to 80 characters.");

            var baseSlug = OrganisationSlug.FromName(name);
            if (baseSlug.Length == 0 || OrganisationSlug.IsReserved(baseSlug))
                return Http.Error(400, "Choose a different organisation name.");

            // A taken address gets a number added. Try again if someone takes our pick in the same instant.
            for (var attempt = 0; attempt < 5; attempt++)
            {
                var slug = baseSlug;
                for (var n = 2; await platform.Tenants.AnyAsync(t => t.Slug == slug); n++) slug = $"{baseSlug}-{n}";
                try
                {
                    var (created, _) = await provisioner.CreateAsync(owner, ownerIsNew: false, name, slug, req.Description?.Trim() ?? "");
                    return Results.Ok(new { created.Slug, created.Name });
                }
                catch (SlugTakenException) { }
            }
            return Http.Error(409, "Could not find a free page address for this name. Try another name.");
        });

        var org = app.MapGroup("/api/orgs/{slug}").RequireOrg(null);

        org.MapGet("", async (HttpContext http, AppDbContext db, IConfiguration config, TimeProvider clock) =>
        {
            var zone = MembershipService.LocalZone(config);
            var (o, membership) = http.Org();
            var now = clock.GetUtcNow().UtcDateTime;
            // Signed in but not joined yet: no record here, so no balance, details or request either.
            var userId = http.User.TryUserId();
            var tiers = await db.MembershipTiers.AsNoTracking()
                .Where(t => t.OrganisationId == o.Id && !t.Archived).OrderBy(t => t.SortOrder).ThenBy(t => t.PriceCents).ThenBy(t => t.Name).ToListAsync();
            var balance = await db.Wallets.Where(w => w.UserId == userId && w.OrganisationId == o.Id)
                .Select(w => (int?)w.BalanceCents).FirstOrDefaultAsync();
            var user = userId is null ? null : await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId);
            var request = await db.MembershipRequests.AsNoTracking().Include(r => r.Tier)
                .Where(r => r.UserId == userId && r.Status != RequestStatus.Completed)
                .OrderByDescending(r => r.CreatedAt).FirstOrDefaultAsync();
            var events = await db.Events.AsNoTracking()
                .Where(e => e.OrganisationId == o.Id && e.Published).Where(Event.NotClosed(now))
                .OrderBy(e => e.StartsAt)
                .Select(e => new
                {
                    e.Id, e.Name, e.Location, e.StartsAt, e.EndsAt, e.ImageKey,
                    FromPriceCents = e.TicketTypes.Min(t => (int?)t.PriceCents),
                    SoldOut = e.TicketTypes.Any() && e.TicketTypes.All(t => t.Sold >= t.Capacity),
                }).ToListAsync();
            return Results.Ok(new
            {
                o.Slug, o.Name, o.Description, LogoUrl = Images.Url(o.LogoKey),
                // The colour lives only in the organisation's own database, not in the shared list the request came through.
                BrandColor = await db.Organisations.Where(x => x.Id == o.Id).Select(x => x.BrandColor).FirstOrDefaultAsync(),
                Membership = membership is null ? null : new
                {
                    membership.Role, membership.TierId, Tier = membership.Tier.Name, membership.ExpiresAt,
                    Active = membership.IsActive(now),
                    membership.Tier.TicketDiscountPercent, membership.Tier.DrinkDiscountPercent,
                },
                BalanceCents = balance,
                // Invite-only and ended tiers stay hidden unless you are already on one.
                Tiers = tiers.Where(t => (t.IsPublic && !t.HasEnded(now, zone)) || t.Id == membership?.TierId).Select(t => new
                {
                    t.Id, t.Name, t.Description, t.PriceCents, t.EndsOn, t.IsPublic, t.RequiresApproval,
                    t.TicketDiscountPercent, t.DrinkDiscountPercent,
                }),
                // An open request for a membership that needs approval: waiting, approved (ready to pay), or turned down.
                Request = request is null ? null : new { request.Id, request.TierId, Tier = request.Tier.Name, request.Status, request.CreatedAt },
                ProfileComplete = user is not null && ProfileFields.IsComplete(user, ProfileFields.Read(await db.Organisations.AsNoTracking().FirstAsync())),
                HasInviteOnlyTiers = tiers.Any(t => !t.IsPublic && !t.HasEnded(now, zone)),
                Events = events.Select(e => new { e.Id, e.Name, e.Location, e.StartsAt, e.EndsAt, ImageUrl = Images.Url(e.ImageKey), e.FromPriceCents, e.SoldOut }),
            });
        });

        org.MapJoin();
        org.MapMemberEvents();
        org.MapWallet();
    }
}
