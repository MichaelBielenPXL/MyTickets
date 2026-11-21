using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace MyTickets.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Organisation> Organisations => Set<Organisation>();
    public DbSet<MembershipTier> MembershipTiers => Set<MembershipTier>();
    public DbSet<Membership> Memberships => Set<Membership>();
    public DbSet<MembershipPeriod> MembershipPeriods => Set<MembershipPeriod>();
    public DbSet<Wallet> Wallets => Set<Wallet>();
    public DbSet<WalletTransaction> WalletTransactions => Set<WalletTransaction>();
    public DbSet<NfcCard> NfcCards => Set<NfcCard>();
    public DbSet<Event> Events => Set<Event>();
    public DbSet<TicketType> TicketTypes => Set<TicketType>();
    public DbSet<Ticket> Tickets => Set<Ticket>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductCategory> ProductCategories => Set<ProductCategory>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<StripeAccount> StripeAccounts => Set<StripeAccount>();
    public DbSet<MembershipRequest> MembershipRequests => Set<MembershipRequest>();
    public DbSet<TopUpDeal> TopUpDeals => Set<TopUpDeal>();

    protected override void ConfigureConventions(ModelConfigurationBuilder b)
    {
        b.Properties<Enum>().HaveConversion<string>().HaveMaxLength(32);
        b.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
    }

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>().HasIndex(x => x.Email).IsUnique();
        b.Entity<Organisation>().HasIndex(x => x.Slug).IsUnique();
        b.Entity<MembershipTier>().HasIndex(x => x.OrganisationId);
        b.Entity<Membership>().HasIndex(x => new { x.UserId, x.OrganisationId }).IsUnique();
        b.Entity<Membership>().HasIndex(x => x.OrganisationId);
        b.Entity<Membership>().HasIndex(x => x.PassCode).IsUnique();
        b.Entity<MembershipPeriod>().HasIndex(x => x.UserId);
        b.Entity<TopUpDeal>().HasIndex(x => x.OrganisationId);
        b.Entity<Membership>().HasOne(x => x.Tier).WithMany().OnDelete(DeleteBehavior.Restrict);
        b.Entity<Wallet>().HasIndex(x => new { x.UserId, x.OrganisationId }).IsUnique();
        b.Entity<Wallet>().ToTable(t => t.HasCheckConstraint("ck_wallet_balance_not_negative", "\"BalanceCents\" >= 0"));
        b.Entity<WalletTransaction>().HasIndex(x => new { x.WalletId, x.CreatedAt });
        b.Entity<WalletTransaction>().HasIndex(x => x.RequestId).IsUnique();
        b.Entity<NfcCard>().HasIndex(x => x.Uid).IsUnique().HasFilter("\"Uid\" IS NOT NULL");
        b.Entity<NfcCard>().HasIndex(x => x.Code).IsUnique().HasFilter("\"Code\" IS NOT NULL");
        b.Entity<NfcCard>().HasIndex(x => x.Number).IsUnique();
        b.Entity<NfcCard>().HasIndex(x => x.WalletId);
        b.Entity<NfcCard>().HasOne(x => x.Wallet).WithMany().OnDelete(DeleteBehavior.SetNull);
        b.Entity<Event>().HasIndex(x => new { x.OrganisationId, x.StartsAt });
        b.Entity<TicketType>().ToTable(t => t.HasCheckConstraint("ck_ticket_type_not_oversold", "\"Sold\" >= 0 AND \"Sold\" <= \"Capacity\""));
        b.Entity<Ticket>().HasIndex(x => x.Code).IsUnique();
        b.Entity<Ticket>().HasIndex(x => new { x.EventId, x.UserId });
        b.Entity<Ticket>().HasIndex(x => x.PaymentId);
        b.Entity<Product>().HasIndex(x => x.OrganisationId);
        b.Entity<ProductCategory>().HasIndex(x => x.OrganisationId);
        // The column predates deposits being their own kind of item.
        b.Entity<Product>().Property(x => x.IsDeposit).HasColumnName("Returnable");
        b.Entity<Payment>().HasIndex(x => new { x.Status, x.CreatedAt });
        b.Entity<Payment>().HasIndex(x => x.ProviderReference);
        b.Entity<StripeAccount>().HasKey(x => x.OrganisationId);
        b.Entity<MembershipRequest>().HasIndex(x => new { x.Status, x.CreatedAt });
        b.Entity<MembershipRequest>().HasIndex(x => new { x.UserId, x.TierId });
        b.Entity<MembershipRequest>().HasOne(x => x.Tier).WithMany().OnDelete(DeleteBehavior.Restrict);
    }
}

/// <summary>SQLite stores times as text without a zone. Everything is saved as UTC, so mark it as UTC when read back.</summary>
public class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(
    v => v.ToUniversalTime(), v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
