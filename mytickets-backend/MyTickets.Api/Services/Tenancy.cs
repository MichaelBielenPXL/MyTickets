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
/// The sign-in cookie holds the MyTickets account only. A request inside an organisation is then signed in as the
/// account's record at that organisation, if it has one (see <see cref="NarrowToAsync"/>), so everything there works
/// with that organisation's own user. Without a record the request is still signed in, but as no one there yet.
/// </summary>
public static class Sessions
{
    public const string AccountClaim = "account";
    private const string Everyone = "mytickets:account";

    /// <summary>The cookie's own identity, also after the request was narrowed to one organisation.</summary>
    public static ClaimsPrincipal All(HttpContext http) => http.Items[Everyone] as ClaimsPrincipal ?? http.User;

    /// <summary>The MyTickets account this browser is signed in with, if any.</summary>
    public static Guid? AccountId(HttpContext http) =>
        Guid.TryParse(All(http).FindFirstValue(AccountClaim), out var id) ? id : null;

    /// <summary>
    /// From here on the request is signed in as the account's record at this organisation (its user id there), or,
    /// without one, as the account alone: signed in, but not anyone at this organisation yet.
    /// </summary>
    public static async Task NarrowToAsync(HttpContext http, Guid tenantId)
    {
        var all = http.User;
        http.Items[Everyone] = all;
        if (AccountId(http) is not { } accountId)
        {
            http.User = new ClaimsPrincipal(new ClaimsIdentity());
            return;
        }
        var claims = new List<Claim> { new(AccountClaim, accountId.ToString()) };
        if (await http.RequestServices.GetRequiredService<AccountService>().RecordAtAsync(accountId, tenantId) is { } userId)
            claims.Add(new Claim(ClaimTypes.NameIdentifier, userId.ToString()));
        http.User = new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme));
    }

    public static Task SignInAsync(HttpContext http, Guid accountId) =>
        http.SignInAsync(
            new ClaimsPrincipal(new ClaimsIdentity([new Claim(AccountClaim, accountId.ToString())], CookieAuthenticationDefaults.AuthenticationScheme)),
            new AuthenticationProperties { IsPersistent = true });
}
