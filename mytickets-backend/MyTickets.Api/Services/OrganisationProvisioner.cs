using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;

namespace MyTickets.Api.Services;

public class SlugTakenException() : Exception("This organisation page address is already taken.");

/// <summary>Creates an organisation: its entry in the shared list, its own database, and the owner's admin account in it.</summary>
public class OrganisationProvisioner(PlatformDbContext platform, TenantDatabases databases, TenantScopes scopes,
    AppCache cache, TimeProvider clock, ILogger<OrganisationProvisioner> log)
{
    /// <summary>Anyone may create an organisation unless Organisations:CreatorEmails lists who may.</summary>
    public static bool MayCreate(IConfiguration config, string email)
    {
        var allowed = config.GetSection("Organisations:CreatorEmails").Get<string[]>() ?? [];
        return allowed.Length == 0 || allowed.Contains(email, StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// The owner is saved together with the organisation when they are new (first sign-up), so a refused
    /// organisation name never leaves an owner account behind. Throws <see cref="SlugTakenException"/>
    /// when someone else got the address first.
    /// </summary>
    public async Task<(Organisation Organisation, Guid AdminUserId)> CreateAsync(OwnerAccount owner, bool ownerIsNew,
        string name, string slug, string description)
    {
        var tenant = new Tenant
        {
            Id = Guid.NewGuid(), Slug = slug, Name = name, Description = description, CreatedAt = clock.GetUtcNow().UtcDateTime,
        };
        var adminUserId = Guid.NewGuid();
        if (ownerIsNew) platform.OwnerAccounts.Add(owner);
        platform.Tenants.Add(tenant);
        platform.TenantOwners.Add(new TenantOwner { TenantId = tenant.Id, OwnerAccountId = owner.Id, UserId = adminUserId });
        try
        {
            // Claims the address first. The unique index makes sure two sign-ups at the same moment can't both get it.
            await platform.SaveChangesAsync();
        }
        catch (DbUpdateException e) when (e.InnerException is SqliteException { SqliteErrorCode: 19 })
        {
            platform.ChangeTracker.Clear();
            if (await platform.Tenants.AnyAsync(t => t.Slug == slug)) throw new SlugTakenException();
            throw;
        }

        var organisation = tenant.ToOrganisation();
        try
        {
            await using var scope = await scopes.OpenAsync(organisation);
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var tier = new MembershipTier { Id = Guid.NewGuid(), OrganisationId = tenant.Id, Name = "Member", Description = "Free membership" };
            db.Organisations.Add(tenant.ToOrganisation());
            db.MembershipTiers.Add(tier);
            // The owner's account inside the organisation. It carries the same password, so the owner can
            // also sign in on the organisation's own page.
            db.Users.Add(new User
            {
                Id = adminUserId, Email = owner.Email, DisplayName = owner.DisplayName, PasswordHash = owner.PasswordHash,
                CreatedAt = tenant.CreatedAt,
            });
            await db.SaveChangesAsync();
            await scope.ServiceProvider.GetRequiredService<MembershipService>().ApplyTierAsync(adminUserId, tenant.Id, tier, OrgRole.Admin);
        }
        catch (Exception e)
        {
            // Two databases can't be changed in one step, so undo the first half by hand.
            log.LogError(e, "Setting up the database for organisation {Slug} failed; removing it again", slug);
            platform.ChangeTracker.Clear();
            await platform.TenantOwners.Where(o => o.TenantId == tenant.Id).ExecuteDeleteAsync();
            await platform.Tenants.Where(t => t.Id == tenant.Id).ExecuteDeleteAsync();
            if (ownerIsNew) await platform.OwnerAccounts.Where(o => o.Id == owner.Id).ExecuteDeleteAsync();
            databases.Discard(tenant.Id);
            throw;
        }

        await cache.OrganisationChangedAsync(slug);
        return (organisation, adminUserId);
    }

    public static OwnerAccount NewOwner(string email, string displayName, string password, TimeProvider clock)
    {
        var owner = new OwnerAccount { Id = Guid.NewGuid(), Email = email, DisplayName = displayName, CreatedAt = clock.GetUtcNow().UtcDateTime };
        // Hashed the same way as accounts inside an organisation, so the copy made there verifies too.
        owner.PasswordHash = new PasswordHasher<User>().HashPassword(null!, password);
        return owner;
    }
}
