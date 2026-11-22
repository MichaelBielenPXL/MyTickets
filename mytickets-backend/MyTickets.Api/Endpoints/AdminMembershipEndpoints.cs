using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services;
using static MyTickets.Api.Endpoints.AdminInput;

namespace MyTickets.Api.Endpoints;

/// <summary>Manage: membership types, the members on them, and requests for types that need approval.</summary>
public static class AdminMembershipEndpoints
{
    public record TierRequest(string? Name, string? Description, int PriceCents, DateOnly? EndsOn, bool IsPublic,
        string? InviteCode, int TicketDiscountPercent, int DrinkDiscountPercent, bool Archived, bool RequiresApproval);
    public record MemberRequest(OrgRole Role, Guid TierId, DateTime? ExpiresAt);

    public static void MapAdminMemberships(this RouteGroupBuilder admin)
    {
        // ---- Membership types ----
        admin.MapPut("/tiers/order", async (OrderRequest req, HttpContext http, AppDbContext db) =>
        {
            var orgId = http.Org().Org.Id;
            var tiers = await db.MembershipTiers.Where(t => t.OrganisationId == orgId).ToListAsync();
            if (Reorder(tiers, req.Ids, t => t.Id, (t, i) => t.SortOrder = i) is { } error) return error;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        admin.MapGet("/tiers", async (HttpContext http, AppDbContext db) =>
        {
            var org = http.Org().Org;
            var counts = await db.Memberships.Where(m => m.OrganisationId == org.Id).GroupBy(m => m.TierId)
                .Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(g => g.Key, g => g.Count);
            var tiers = await db.MembershipTiers.AsNoTracking().Where(t => t.OrganisationId == org.Id)
                .OrderBy(t => t.SortOrder).ThenBy(t => t.PriceCents).ThenBy(t => t.Name).ToListAsync();
            return Results.Ok(tiers.Select(t => new
            {
                t.Id, t.Name, t.Description, t.PriceCents, t.EndsOn, t.IsPublic, t.InviteCode, t.RequiresApproval,
                t.TicketDiscountPercent, t.DrinkDiscountPercent, t.Archived, Members = counts.GetValueOrDefault(t.Id),
            }));
        });

        admin.MapPost("/tiers", async (TierRequest req, HttpContext http, AppDbContext db, IConfiguration config, TimeProvider clock) =>
        {
            var orgId = http.Org().Org.Id;
            // A new membership goes at the end of the list.
            var last = await db.MembershipTiers.Where(t => t.OrganisationId == orgId).MaxAsync(t => (int?)t.SortOrder) ?? 0;
            var tier = new MembershipTier { Id = Guid.NewGuid(), OrganisationId = orgId, Name = "", SortOrder = last + 1 };
            if (await ApplyAsync(tier, req, db, MembershipService.LocalZone(config), clock.GetUtcNow().UtcDateTime) is { } error) return error;
            db.MembershipTiers.Add(tier);
            await db.SaveChangesAsync();
            return Results.Ok(new { tier.Id });
        });

        admin.MapPut("/tiers/{id:guid}", async (Guid id, TierRequest req, HttpContext http, AppDbContext db, MembershipService memberships,
            IConfiguration config, TimeProvider clock) =>
        {
            var orgId = http.Org().Org.Id;
            var tier = await db.MembershipTiers.FirstOrDefaultAsync(t => t.Id == id && t.OrganisationId == orgId);
            if (tier is null) return Http.Error(404, "Membership type not found.");
            var oldExpiry = tier.ExpiresAt(MembershipService.LocalZone(config));
            if (await ApplyAsync(tier, req, db, MembershipService.LocalZone(config), clock.GetUtcNow().UtcDateTime) is { } error) return error;
            await using var tx = await db.Database.BeginTransactionAsync();
            await db.SaveChangesAsync();
            await memberships.MoveEndDateAsync(tier, oldExpiry);
            await tx.CommitAsync();
            return Results.NoContent();
        });

        // ---- Members ----
        admin.MapGet("/members", async (HttpContext http, AppDbContext db) =>
        {
            var orgId = http.Org().Org.Id;
            var members = await (
                from m in db.Memberships.AsNoTracking()
                where m.OrganisationId == orgId
                join w in db.Wallets on new { m.UserId, m.OrganisationId } equals new { w.UserId, w.OrganisationId } into ws
                from w in ws.DefaultIfEmpty()
                orderby m.User.DisplayName
                select new
                {
                    m.Id, m.User.DisplayName, m.User.Email, m.Role, m.TierId, Tier = m.Tier.Name, m.JoinedAt, m.ExpiresAt,
                    BalanceCents = w == null ? 0 : w.BalanceCents,
                    ExtraCardAllowed = w != null && w.ExtraCardAllowed,
                    m.User.FirstName, m.User.LastName, m.User.Phone, m.User.Street, m.User.PostalCode, m.User.City,
                    m.User.School, m.User.Faculty, m.User.StudyYear,
                }).ToListAsync();
            return Results.Ok(members);
        });

        // An admin correcting a member's details, with the same checks as the member's own My details.
        admin.MapPut("/members/{id:guid}/profile", async (Guid id, ProfileFields.Values values, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var orgId = http.Org().Org.Id;
            var userId = await db.Memberships.Where(m => m.Id == id && m.OrganisationId == orgId).Select(m => (Guid?)m.UserId).FirstOrDefaultAsync();
            if (userId is null) return Http.Error(404, "Member not found.");
            var modes = ProfileFields.Read(await db.Organisations.AsNoTracking().FirstAsync());
            if (ProfileFields.Problem(values, modes) is { } problem) return Http.Error(400, problem);
            var user = await db.Users.FirstAsync(u => u.Id == userId);
            ProfileFields.Apply(user, values, modes, clock.GetUtcNow().UtcDateTime);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        admin.MapPut("/members/{id:guid}", async (Guid id, MemberRequest req, HttpContext http, AppDbContext db, MembershipService memberships) =>
        {
            var orgId = http.Org().Org.Id;
            var member = await db.Memberships.FirstOrDefaultAsync(m => m.Id == id && m.OrganisationId == orgId);
            if (member is null) return Http.Error(404, "Member not found.");
            if (!Enum.IsDefined(req.Role)) return Http.Error(400, "Unknown role.");
            var tier = await db.MembershipTiers.FirstOrDefaultAsync(t => t.Id == req.TierId && t.OrganisationId == orgId);
            if (tier is null) return Http.Error(400, "Unknown membership type.");
            if (await memberships.ChangeAsync(member, tier, req.Role, Http.Utc(req.ExpiresAt)) is { } conflict) return Http.Error(409, conflict);
            return Results.NoContent();
        });

        // ---- Requests for memberships that need approval ----
        admin.MapGet("/requests", async (AppDbContext db) =>
            Results.Ok(await db.MembershipRequests.AsNoTracking()
                .Where(r => r.Status == RequestStatus.Pending || r.Status == RequestStatus.Approved)
                .OrderBy(r => r.Status).ThenBy(r => r.CreatedAt)
                .Select(r => new
                {
                    r.Id, r.Status, r.CreatedAt, r.TierId, Tier = r.Tier.Name, PriceCents = r.Tier.PriceCents,
                    r.User.DisplayName, r.User.Email, r.User.FirstName, r.User.LastName, r.User.Phone, r.User.Street,
                    r.User.PostalCode, r.User.City, r.User.School, r.User.Faculty, r.User.StudyYear,
                }).ToListAsync()));

        // Approving a free membership starts it straight away; a paid one waits for the member to pay.
        admin.MapPost("/requests/{id:guid}/approve", async (Guid id, HttpContext http, AppDbContext db, MembershipService memberships, TimeProvider clock) =>
        {
            var request = await db.MembershipRequests.Include(r => r.Tier).FirstOrDefaultAsync(r => r.Id == id && r.Status == RequestStatus.Pending);
            if (request is null) return Http.Error(404, "This request was already handled.");
            request.Status = RequestStatus.Approved;
            request.DecidedAt = clock.GetUtcNow().UtcDateTime;
            request.DecidedByUserId = http.User.UserId();
            await using var tx = await db.Database.BeginTransactionAsync();
            await db.SaveChangesAsync();
            if (request.Tier.PriceCents == 0) await memberships.ApplyTierAsync(request.UserId, http.Org().Org.Id, request.Tier);
            await tx.CommitAsync();
            return Results.Ok(new { Started = request.Tier.PriceCents == 0 });
        });

        admin.MapPost("/requests/{id:guid}/reject", async (Guid id, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var rows = await db.MembershipRequests.Where(r => r.Id == id && (r.Status == RequestStatus.Pending || r.Status == RequestStatus.Approved))
                .ExecuteUpdateAsync(u => u.SetProperty(r => r.Status, RequestStatus.Rejected)
                    .SetProperty(r => r.DecidedAt, clock.GetUtcNow().UtcDateTime).SetProperty(r => r.DecidedByUserId, http.User.UserId()));
            return rows == 0 ? Http.Error(404, "This request was already handled.") : Results.NoContent();
        });
    }

    private static async Task<IResult?> ApplyAsync(MembershipTier tier, TierRequest req, AppDbContext db, TimeZoneInfo zone, DateTime now)
    {
        if (BadName(req.Name)) return Http.Error(400, "Give the membership type a name.");
        if (BadPrice(req.PriceCents)) return Http.Error(400, "Invalid price.");
        // A date in the past is only allowed when it is already the date (an admin editing an ended type's name).
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(now, zone));
        if (req.EndsOn is { } endsOn && endsOn < today && endsOn != tier.EndsOn)
            return Http.Error(400, "Choose an end date that is today or later.");
        if (req.EndsOn is { } far && far > today.AddYears(10)) return Http.Error(400, "Choose an end date within the next ten years.");
        if (BadPercent(req.TicketDiscountPercent) || BadPercent(req.DrinkDiscountPercent)) return Http.Error(400, "A discount is between 0 and 100 percent.");
        var code = string.IsNullOrWhiteSpace(req.InviteCode) ? null : req.InviteCode.Trim();
        if (code is { Length: < 4 or > 40 }) return Http.Error(400, "An invite code is 4 to 40 characters.");
        if (!req.IsPublic && code is null && !req.Archived)
            code = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(4));
        if (code is not null && await db.MembershipTiers.AnyAsync(t => t.OrganisationId == tier.OrganisationId && t.Id != tier.Id && t.InviteCode == code))
            return Http.Error(409, "Another membership type already uses this invite code.");
        // Archiving only stops new people joining; existing members keep the type.
        tier.Name = req.Name!.Trim();
        tier.Description = req.Description?.Trim() ?? "";
        tier.PriceCents = req.PriceCents;
        tier.EndsOn = req.EndsOn;
        tier.IsPublic = req.IsPublic;
        tier.InviteCode = code;
        tier.TicketDiscountPercent = req.TicketDiscountPercent;
        tier.DrinkDiscountPercent = req.DrinkDiscountPercent;
        tier.Archived = req.Archived;
        tier.RequiresApproval = req.RequiresApproval;
        return null;
    }
}
