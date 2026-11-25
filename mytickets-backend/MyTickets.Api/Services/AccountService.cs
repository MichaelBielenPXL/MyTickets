using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;

namespace MyTickets.Api.Services;

/// <summary>
/// MyTickets accounts: one per person, in the platform database, with the password they sign in with everywhere.
/// And their records at organisations: made when they join one, linked to the account, without a password.
/// </summary>
public class AccountService(PlatformDbContext platform, TenantScopes scopes, IPasswordHasher<Account> hasher, TimeProvider clock)
{
    public const int MinimumPasswordLength = 8;

    public static string Normalise(string? email) => email?.Trim().ToLowerInvariant() ?? "";

    public Task<Account?> FindAsync(string email)
    {
        var address = Normalise(email);
        return platform.Accounts.AsNoTracking().FirstOrDefaultAsync(a => a.Email == address);
    }

    public Task<Account?> FindAsync(Guid accountId) => platform.Accounts.AsNoTracking().FirstOrDefaultAsync(a => a.Id == accountId);

    /// <summary>A new account, having accepted the current terms. Not saved: the caller saves it, with what goes with it.</summary>
    public Account New(string email, string displayName, string password)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var address = Normalise(email);
        var account = new Account
        {
            Id = Guid.NewGuid(), Email = address, DisplayName = displayName.Length > 0 ? displayName : address.Split('@')[0],
            CreatedAt = now, TermsAcceptedAt = now, TermsVersion = Legal.TermsVersion,
        };
        account.PasswordHash = hasher.HashPassword(account, password);
        return account;
    }

    /// <summary>Saves a new account; refuses an address that already has one.</summary>
    public async Task CreateAsync(Account account)
    {
        if (await platform.Accounts.AnyAsync(a => a.Email == account.Email)) throw AlreadyExists();
        platform.Accounts.Add(account);
        try { await platform.SaveChangesAsync(); }
        catch (DbUpdateException e) when (e.InnerException is SqliteException { SqliteErrorCode: 19 })
        {
            platform.ChangeTracker.Clear();
            throw AlreadyExists();
        }
    }

    /// <summary>The account with this address and password; null when either is wrong.</summary>
    public async Task<Account?> VerifyAsync(string email, string password)
    {
        var account = await FindAsync(email);
        // An account merged without any password (see AccountMerge) can only be opened with "Forgot your password?".
        return account is { PasswordHash.Length: > 0 } && hasher.VerifyHashedPassword(account, account.PasswordHash, password) != PasswordVerificationResult.Failed
            ? account
            : null;
    }

    public async Task SetPasswordAsync(Guid accountId, string password)
    {
        var account = await platform.Accounts.FirstAsync(a => a.Id == accountId);
        account.PasswordHash = hasher.HashPassword(account, password);
        await platform.SaveChangesAsync();
    }

    /// <summary>The account's record at an organisation (its id in that organisation's database), if it has one.</summary>
    public Task<Guid?> RecordAtAsync(Guid accountId, Guid tenantId) =>
        platform.AccountLinks.AsNoTracking().Where(l => l.AccountId == accountId && l.TenantId == tenantId)
            .Select(l => (Guid?)l.UserId).FirstOrDefaultAsync();

    /// <summary>The organisations the account has a record at, with the record's id there, the first one joined first.</summary>
    public async Task<List<(Tenant Tenant, Guid UserId)>> RecordsAsync(Guid accountId) =>
        (await (
            from link in platform.AccountLinks.AsNoTracking()
            join tenant in platform.Tenants.AsNoTracking() on link.TenantId equals tenant.Id
            where link.AccountId == accountId
            orderby link.CreatedAt
            select new { tenant, link.UserId }).ToListAsync())
        .Select(x => (x.tenant, x.UserId)).ToList();

    /// <summary>
    /// The account's record at the organisation, made (and linked) when they don't have one yet: when they start
    /// joining. Until they give their name, staff see the first part of their email address.
    /// </summary>
    public async Task<Guid> EnsureRecordAtAsync(Guid accountId, Organisation organisation)
    {
        if (await RecordAtAsync(accountId, organisation.Id) is { } existing) return existing;
        var account = await platform.Accounts.AsNoTracking().FirstAsync(a => a.Id == accountId);
        var now = clock.GetUtcNow().UtcDateTime;
        var user = new User { Id = Guid.NewGuid(), Email = account.Email, DisplayName = account.Email.Split('@')[0], CreatedAt = now };

        await using (var scope = await scopes.OpenAsync(organisation))
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            // An address can only have one record per organisation; reuse one left without a link.
            if (await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == account.Email) is { } unlinked) user = unlinked;
            else
            {
                db.Users.Add(user);
                await db.SaveChangesAsync();
            }
        }
        await LinkAsync(accountId, organisation.Id, user.Id, now);
        return user.Id;
    }

    /// <summary>Links an account to its record at an organisation. Safe to call again.</summary>
    public async Task LinkAsync(Guid accountId, Guid tenantId, Guid userId, DateTime createdAt)
    {
        if (await platform.AccountLinks.AnyAsync(l => l.AccountId == accountId && l.TenantId == tenantId)) return;
        platform.AccountLinks.Add(new AccountLink { AccountId = accountId, TenantId = tenantId, UserId = userId, CreatedAt = createdAt });
        try { await platform.SaveChangesAsync(); }
        catch (DbUpdateException) { platform.ChangeTracker.Clear(); /* linked at the same moment by another request */ }
    }

    private static AppProblem AlreadyExists() =>
        AppProblem.Conflict("There is already a MyTickets account with this email address. Sign in instead.", code: "account-exists");
}
