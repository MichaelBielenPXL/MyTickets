using MyTickets.Api.Services.Email;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Endpoints;
using MyTickets.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Every organisation has its own database file. A small shared one lists the organisations and their owners.
builder.Services.AddSingleton<TenantDatabases>();
builder.Services.AddSingleton<TenantScopes>();
builder.Services.AddScoped<TenantContext>();
builder.Services.AddDbContext<PlatformDbContext>((services, options) =>
    options.UseSqlite(services.GetRequiredService<TenantDatabases>().PlatformConnectionString));
// Which organisation's database this is depends on who is asking: see TenantContext.
builder.Services.AddDbContext<AppDbContext>((services, options) => options.UseSqlite(
    services.GetRequiredService<TenantDatabases>().ConnectionStringFor(services.GetRequiredService<TenantContext>().Required.Id)));
builder.Services.AddScoped<OrganisationProvisioner>();

// Redis is used when the app is given a "cache" connection (the Aspire host does this). Without it the cache is memory only.
if (!string.IsNullOrEmpty(builder.Configuration.GetConnectionString("cache")))
    builder.AddRedisDistributedCache("cache");
builder.Services.AddHybridCache();

// Pictures go to an S3-compatible bucket when one is configured (the Aspire host starts RustFS), otherwise to a folder.
if (!string.IsNullOrEmpty(builder.Configuration["Storage:Endpoint"]))
    builder.Services.AddSingleton<IImageStore, S3ImageStore>();
else
    builder.Services.AddSingleton<IImageStore>(new FolderImageStore(
        builder.Configuration["Storage:Folder"] ?? Path.Combine(builder.Environment.ContentRootPath, "uploaded-images")));

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<IPasswordHasher<Account>, PasswordHasher<Account>>();
builder.Services.AddScoped<AppCache>();
builder.Services.AddScoped<WalletService>();
builder.Services.AddScoped<MembershipService>();
builder.Services.AddScoped<PaymentService>();
builder.Services.AddScoped<SettlementService>();
builder.Services.AddScoped<OutboxDispatcher>();
builder.Services.AddScoped<OverviewService>();
builder.Services.AddScoped<JoinService>();
builder.Services.AddScoped<TicketOrderService>();
builder.Services.AddScoped<TillService>();
builder.Services.AddScoped<DoorService>();
builder.Services.AddScoped<ProfileCopyService>();
builder.Services.AddScoped<AccountService>();
builder.Services.AddScoped<PasswordResetService>();
builder.Services.AddEmail(builder.Configuration);
builder.Services.AddSingleton<AppleWalletPasses>();
builder.Services.AddSingleton<GoogleWalletPasses>();
builder.Services.AddHostedService<PaymentExpiryWorker>();

// Payments go through Stripe Connect with the platform's key (Stripe:SecretKey). Without it, buyers get the
// test checkout on a developer's machine and can't pay online anywhere else.
builder.Services.AddHttpContextAccessor();
builder.Services.AddHttpClient<StripeClient>(client =>
{
    client.BaseAddress = new Uri(builder.Configuration["Stripe:ApiUrl"] ?? "https://api.stripe.com/v1/");
    client.Timeout = TimeSpan.FromSeconds(20);
});

// The keys that sign the sign-in cookie live with the data, so a restart or a new container keeps everyone signed in.
var dataFolder = builder.Configuration["Data:Folder"] ?? Path.Combine(builder.Environment.ContentRootPath, "data");
builder.Services.AddDataProtection()
    .SetApplicationName("MyTickets")
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(dataFolder, "keys")));

// Live, requests pass through proxies first. Two ways to find the visitor's own address, for the sign-in limit:
// Proxy:ClientIpHeader names a header the outermost proxy sets to it (Cloudflare: CF-Connecting-IP), or
// Proxy:ForwardedHops says how many proxies add themselves to X-Forwarded-For.
var clientIpHeader = builder.Configuration["Proxy:ClientIpHeader"];
var forwardedHops = builder.Configuration.GetValue("Proxy:ForwardedHops", 0);
var behindProxy = !string.IsNullOrWhiteSpace(clientIpHeader) || forwardedHops > 0;
if (behindProxy)
{
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        if (!string.IsNullOrWhiteSpace(clientIpHeader))
        {
            // One address, set by the proxy the visitor talked to.
            options.ForwardedForHeaderName = clientIpHeader;
            options.ForwardLimit = 1;
        }
        else
        {
            options.ForwardLimit = forwardedHops;
        }
        // The proxies' own addresses change (Cloudflare, Docker networks): trust the configured chain instead.
        options.KnownIPNetworks.Clear();
        options.KnownProxies.Clear();
    });
}

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(options =>
{
    options.Cookie.Name = "mytickets";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.ExpireTimeSpan = TimeSpan.FromDays(30);
    options.SlidingExpiration = true;
    // This is an API: answer with status codes instead of redirecting to a login page.
    options.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
    options.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
});
builder.Services.AddAuthorization();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("auth", http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = builder.Configuration.GetValue("RateLimits:AuthPerMinute", 20), Window = TimeSpan.FromMinutes(1) }));
});

builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    Directory.CreateDirectory(app.Services.GetRequiredService<TenantDatabases>().Folder);
    var platform = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();
    await platform.Database.MigrateAsync();
    await platform.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;");
}
// Records made before MyTickets accounts existed are linked to accounts, once (see AccountMerge).
await AccountMerge.RunAsync(app.Services, app.Logger);

if (behindProxy) app.UseForwardedHeaders();

// What can't be done is the person's business to know about, not an error page: a refusal from a service, or a
// payment that can't be started.
app.Use(async (http, next) =>
{
    try { await next(); }
    catch (AppProblem e) when (!http.Response.HasStarted)
    {
        var body = new Dictionary<string, object?>(e.Details) { ["error"] = e.Message };
        if (e.Code is not null) body["code"] = e.Code;
        await Results.Json(body, statusCode: e.Status).ExecuteAsync(http);
    }
    catch (PaymentsNotSetUpException e) when (!http.Response.HasStarted)
    {
        await Http.Error(409, e.Message).ExecuteAsync(http);
    }
    catch (StripeException e) when (!http.Response.HasStarted)
    {
        app.Logger.LogWarning("A Stripe request failed: {Message}", e.Message);
        await Http.Error(502, "The payment could not be started. Nothing was charged. Try again in a moment.").ExecuteAsync(http);
    }
});

app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();

// A request with an organisation in its address works on that organisation's database, signed in as the account's
// record there (if it has one).
app.Use(async (http, next) =>
{
    if (http.GetRouteValue("slug") is string slug && http.Request.Path.StartsWithSegments("/api"))
    {
        var organisation = await http.RequestServices.GetRequiredService<AppCache>().OrganisationBySlugAsync(slug);
        if (organisation is null)
        {
            await Http.Error(404, "Organisation not found.").ExecuteAsync(http);
            return;
        }
        await http.RequestServices.GetRequiredService<TenantDatabases>().EnsureReadyAsync(organisation.Id);
        http.RequestServices.GetRequiredService<TenantContext>().Set(organisation);
        await Sessions.NarrowToAsync(http, organisation.Id);
    }
    await next();
});

app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapAuth();
app.MapPublicOrgs();
app.MapMe();
app.MapOrgs();
app.MapAdmin();
app.MapStaff();
app.MapCards();
app.MapImages();
app.MapStripe();

app.Run();

public partial class Program;
