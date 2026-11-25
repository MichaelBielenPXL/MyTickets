using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services;
using static MyTickets.Api.Endpoints.AdminInput;

namespace MyTickets.Api.Endpoints;

/// <summary>Manage: the bar menu (products, deposits) and the tabs at the till.</summary>
public static class AdminBarEndpoints
{
    public record ProductRequest(string? Name, int PriceCents, bool Active, int SortOrder, bool IsDeposit, Guid? DepositProductId, Guid? CategoryId = null, string? Color = null);
    public record CategoryRequest(string? Name);

    public static void MapAdminBar(this RouteGroupBuilder admin)
    {
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
