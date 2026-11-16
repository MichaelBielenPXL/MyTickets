using System.Collections.Concurrent;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;

namespace MyTickets.Api.Services;

/// <summary>
/// Which organisation the current piece of work is for. Set once, right at the start (from the address
/// of a web request, or by whoever opened a <see cref="TenantScopes">scope</see>), and from then on the
/// organisation database handed out in this scope is that organisation's.
/// </summary>
public class TenantContext
{
    public Organisation? Organisation { get; private set; }

    public void Set(Organisation organisation) => Organisation = organisation;

    public Organisation Required => Organisation
        ?? throw new InvalidOperationException("No organisation was chosen for this work, so there is no database to use.");
}

/// <summary>Knows where each organisation's database file is and makes sure it is ready to use.</summary>
public class TenantDatabases(IConfiguration config, IWebHostEnvironment environment)
{
    private readonly ConcurrentDictionary<Guid, Lazy<Task>> _ready = new();

    public string Folder { get; } = config["Data:Folder"] ?? Path.Combine(environment.ContentRootPath, "data");

    public string PlatformConnectionString => $"Data Source={Path.Combine(Folder, "platform.db")}";

    public string FileFor(Guid tenantId) => Path.Combine(Folder, "organisations", $"{tenantId:N}.db");

    public string ConnectionStringFor(Guid tenantId) => $"Data Source={FileFor(tenantId)}";

    /// <summary>Creates or upgrades the organisation's database. Done once per organisation while the app runs.</summary>
    public Task EnsureReadyAsync(Guid tenantId) =>
        _ready.GetOrAdd(tenantId, id => new Lazy<Task>(() => PrepareAsync(id))).Value;

    private async Task PrepareAsync(Guid tenantId)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(FileFor(tenantId))!);
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(ConnectionStringFor(tenantId)).Options);
        await db.Database.MigrateAsync();
        // Let readers carry on while someone writes, and make writers wait their turn instead of failing.
        await db.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;");
    }

    /// <summary>Removes the database of an organisation whose creation did not complete.</summary>
    public void Discard(Guid tenantId)
    {
        _ready.TryRemove(tenantId, out _);
        SqliteConnection.ClearAllPools();
        foreach (var suffix in new[] { "", "-wal", "-shm" })
            if (File.Exists(FileFor(tenantId) + suffix)) File.Delete(FileFor(tenantId) + suffix);
    }
}

/// <summary>
/// For work that is not a web request inside one organisation: signing in, creating an organisation,
/// the background clean-up. Opens a scope whose services all work on the chosen organisation's database.
/// </summary>
public class TenantScopes(IServiceScopeFactory scopes, TenantDatabases databases)
{
    public async Task<AsyncServiceScope> OpenAsync(Organisation organisation)
    {
        await databases.EnsureReadyAsync(organisation.Id);
        var scope = scopes.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().Set(organisation);
        return scope;
    }
}

/// <summary>
/// The sign-in cookie holds one identity per organisation the browser is signed in to, plus one for an
/// owner login. Inside an organisation only that organisation's identity counts, so being signed in at
/// one organisation never gives access to another.
/// </summary>
public static class Sessions
{
    private const string TenantClaim = "tenant";
    private const string OwnerClaim = "owner";
    private const string Everyone = "mytickets:all-identities";

    public static ClaimsIdentity ForUser(Guid tenantId, Guid userId) => new(
        [new Claim(TenantClaim, tenantId.ToString()), new Claim(ClaimTypes.NameIdentifier, userId.ToString())],
        CookieAuthenticationDefaults.AuthenticationScheme);

    public static ClaimsIdentity ForOwner(Guid ownerId) => new(
        [new Claim(OwnerClaim, ownerId.ToString())], CookieAuthenticationDefaults.AuthenticationScheme);

    /// <summary>Every identity in the cookie, also after the request was narrowed to one organisation.</summary>
    public static ClaimsPrincipal All(HttpContext http) => http.Items[Everyone] as ClaimsPrincipal ?? http.User;

    public static Guid? OwnerId(HttpContext http) =>
        Guid.TryParse(All(http).FindFirstValue(OwnerClaim), out var id) ? id : null;

    /// <summary>The organisations this browser is signed in to, with the account used at each.</summary>
    public static IEnumerable<(Guid TenantId, Guid UserId)> Accounts(HttpContext http) =>
        from identity in All(http).Identities
        let tenant = identity.FindFirst(TenantClaim)?.Value
        let user = identity.FindFirst(ClaimTypes.NameIdentifier)?.Value
        where tenant is not null && user is not null
        select (Guid.Parse(tenant), Guid.Parse(user));

    /// <summary>From here on the request is "signed in" only as the account it has at this organisation, if any.</summary>
    public static void NarrowTo(HttpContext http, Guid tenantId)
    {
        var all = http.User;
        http.Items[Everyone] = all;
        var mine = all.Identities.FirstOrDefault(i => i.FindFirst(TenantClaim)?.Value == tenantId.ToString());
        http.User = new ClaimsPrincipal(mine ?? new ClaimsIdentity());
    }

    /// <summary>Adds identities to the cookie, replacing an earlier sign-in at the same organisation (or as owner).</summary>
    public static Task SignInAsync(HttpContext http, params ClaimsIdentity[] added)
    {
        static string KeyOf(ClaimsIdentity i) => i.FindFirst(TenantClaim)?.Value ?? (i.HasClaim(c => c.Type == OwnerClaim) ? OwnerClaim : "");
        var replaced = added.Select(KeyOf).ToHashSet();
        var kept = All(http).Identities.Where(i => i.IsAuthenticated && !replaced.Contains(KeyOf(i)));
        return WriteAsync(http, [.. kept, .. added]);
    }

    /// <summary>Signs out of one organisation and keeps the rest.</summary>
    public static Task SignOutOfAsync(HttpContext http, Guid tenantId)
    {
        var kept = All(http).Identities.Where(i => i.IsAuthenticated && i.FindFirst(TenantClaim)?.Value != tenantId.ToString()).ToArray();
        return kept.Length == 0 ? http.SignOutAsync() : WriteAsync(http, kept);
    }

    private static Task WriteAsync(HttpContext http, ClaimsIdentity[] identities) =>
        http.SignInAsync(new ClaimsPrincipal(identities), new AuthenticationProperties { IsPersistent = true });
}
