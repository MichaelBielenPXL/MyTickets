MakeNpmFindable();

var builder = DistributedApplication.CreateBuilder(args);

var cache = builder.AddRedis("cache");

// RustFS: S3-compatible storage for uploaded pictures (logos, event images). The secret key is
// generated once and remembered in user secrets, so the stored pictures stay readable across restarts.
var storageAccessKey = builder.AddParameter("storage-access-key", "mytickets");
var storageSecretKey = builder.AddParameter("storage-secret-key",
    new GenerateParameterDefault { MinLength = 32, Special = false }, secret: true, persist: true);
var storage = builder.AddContainer("storage", "rustfs/rustfs", "1.0.6")
    .WithEnvironment("RUSTFS_ACCESS_KEY", storageAccessKey)
    .WithEnvironment("RUSTFS_SECRET_KEY", storageSecretKey)
    .WithHttpEndpoint(targetPort: 9000, name: "s3")
    .WithHttpEndpoint(targetPort: 9001, name: "console")
    .WithVolume("mytickets-images", "/data");

// The database is a SQLite file (mytickets.db) next to the API, so there is nothing to start for it.
var api = builder.AddProject<Projects.MyTickets_Api>("api")
    .WithReference(cache)
    .WaitFor(cache)
    .WithEnvironment("Storage__Endpoint", storage.GetEndpoint("s3"))
    .WithEnvironment("Storage__AccessKey", storageAccessKey)
    .WithEnvironment("Storage__SecretKey", storageSecretKey)
    .WaitFor(storage)
    .WithHttpHealthCheck("/health");

// The platform's Stripe keys, kept out of the code in this project's user secrets (run in this folder):
//   dotnet user-secrets set Stripe:SecretKey sk_test_...
//   dotnet user-secrets set Stripe:WebhookSecret whsec_...   (from "stripe listen" or the Stripe dashboard)
// Without them the API uses the test checkout, where no money moves.
foreach (var setting in new[] { "Stripe:SecretKey", "Stripe:WebhookSecret", "Stripe:PlatformFeePercent", "Stripe:PlatformFeeMaxCentsPerItem", "Stripe:MinimumMarginCents" })
    if (builder.Configuration[setting] is { Length: > 0 } value)
        api.WithEnvironment(setting.Replace(":", "__"), value);

// Fixed address so the site is always at http://localhost:5173.
builder.AddViteApp("frontend", "../../mytickets-frontend")
    .WithEndpoint("http", endpoint => endpoint.Port = 5173)
    .WithReference(api)
    .WaitFor(api);

builder.Build().Run();

// Node installed through nvm is only on the PATH of terminal windows. Started from an IDE's run
// button, the host would report that npm is missing, so look in nvm's folder and add it ourselves.
static void MakeNpmFindable()
{
    var path = Environment.GetEnvironmentVariable("PATH") ?? "";
    var onPath = path.Split(Path.PathSeparator).Any(dir => dir.Length > 0 && File.Exists(Path.Combine(dir, "npm")));
    if (onPath || OperatingSystem.IsWindows()) return;

    var versions = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".nvm", "versions", "node");
    if (!Directory.Exists(versions)) return;
    var newest = Directory.GetDirectories(versions)
        .Where(dir => File.Exists(Path.Combine(dir, "bin", "npm")))
        .OrderByDescending(dir => Version.TryParse(Path.GetFileName(dir).TrimStart('v'), out var v) ? v : new Version())
        .FirstOrDefault();
    if (newest is not null)
        Environment.SetEnvironmentVariable("PATH", Path.Combine(newest, "bin") + Path.PathSeparator + path);
}
