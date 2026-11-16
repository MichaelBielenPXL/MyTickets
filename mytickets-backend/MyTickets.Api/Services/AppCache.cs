using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;
using MyTickets.Api.Data;

namespace MyTickets.Api.Services;

public record CachedProduct(Guid Id, string Name, int PriceCents, bool Returnable);
public record CachedOrganisation(Guid Id, string Slug, string Name, string Description, string? LogoKey);

/// <summary>
/// Cache for data that is read on almost every request and rarely changes. Backed by Redis when the app
/// is given a "cache" connection, otherwise by memory only. Money, ticket availability and memberships
/// are never cached: those always come straight from the database.
/// </summary>
public class AppCache(HybridCache cache, PlatformDbContext platform, IServiceProvider services)
{
    private static readonly HybridCacheEntryOptions Options = new()
    {
        Expiration = TimeSpan.FromMinutes(10),
        LocalCacheExpiration = TimeSpan.FromMinutes(1),
    };

    // The organisation's own database is only looked up when it is needed, because finding out which
    // organisation a request is for (below) has to work before there is one.
    private AppDbContext Db => services.GetRequiredService<AppDbContext>();

    /// <summary>Which organisation lives at this page address. Asked on every request, so worth remembering.</summary>
    public async Task<Organisation?> OrganisationBySlugAsync(string slug)
    {
        var tenant = await cache.GetOrCreateAsync($"tenant:{slug}", async ct =>
            await platform.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Slug == slug, ct), Options);
        return tenant?.ToOrganisation();
    }

    public async Task<List<CachedOrganisation>> OrganisationsAsync() =>
        await cache.GetOrCreateAsync("tenants:all", async ct =>
            await platform.Tenants.AsNoTracking().OrderBy(t => t.Name)
                .Select(t => new CachedOrganisation(t.Id, t.Slug, t.Name, t.Description, t.LogoKey)).ToListAsync(ct), Options);

    /// <summary>The bar menu: products currently for sale.</summary>
    public async Task<List<CachedProduct>> ActiveProductsAsync(Guid organisationId) =>
        await cache.GetOrCreateAsync($"products:v2:{organisationId}", async ct =>
            await Db.Products.AsNoTracking().Where(p => p.OrganisationId == organisationId && p.Active)
                .OrderBy(p => p.SortOrder).ThenBy(p => p.Name)
                .Select(p => new CachedProduct(p.Id, p.Name, p.PriceCents, p.Returnable)).ToListAsync(ct), Options);

    public async Task OrganisationChangedAsync(string slug)
    {
        await cache.RemoveAsync($"tenant:{slug}");
        await cache.RemoveAsync("tenants:all");
    }

    public async Task ProductsChangedAsync(Guid organisationId) => await cache.RemoveAsync($"products:v2:{organisationId}");
}
