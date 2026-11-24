using Microsoft.EntityFrameworkCore;

namespace MyTickets.Api.Data;

/// <summary>
/// The small shared database: the organisations, everyone's MyTickets account (email and password), and which
/// organisations each account has a record at. Everything an organisation knows about someone lives in its own database.
/// </summary>
public class PlatformDbContext(DbContextOptions<PlatformDbContext> options) : DbContext(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<AccountLink> AccountLinks => Set<AccountLink>();
    public DbSet<TenantOwner> TenantOwners => Set<TenantOwner>();
    public DbSet<CardCode> CardCodes => Set<CardCode>();

    protected override void ConfigureConventions(ModelConfigurationBuilder b)
    {
        b.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
    }

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Tenant>().HasIndex(x => x.Slug).IsUnique();
        b.Entity<Account>().ToTable("Accounts").HasIndex(x => x.Email).IsUnique();
        b.Entity<AccountLink>().HasKey(x => new { x.AccountId, x.TenantId });
        b.Entity<AccountLink>().HasIndex(x => x.TenantId);
        b.Entity<TenantOwner>().HasKey(x => new { x.TenantId, x.AccountId });
        b.Entity<TenantOwner>().HasIndex(x => x.AccountId);
        b.Entity<CardCode>().HasKey(x => x.Code);
        b.Entity<CardCode>().HasIndex(x => x.TenantId);
    }
}
