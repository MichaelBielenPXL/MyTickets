using System.Globalization;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;

namespace MyTickets.Api.Services;

/// <summary>
/// Moves accounts made before MyTickets accounts existed (when each organisation had its own, with its own password)
/// onto MyTickets accounts: every record not yet linked is linked to the account for its email address, made when
/// there is none. The password kept is the organiser's login when there is one, otherwise that of the address's most
/// recently made account. Runs at start-up, before the organisations' databases drop their old password column, and
/// only ever touches records without a link, so running it again changes nothing.
/// </summary>
public static class AccountMerge
{
    private record OldRecord(Guid TenantId, Guid UserId, string Email, string DisplayName, DateTime CreatedAt,
        string? PasswordHash, DateTime? TermsAcceptedAt, string? TermsVersion);

    public static async Task RunAsync(IServiceProvider services, ILogger log)
    {
        await using var scope = services.CreateAsyncScope();
        var platform = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
        var databases = scope.ServiceProvider.GetRequiredService<TenantDatabases>();
        var linked = (await platform.AccountLinks.AsNoTracking().Select(l => new { l.TenantId, l.UserId }).ToListAsync())
            .Select(l => (l.TenantId, l.UserId)).ToHashSet();

        var records = new List<OldRecord>();
        foreach (var tenant in await platform.Tenants.AsNoTracking().ToListAsync())
            records.AddRange((await ReadAsync(databases.FileFor(tenant.Id), tenant.Id)).Where(r => !linked.Contains((r.TenantId, r.UserId))));
        if (records.Count == 0) return;

        foreach (var sameAddress in records.GroupBy(r => AccountService.Normalise(r.Email)))
        {
            var account = await platform.Accounts.FirstOrDefaultAsync(a => a.Email == sameAddress.Key);
            if (account is null)
            {
                var newest = sameAddress.Where(r => !string.IsNullOrEmpty(r.PasswordHash)).MaxBy(r => r.CreatedAt) ?? sameAddress.MaxBy(r => r.CreatedAt)!;
                var accepted = sameAddress.Where(r => r.TermsAcceptedAt is not null).MaxBy(r => r.TermsAcceptedAt);
                account = new Account
                {
                    Id = Guid.NewGuid(), Email = sameAddress.Key, DisplayName = newest.DisplayName, PasswordHash = newest.PasswordHash ?? "",
                    CreatedAt = sameAddress.Min(r => r.CreatedAt), TermsAcceptedAt = accepted?.TermsAcceptedAt, TermsVersion = accepted?.TermsVersion,
                };
                platform.Accounts.Add(account);
            }
            foreach (var record in sameAddress)
                platform.AccountLinks.Add(new AccountLink { AccountId = account.Id, TenantId = record.TenantId, UserId = record.UserId, CreatedAt = record.CreatedAt });
        }
        await platform.SaveChangesAsync();
        log.LogInformation("Linked {Records} existing records to MyTickets accounts", records.Count);
    }

    /// <summary>The records in one organisation's database file, read directly: whatever its migrations have done so far.</summary>
    private static async Task<List<OldRecord>> ReadAsync(string file, Guid tenantId)
    {
        var records = new List<OldRecord>();
        if (!File.Exists(file)) return records;
        await using var connection = new SqliteConnection($"Data Source={file};Mode=ReadOnly");
        await connection.OpenAsync();

        var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        await using (var info = connection.CreateCommand())
        {
            info.CommandText = "PRAGMA table_info(Users)";
            await using var reader = await info.ExecuteReaderAsync();
            while (await reader.ReadAsync()) columns.Add(reader.GetString(1));
        }
        if (columns.Count == 0) return records;
        string Optional(string column) => columns.Contains(column) ? column : $"NULL AS {column}";

        await using var command = connection.CreateCommand();
        command.CommandText = $"SELECT Id, Email, DisplayName, CreatedAt, {Optional("PasswordHash")}, {Optional("TermsAcceptedAt")}, {Optional("TermsVersion")} FROM Users";
        await using (var reader = await command.ExecuteReaderAsync())
            while (await reader.ReadAsync())
                records.Add(new OldRecord(tenantId, Guid.Parse(reader.GetString(0)), reader.GetString(1), reader.GetString(2), Utc(reader.GetString(3)),
                    reader.IsDBNull(4) ? null : reader.GetString(4), reader.IsDBNull(5) ? null : Utc(reader.GetString(5)), reader.IsDBNull(6) ? null : reader.GetString(6)));
        return records;
    }

    private static DateTime Utc(string text) =>
        DateTime.Parse(text, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal);
}
