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
builder.Services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<AppCache>();
builder.Services.AddScoped<WalletService>();
builder.Services.AddScoped<MembershipService>();
builder.Services.AddScoped<PaymentService>();
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

// Live, requests pass through proxies first (Vercel for the site's /api, then the server's own). Proxy:ForwardedHops
// says how many, so the visitor's own address is used for the sign-in limit and https is recognised.
var forwardedHops = builder.Configuration.GetValue("Proxy:ForwardedHops", 0);
if (forwardedHops > 0)
{
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        options.ForwardLimit = forwardedHops;
        // The proxies are on the server's private network and at Vercel, whose addresses change: trust the hops counted.
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

if (forwardedHops > 0) app.UseForwardedHeaders();

// A payment that can't be started is the buyer's business to know about, not an error page.
app.Use(async (http, next) =>
{
    try { await next(); }
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

// A request with an organisation in its address works on that organisation's database, and counts as
// signed in only if this browser has an account at that organisation.
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
        Sessions.NarrowTo(http, organisation.Id);
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
