using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

public static class AdminEndpoints
{
    public record TierRequest(string? Name, string? Description, int PriceCents, int? DurationDays, bool IsPublic,
        string? InviteCode, int TicketDiscountPercent, int DrinkDiscountPercent, bool Archived);
    public record MemberRequest(OrgRole Role, Guid TierId, DateTime? ExpiresAt);
    public record EventRequest(string? Name, string? Description, string? Location, DateTime StartsAt, DateTime? EndsAt, bool Published, string? ImageKey);
    public record OrganisationRequest(string? Name, string? Description, string? LogoKey);
    public record TicketTypeRequest(string? Name, int PriceCents, int Capacity, int MaxPerUser, DateTime? SalesStartAt,
        DateTime? SalesEndAt, List<Guid>? AllowedTierIds);
    public record ProductRequest(string? Name, int PriceCents, bool Active, int SortOrder, bool Returnable);

    private const int MaxPriceCents = 1_000_000;

    public static void MapAdmin(this IEndpointRouteBuilder app)
    {
        var admin = app.MapGroup("/api/orgs/{slug}/admin").RequireOrg(OrgRole.Admin);

        admin.MapGet("/summary", async (HttpContext http, AppDbContext db) =>
        {
            var org = http.Org().Org;
            var wallets = db.Wallets.Where(w => w.OrganisationId == org.Id);
            var ledger = db.WalletTransactions.Where(t => wallets.Any(w => w.Id == t.WalletId));
            return Results.Ok(new
            {
                Members = await db.Memberships.CountAsync(m => m.OrganisationId == org.Id),
                CreditOutstandingCents = await wallets.SumAsync(w => w.BalanceCents),
                // Deposits handed back come off what the bar took in.
                BarRevenueCents = -await ledger.Where(t => t.Type == WalletTxType.Purchase || t.Type == WalletTxType.Return).SumAsync(t => t.AmountCents),
                OnlineTopUpsCents = await ledger.Where(t => t.Type == WalletTxType.TopUp).SumAsync(t => t.AmountCents),
                CashTopUpsCents = await ledger.Where(t => t.Type == WalletTxType.CashTopUp).SumAsync(t => t.AmountCents),
                TicketRevenueCents = await db.Tickets
                    .Where(t => t.TicketType.Event.OrganisationId == org.Id && (t.Status == TicketStatus.Valid || t.Status == TicketStatus.CheckedIn))
                    .SumAsync(t => t.PricePaidCents),
            });
        });

        // ---- The organisation itself ----
        // The page address is always the organisation's name, so renaming moves the page to the new name.
        admin.MapGet("/organisation", async (HttpContext http, AppDbContext db) =>
        {
            var id = http.Org().Org.Id;
            // Read from the database, not the cache: this is what the edit form starts from.
            var o = await db.Organisations.AsNoTracking().FirstAsync(x => x.Id == id);
            return Results.Ok(new { o.Slug, o.Name, o.Description, o.LogoKey, LogoUrl = Images.Url(o.LogoKey) });
        });

        admin.MapPut("/organisation", async (OrganisationRequest req, HttpContext http, AppDbContext db, PlatformDbContext platform, AppCache cache) =>
        {
            var current = http.Org().Org;
            var name = req.Name?.Trim() ?? "";
            if (name.Length is < 2 or > 80) return Http.Error(400, "Give the organisation a name of 2 to 80 characters.");
            var description = req.Description?.Trim() ?? "";
            if (description.Length > 500) return Http.Error(400, "Keep the description under 500 characters.");
            if (req.LogoKey is not null && !Images.BelongsTo(req.LogoKey, current.Id)) return Http.Error(400, "Upload the logo again.");

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
                .SetProperty(o => o.Description, description).SetProperty(o => o.LogoKey, req.LogoKey));
            await cache.OrganisationChangedAsync(current.Slug);
            if (slug != current.Slug) await cache.OrganisationChangedAsync(slug);
            return Results.Ok(new { Slug = slug });
        });

        // ---- Membership types ----
        admin.MapGet("/tiers", async (HttpContext http, AppDbContext db) =>
        {
            var org = http.Org().Org;
            var counts = await db.Memberships.Where(m => m.OrganisationId == org.Id).GroupBy(m => m.TierId)
                .Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(g => g.Key, g => g.Count);
            var tiers = await db.MembershipTiers.AsNoTracking().Where(t => t.OrganisationId == org.Id)
                .OrderBy(t => t.Archived).ThenBy(t => t.PriceCents).ThenBy(t => t.Name).ToListAsync();
            return Results.Ok(tiers.Select(t => new
            {
                t.Id, t.Name, t.Description, t.PriceCents, t.DurationDays, t.IsPublic, t.InviteCode,
                t.TicketDiscountPercent, t.DrinkDiscountPercent, t.Archived, Members = counts.GetValueOrDefault(t.Id),
            }));
        });

        admin.MapPost("/tiers", async (TierRequest req, HttpContext http, AppDbContext db) =>
        {
            var tier = new MembershipTier { Id = Guid.NewGuid(), OrganisationId = http.Org().Org.Id, Name = "" };
            if (await ApplyAsync(tier, req, db) is { } error) return error;
            db.MembershipTiers.Add(tier);
            await db.SaveChangesAsync();
            return Results.Ok(new { tier.Id });
        });

        admin.MapPut("/tiers/{id:guid}", async (Guid id, TierRequest req, HttpContext http, AppDbContext db) =>
        {
            var orgId = http.Org().Org.Id;
            var tier = await db.MembershipTiers.FirstOrDefaultAsync(t => t.Id == id && t.OrganisationId == orgId);
            if (tier is null) return Http.Error(404, "Membership type not found.");
            if (await ApplyAsync(tier, req, db) is { } error) return error;
            await db.SaveChangesAsync();
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
                }).ToListAsync();
            return Results.Ok(members);
        });

        admin.MapPut("/members/{id:guid}", async (Guid id, MemberRequest req, HttpContext http, AppDbContext db) =>
        {
            var orgId = http.Org().Org.Id;
            var member = await db.Memberships.FirstOrDefaultAsync(m => m.Id == id && m.OrganisationId == orgId);
            if (member is null) return Http.Error(404, "Member not found.");
            if (!Enum.IsDefined(req.Role)) return Http.Error(400, "Unknown role.");
            if (!await db.MembershipTiers.AnyAsync(t => t.Id == req.TierId && t.OrganisationId == orgId))
                return Http.Error(400, "Unknown membership type.");
            if (member.Role == OrgRole.Admin && req.Role != OrgRole.Admin &&
                await db.Memberships.CountAsync(m => m.OrganisationId == orgId && m.Role == OrgRole.Admin) == 1)
                return Http.Error(409, "An organisation needs at least one admin.");
            member.Role = req.Role;
            member.TierId = req.TierId;
            member.ExpiresAt = Http.Utc(req.ExpiresAt);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        // ---- Events and their tickets ----
        admin.MapGet("/events", async (HttpContext http, AppDbContext db) =>
        {
            var orgId = http.Org().Org.Id;
            var checkedIn = await db.Tickets.Where(t => t.TicketType.Event.OrganisationId == orgId && t.Status == TicketStatus.CheckedIn)
                .GroupBy(t => t.TicketTypeId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(g => g.Key, g => g.Count);
            var events = await db.Events.AsNoTracking().Include(e => e.TicketTypes).Where(e => e.OrganisationId == orgId)
                .OrderByDescending(e => e.StartsAt).ToListAsync();
            return Results.Ok(events.Select(e => new
            {
                e.Id, e.Name, e.Description, e.Location, e.StartsAt, e.EndsAt, e.Published, e.ImageKey, ImageUrl = Images.Url(e.ImageKey),
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
                .OrderByDescending(p => p.Active).ThenBy(p => p.SortOrder).ThenBy(p => p.Name)
                .Select(p => new { p.Id, p.Name, p.PriceCents, p.Active, p.SortOrder, p.Returnable }).ToListAsync());
        });

        admin.MapPost("/products", async (ProductRequest req, HttpContext http, AppDbContext db, AppCache cache) =>
        {
            var orgId = http.Org().Org.Id;
            var product = new Product { Id = Guid.NewGuid(), OrganisationId = orgId, Name = "" };
            if (Apply(product, req) is { } error) return error;
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
            if (Apply(product, req) is { } error) return error;
            await db.SaveChangesAsync();
            await cache.ProductsChangedAsync(orgId);
            return Results.NoContent();
        });
    }

    private static bool BadName(string? name) => (name?.Trim().Length ?? 0) is < 1 or > 80;
    private static bool BadPrice(int cents) => cents is < 0 or > MaxPriceCents;
    private static bool BadPercent(int p) => p is < 0 or > 100;

    private static async Task<IResult?> ApplyAsync(MembershipTier tier, TierRequest req, AppDbContext db)
    {
        if (BadName(req.Name)) return Http.Error(400, "Give the membership type a name.");
        if (BadPrice(req.PriceCents)) return Http.Error(400, "Invalid price.");
        if (req.DurationDays is < 1 or > 3660) return Http.Error(400, "Duration must be between 1 day and 10 years, or empty for no end date.");
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
        tier.DurationDays = req.DurationDays;
        tier.IsPublic = req.IsPublic;
        tier.InviteCode = code;
        tier.TicketDiscountPercent = req.TicketDiscountPercent;
        tier.DrinkDiscountPercent = req.DrinkDiscountPercent;
        tier.Archived = req.Archived;
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
        product.Returnable = req.Returnable;
        return null;
    }
}
