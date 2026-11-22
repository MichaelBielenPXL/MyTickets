using Microsoft.EntityFrameworkCore;

namespace MyTickets.Api.Data;

/// <summary>The small shared database: the list of organisations and their owners. No guest data lives here.</summary>
public class PlatformDbContext(DbContextOptions<PlatformDbContext> options) : DbContext(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<OwnerAccount> OwnerAccounts => Set<OwnerAccount>();
    public DbSet<TenantOwner> TenantOwners => Set<TenantOwner>();
    public DbSet<CardCode> CardCodes => Set<CardCode>();

    protected override void ConfigureConventions(ModelConfigurationBuilder b)
    {
        b.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
    }

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Tenant>().HasIndex(x => x.Slug).IsUnique();
        b.Entity<OwnerAccount>().HasIndex(x => x.Email).IsUnique();
        b.Entity<TenantOwner>().HasKey(x => new { x.TenantId, x.OwnerAccountId });
        b.Entity<TenantOwner>().HasIndex(x => x.OwnerAccountId);
        b.Entity<CardCode>().HasKey(x => x.Code);
        b.Entity<CardCode>().HasIndex(x => x.TenantId);
    }
}
