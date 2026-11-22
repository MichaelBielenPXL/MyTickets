using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services;
using static MyTickets.Api.Endpoints.AdminInput;

namespace MyTickets.Api.Endpoints;

/// <summary>Manage: the organisation itself (name, page address, logo, colour), which details members are asked, and its token prices.</summary>
public static class AdminOrganisationEndpoints
{
    public record TopUpDealRequest(int PriceCents, int TokensCents);
    public const int MaxTopUpDeals = 8;
    public record OrganisationRequest(string? Name, string? Description, string? LogoKey, string? BrandColor = null);

    public static void MapAdminOrganisation(this RouteGroupBuilder admin)
    {
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
                if (d.PriceCents is < WalletService.MinTopUpCents or > WalletService.MaxTopUpCents)
                    return Http.Error(400, $"Each top-up costs between {Http.Euro(WalletService.MinTopUpCents)} and {Http.Euro(WalletService.MaxTopUpCents)}.");
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
    }
}
