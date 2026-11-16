using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MyTickets.Api.Data;

/// <summary>
/// One organisation. Everything that belongs to it (accounts, tickets, credit, cards) lives in its
/// own database; this record only says that it exists and where its page is.
/// </summary>
public class Tenant
{
    public Guid Id { get; set; }
    public required string Slug { get; set; }
    public required string Name { get; set; }
    public string Description { get; set; } = "";
    public string? LogoKey { get; set; }
    public DateTime CreatedAt { get; set; }

    /// <summary>The same organisation in the shape the rest of the code works with.</summary>
    public Organisation ToOrganisation() => new()
    {
        Id = Id, Slug = Slug, Name = Name, Description = Description, LogoKey = LogoKey, CreatedAt = CreatedAt,
    };
}

/// <summary>
/// An organiser's login. It is the only kind of account that reaches across organisations:
/// one person can create several and opens all of them with this one login.
/// </summary>
public class OwnerAccount
{
    public Guid Id { get; set; }
    public required string Email { get; set; }
    public required string DisplayName { get; set; }
    public string PasswordHash { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

/// <summary>Says which organisations an owner created, and which account inside each one is theirs.</summary>
public class TenantOwner
{
    public Guid TenantId { get; set; }
    public Guid OwnerAccountId { get; set; }
    /// <summary>The owner's admin account inside that organisation's own database.</summary>
    public Guid UserId { get; set; }
}

/// <summary>The small shared database: the list of organisations and their owners. No guest data lives here.</summary>
public class PlatformDbContext(DbContextOptions<PlatformDbContext> options) : DbContext(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<OwnerAccount> OwnerAccounts => Set<OwnerAccount>();
    public DbSet<TenantOwner> TenantOwners => Set<TenantOwner>();

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
    }
}

/// <summary>Lets the migration tools build an organisation database without a web request to say which one.</summary>
public class AppDbContextDesignFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=design-time.db").Options);
}

public class PlatformDbContextDesignFactory : IDesignTimeDbContextFactory<PlatformDbContext>
{
    public PlatformDbContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<PlatformDbContext>().UseSqlite("Data Source=design-time-platform.db").Options);
}
