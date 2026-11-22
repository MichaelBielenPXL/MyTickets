using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

public static class AdminEndpoints
{
    public record TierRequest(string? Name, string? Description, int PriceCents, DateOnly? EndsOn, bool IsPublic,
        string? InviteCode, int TicketDiscountPercent, int DrinkDiscountPercent, bool Archived, bool RequiresApproval);
    public record MemberRequest(OrgRole Role, Guid TierId, DateTime? ExpiresAt);
    public record EventRequest(string? Name, string? Description, string? Location, DateTime StartsAt, DateTime? EndsAt, bool Published, string? ImageKey);
    public record TopUpDealRequest(int PriceCents, int TokensCents);
    public const int MaxTopUpDeals = 8;
    public record OrganisationRequest(string? Name, string? Description, string? LogoKey, string? BrandColor = null);
    public record TicketTypeRequest(string? Name, int PriceCents, int Capacity, int MaxPerUser, DateTime? SalesStartAt,
        DateTime? SalesEndAt, List<Guid>? AllowedTierIds);
    public record OrderRequest(List<Guid>? Ids);
    public record ProductRequest(string? Name, int PriceCents, bool Active, int SortOrder, bool IsDeposit, Guid? DepositProductId, Guid? CategoryId = null, string? Color = null);
    public record CategoryRequest(string? Name);

    private const int MaxPriceCents = 1_000_000;

    public static void MapAdmin(this IEndpointRouteBuilder app)
    {
        var admin = app.MapGroup("/api/orgs/{slug}/admin").RequireOrg(OrgRole.Admin);

        admin.MapOverview();

        // ---- Top-up deals: the organisation's own prices for tokens ----
        admin.MapGet("/topup-deals", async (HttpContext http, AppDbContext db) =>
        {
            var orgId = http.Org().Org.Id;
            return Results.Ok(await db.TopUpDeals.AsNoTracking().Where(d => d.OrganisationId == orgId).OrderBy(d => d.SortOrder)
                .Select(d => new { d.Id, d.PriceCents, d.TokensCents }).ToListAsync());
        });

        // The whole list at once, in the order members see it. An empty list brings back one token per euro.
        admin.MapPut("/topup-deals", async (List<TopUpDealRequest> req, HttpContext http, AppDbContext db) =>
        {
            var orgId = http.Org().Org.Id;
            if (req.Count > MaxTopUpDeals) return Http.Error(400, $"Offer at most {MaxTopUpDeals} top-ups.");
            foreach (var d in req)
            {
                if (d.PriceCents is < OrgEndpoints.MinTopUpCents or > OrgEndpoints.MaxTopUpCents)
                    return Http.Error(400, $"Each top-up costs between {Http.Euro(OrgEndpoints.MinTopUpCents)} and {Http.Euro(OrgEndpoints.MaxTopUpCents)}.");
                // Generous deals are the point, but a typo shouldn't give away ten times the money.
                if (d.TokensCents < 100 || d.TokensCents > d.PriceCents * 3)
                    return Http.Error(400, "Each top-up gives at least 1 token and at most three times its price.");
            }
            if (req.Select(d => d.PriceCents).Distinct().Count() != req.Count)
                return Http.Error(400, "Two top-ups have the same price. Give each its own.");

            await using var tx = await db.Database.BeginTransactionAsync();
            await db.TopUpDeals.Where(d => d.OrganisationId == orgId).ExecuteDeleteAsync();
            var deals = req.Select((d, i) => new TopUpDeal { Id = Guid.NewGuid(), OrganisationId = orgId, PriceCents = d.PriceCents, TokensCents = d.TokensCents, SortOrder = i }).ToList();
            db.TopUpDeals.AddRange(deals);
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return Results.Ok(deals.Select(d => new { d.Id, d.PriceCents, d.TokensCents }));
        });

        // ---- The organisation itself ----
        // The page address is always the organisation's name, so renaming moves the page to the new name.
        admin.MapGet("/organisation", async (HttpContext http, AppDbContext db) =>
        {
            var id = http.Org().Org.Id;
            // Read from the database, not the cache: this is what the edit form starts from.
            var o = await db.Organisations.AsNoTracking().FirstAsync(x => x.Id == id);
            return Results.Ok(new { o.Slug, o.Name, o.Description, o.LogoKey, LogoUrl = Images.Url(o.LogoKey), o.BrandColor });
        });

        admin.MapPut("/organisation", async (OrganisationRequest req, HttpContext http, AppDbContext db, PlatformDbContext platform, AppCache cache) =>
        {
            var current = http.Org().Org;
            var name = req.Name?.Trim() ?? "";
            if (name.Length is < 2 or > 80) return Http.Error(400, "Give the organisation a name of 2 to 80 characters.");
            var description = req.Description?.Trim() ?? "";
            if (description.Length > 500) return Http.Error(400, "Keep the description under 500 characters.");
            if (req.LogoKey is not null && !Images.BelongsTo(req.LogoKey, current.Id)) return Http.Error(400, "Upload the logo again.");
            var brandColor = string.IsNullOrWhiteSpace(req.BrandColor) ? null : req.BrandColor.Trim().ToLowerInvariant();
            if (brandColor is not null && !BrandColors.IsValid(brandColor)) return Http.Error(400, "Pick a colour like #4f46e5.");
            if (brandColor is not null && !BrandColors.IsReadable(brandColor))
                return Http.Error(400, "White text is hard to read on this colour. Pick a darker one.");

            // Only a real rename moves the page; saving a new description or logo leaves the address alone.
            var slug = current.Slug;
            if (name != current.Name)
            {
                slug = OrganisationSlug.FromName(name);
                if (slug.Length == 0) return Http.Error(400, "This name cannot be used for an organisation page.");
                if (OrganisationSlug.IsReserved(slug)) return Http.Error(400, "This name is reserved. Choose another one.");
                if (slug != current.Slug && await platform.Tenants.AnyAsync(t => t.Slug == slug))
                    return Http.Error(409, "Another organisation already uses this name.");
            }

            try
            {
                // The shared list of organisations decides who has which address...
                await platform.Tenants.Where(t => t.Id == current.Id).ExecuteUpdateAsync(s => s
                    .SetProperty(t => t.Name, name).SetProperty(t => t.Slug, slug)
                    .SetProperty(t => t.Description, description).SetProperty(t => t.LogoKey, req.LogoKey));
            }
            catch (Microsoft.Data.Sqlite.SqliteException e) when (e.SqliteErrorCode == 19)
            {
                // Someone claimed the same name between our check and the save.
                return Http.Error(409, "Another organisation already uses this name.");
            }
            // ...and the organisation's own database keeps a copy for its tickets and payments to refer to.
            await db.Organisations.Where(o => o.Id == current.Id).ExecuteUpdateAsync(s => s
                .SetProperty(o => o.Name, name).SetProperty(o => o.Slug, slug)
                .SetProperty(o => o.Description, description).SetProperty(o => o.LogoKey, req.LogoKey)
                .SetProperty(o => o.BrandColor, brandColor));
            await cache.OrganisationChangedAsync(current.Slug);
            if (slug != current.Slug) await cache.OrganisationChangedAsync(slug);
            return Results.Ok(new { Slug = slug });
        });

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

        admin.MapPut("/tiers/{id:guid}", async (Guid id, TierRequest req, HttpContext http, AppDbContext db, IConfiguration config, TimeProvider clock) =>
        {
            var orgId = http.Org().Org.Id;
            var tier = await db.MembershipTiers.FirstOrDefaultAsync(t => t.Id == id && t.OrganisationId == orgId);
            if (tier is null) return Http.Error(404, "Membership type not found.");
            var zone = MembershipService.LocalZone(config);
            var oldExpiry = tier.ExpiresAt(zone);
            if (await ApplyAsync(tier, req, db, zone, clock.GetUtcNow().UtcDateTime) is { } error) return error;
            await using var tx = await db.Database.BeginTransactionAsync();
            await db.SaveChangesAsync();
            // Moving the end date (say, the season got longer) moves it for everyone who still has it from this type.
            // Members whose date an admin set by hand keep theirs. Once it has run out, it stays run out: reopening
            // an ended type for a new season means its old members join (and pay) again.
            var newExpiry = tier.ExpiresAt(zone);
            var now = clock.GetUtcNow().UtcDateTime;
            if (newExpiry != oldExpiry && (oldExpiry is null || oldExpiry > now))
            {
                await db.Memberships.Where(m => m.TierId == tier.Id && m.ExpiresAt == oldExpiry)
                    .ExecuteUpdateAsync(u => u.SetProperty(m => m.ExpiresAt, newExpiry));
                await db.MembershipPeriods.Where(p => p.TierId == tier.Id && p.EndsAt == oldExpiry)
                    .ExecuteUpdateAsync(u => u.SetProperty(p => p.EndsAt, newExpiry));
            }
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

        admin.MapPut("/members/{id:guid}", async (Guid id, MemberRequest req, HttpContext http, AppDbContext db, MembershipService memberships,
            IConfiguration config, TimeProvider clock) =>
        {
            var orgId = http.Org().Org.Id;
            var member = await db.Memberships.FirstOrDefaultAsync(m => m.Id == id && m.OrganisationId == orgId);
            if (member is null) return Http.Error(404, "Member not found.");
            if (!Enum.IsDefined(req.Role)) return Http.Error(400, "Unknown role.");
            var tier = await db.MembershipTiers.FirstOrDefaultAsync(t => t.Id == req.TierId && t.OrganisationId == orgId);
            if (tier is null) return Http.Error(400, "Unknown membership type.");
            // Another type: it runs until that type's end date, as if they had joined it. The same type keeps
            // whatever end date was sent, so an admin can still change it by hand.
            var zone = MembershipService.LocalZone(config);
            var tierChanged = member.TierId != tier.Id;
            if (tierChanged && tier.HasEnded(clock.GetUtcNow().UtcDateTime, zone))
                return Http.Error(409, $"\"{tier.Name}\" ended on {tier.EndsOn:dd/MM/yyyy}. Give it a new end date first, or choose another membership.");
            var expiresAt = tierChanged ? tier.ExpiresAt(zone) : Http.Utc(req.ExpiresAt);
            if (member.Role == OrgRole.Admin && req.Role != OrgRole.Admin &&
                await db.Memberships.CountAsync(m => m.OrganisationId == orgId && m.Role == OrgRole.Admin) == 1)
                return Http.Error(409, "An organisation needs at least one admin.");
            if (tierChanged || member.ExpiresAt != expiresAt)
                await memberships.RecordPeriodAsync(member.UserId, tier, expiresAt);
            member.Role = req.Role;
            member.TierId = req.TierId;
            member.ExpiresAt = expiresAt;
            await db.SaveChangesAsync();
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

        // ---- Which details are asked from members ----
        admin.MapGet("/member-fields", async (AppDbContext db) =>
            Results.Ok(ProfileFields.Read(await db.Organisations.AsNoTracking().FirstAsync())));

        admin.MapPut("/member-fields", async (Dictionary<string, FieldMode> modes, AppDbContext db) =>
        {
            if (modes.Keys.Any(k => !ProfileFields.Configurable.Contains(k)) || modes.Values.Any(m => !Enum.IsDefined(m)))
                return Http.Error(400, "Unknown detail.");
            var organisation = await db.Organisations.FirstAsync();
            organisation.ProfileFieldsJson = ProfileFields.Write(modes);
            await db.SaveChangesAsync();
            return Results.Ok(ProfileFields.Read(organisation));
        });

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

        // ---- Bar products ----
        admin.MapGet("/products", async (HttpContext http, AppDbContext db) =>
        {
            var orgId = http.Org().Org.Id;
            return Results.Ok(await db.Products.AsNoTracking().Where(p => p.OrganisationId == orgId)
                .OrderBy(p => p.SortOrder).ThenBy(p => p.Name)
                .Select(p => new { p.Id, p.Name, p.PriceCents, p.Active, p.SortOrder, p.IsDeposit, p.DepositProductId, p.CategoryId, p.Color }).ToListAsync());
        });

        // ---- Tabs at the till ----
        admin.MapGet("/categories", async (HttpContext http, AppDbContext db) =>
        {
            var orgId = http.Org().Org.Id;
            return Results.Ok(await db.ProductCategories.AsNoTracking().Where(c => c.OrganisationId == orgId)
                .OrderBy(c => c.SortOrder).ThenBy(c => c.Name).Select(c => new { c.Id, c.Name }).ToListAsync());
        });

        admin.MapPost("/categories", async (CategoryRequest req, HttpContext http, AppDbContext db, AppCache cache) =>
        {
            var orgId = http.Org().Org.Id;
            if (BadName(req.Name)) return Http.Error(400, "Give the category a name.");
            var last = await db.ProductCategories.Where(c => c.OrganisationId == orgId).MaxAsync(c => (int?)c.SortOrder) ?? 0;
            var category = new ProductCategory { Id = Guid.NewGuid(), OrganisationId = orgId, Name = req.Name!.Trim(), SortOrder = last + 1 };
            db.ProductCategories.Add(category);
            await db.SaveChangesAsync();
            await cache.ProductsChangedAsync(orgId);
            return Results.Ok(new { category.Id });
        });

        admin.MapPut("/categories/{id:guid}", async (Guid id, CategoryRequest req, HttpContext http, AppDbContext db, AppCache cache) =>
        {
            var orgId = http.Org().Org.Id;
            var category = await db.ProductCategories.FirstOrDefaultAsync(c => c.Id == id && c.OrganisationId == orgId);
            if (category is null) return Http.Error(404, "Category not found.");
            if (BadName(req.Name)) return Http.Error(400, "Give the category a name.");
            category.Name = req.Name!.Trim();
            await db.SaveChangesAsync();
            await cache.ProductsChangedAsync(orgId);
            return Results.NoContent();
        });

        // Its items stay on the menu, under "Other".
        admin.MapDelete("/categories/{id:guid}", async (Guid id, HttpContext http, AppDbContext db, AppCache cache) =>
        {
            var orgId = http.Org().Org.Id;
            var category = await db.ProductCategories.FirstOrDefaultAsync(c => c.Id == id && c.OrganisationId == orgId);
            if (category is null) return Http.Error(404, "Category not found.");
            await using var tx = await db.Database.BeginTransactionAsync();
            await db.Products.Where(p => p.CategoryId == id).ExecuteUpdateAsync(s => s.SetProperty(p => p.CategoryId, (Guid?)null));
            db.ProductCategories.Remove(category);
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            await cache.ProductsChangedAsync(orgId);
            return Results.NoContent();
        });

        admin.MapPut("/categories/order", async (OrderRequest req, HttpContext http, AppDbContext db, AppCache cache) =>
        {
            var orgId = http.Org().Org.Id;
            var categories = await db.ProductCategories.Where(c => c.OrganisationId == orgId).ToListAsync();
            if (Reorder(categories, req.Ids, c => c.Id, (c, i) => c.SortOrder = i) is { } error) return error;
            await db.SaveChangesAsync();
            await cache.ProductsChangedAsync(orgId);
            return Results.NoContent();
        });

        // The admin drags items into the order the bar app shows them in.
        admin.MapPut("/products/order", async (OrderRequest req, HttpContext http, AppDbContext db, AppCache cache) =>
        {
            var orgId = http.Org().Org.Id;
            var products = await db.Products.Where(p => p.OrganisationId == orgId).ToListAsync();
            if (Reorder(products, req.Ids, p => p.Id, (p, i) => p.SortOrder = i) is { } error) return error;
            await db.SaveChangesAsync();
            await cache.ProductsChangedAsync(orgId);
            return Results.NoContent();
        });

        // Past sales keep their description, so an item can go without losing history. A deposit that drinks
        // still come with can't: the till would stop charging for the cups.
        admin.MapDelete("/products/{id:guid}", async (Guid id, HttpContext http, AppDbContext db, AppCache cache) =>
        {
            var orgId = http.Org().Org.Id;
            var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id && p.OrganisationId == orgId);
            if (product is null) return Http.Error(404, "Product not found.");
            if (await db.Products.AnyAsync(p => p.DepositProductId == id))
                return Http.Error(409, $"Drinks still come with \"{product.Name}\". Choose another deposit for them first.");
            db.Products.Remove(product);
            await db.SaveChangesAsync();
            await cache.ProductsChangedAsync(orgId);
            return Results.NoContent();
        });

        admin.MapPost("/products", async (ProductRequest req, HttpContext http, AppDbContext db, AppCache cache) =>
        {
            var orgId = http.Org().Org.Id;
            var product = new Product { Id = Guid.NewGuid(), OrganisationId = orgId, Name = "" };
            if ((Apply(product, req) ?? await CheckDepositAsync(db, product)) is { } error) return error;
            db.Products.Add(product);
            await db.SaveChangesAsync();
            await cache.ProductsChangedAsync(orgId);
            return Results.Ok(new { product.Id });
        });

        admin.MapPut("/products/{id:guid}", async (Guid id, ProductRequest req, HttpContext http, AppDbContext db, AppCache cache) =>
        {
            var orgId = http.Org().Org.Id;
            var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id && p.OrganisationId == orgId);
            if (product is null) return Http.Error(404, "Product not found.");
            if ((Apply(product, req) ?? await CheckDepositAsync(db, product)) is { } error) return error;
            await db.SaveChangesAsync();
            await cache.ProductsChangedAsync(orgId);
            return Results.NoContent();
        });
    }

    private static bool BadName(string? name) => (name?.Trim().Length ?? 0) is < 1 or > 80;
    private static bool BadPrice(int cents) => cents is < 0 or > MaxPriceCents;
    private static bool BadPercent(int p) => p is < 0 or > 100;

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

    private static IResult? Apply(Product product, ProductRequest req)
    {
        if (BadName(req.Name)) return Http.Error(400, "Give the product a name.");
        if (BadPrice(req.PriceCents)) return Http.Error(400, "Invalid price.");
        product.Name = req.Name!.Trim();
        product.PriceCents = req.PriceCents;
        product.Active = req.Active;
        product.SortOrder = req.SortOrder;
        if (req.Color is not null && !ProductColors.All.Contains(req.Color)) return Http.Error(400, "Pick one of the colours.");
        product.IsDeposit = req.IsDeposit;
        product.Color = req.Color;
        // Deposits aren't on the tiles, so they don't sit in a tab.
        product.CategoryId = req.IsDeposit ? null : req.CategoryId;
        // A deposit doesn't come with another deposit.
        product.DepositProductId = req.IsDeposit ? null : req.DepositProductId;
        return null;
    }

    /// <summary>
    /// Puts items in the order given. Items left out (added on another screen meanwhile) keep their place after the rest.
    /// </summary>
    private static IResult? Reorder<T>(List<T> items, List<Guid>? ids, Func<T, Guid> idOf, Action<T, int> setOrder)
    {
        if (ids is null || ids.Count == 0 || ids.Distinct().Count() != ids.Count) return Http.Error(400, "Send the new order.");
        var byId = items.ToDictionary(idOf);
        if (ids.Any(id => !byId.ContainsKey(id))) return Http.Error(409, "The list has changed. Reload and try again.");
        for (var i = 0; i < ids.Count; i++) setOrder(byId[ids[i]], i + 1);
        var next = ids.Count;
        foreach (var rest in items.Where(t => !ids.Contains(idOf(t)))) setOrder(rest, ++next);
        return null;
    }

    /// <summary>A drink can only come with one of this organisation's deposits, and a deposit drinks come with stays one.</summary>
    private static async Task<IResult?> CheckDepositAsync(AppDbContext db, Product product)
    {
        if (product.CategoryId is { } categoryId &&
            !await db.ProductCategories.AnyAsync(c => c.Id == categoryId && c.OrganisationId == product.OrganisationId))
            return Http.Error(400, "Choose one of your categories.");
        if (product.DepositProductId is { } depositId &&
            !await db.Products.AnyAsync(p => p.Id == depositId && p.OrganisationId == product.OrganisationId && p.IsDeposit))
            return Http.Error(400, "Choose one of your deposits.");
        if (!product.IsDeposit && await db.Products.AnyAsync(p => p.DepositProductId == product.Id))
            return Http.Error(409, $"Drinks still come with \"{product.Name}\". Choose another deposit for them first.");
        return null;
    }
}
