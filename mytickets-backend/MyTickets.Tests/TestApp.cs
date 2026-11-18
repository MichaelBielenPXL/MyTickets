using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;

namespace MyTickets.Tests;

/// <summary>Runs the real API against a throwaway SQLite file.</summary>
public class TestApp : WebApplicationFactory<Program>
{
    private readonly string _dbPath = Path.Combine(Path.GetTempPath(), $"mytickets-test-{Guid.NewGuid():N}.db");

    /// <summary>Where this run keeps its database files.</summary>
    public string DataFolder => _dbPath + "-data";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        // One folder per test run: the shared list of organisations plus a database file per organisation.
        builder.UseSetting("Data:Folder", _dbPath + "-data");
        builder.UseSetting("ConnectionStrings:cache", "");
        builder.UseSetting("RateLimits:AuthPerMinute", "100000");
        builder.UseSetting("Storage:Endpoint", "");
        builder.UseSetting("Storage:Folder", _dbPath + "-images");
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        SqliteConnection.ClearAllPools();
        if (Directory.Exists(_dbPath + "-data")) Directory.Delete(_dbPath + "-data", recursive: true);
        if (Directory.Exists(_dbPath + "-images")) Directory.Delete(_dbPath + "-images", recursive: true);
    }

    /// <summary>A browser with its own cookies, signed in to one organisation as a brand-new guest account there.</summary>
    public async Task<HttpClient> NewGuestAsync(string organisationSlug, string name = "Guest", string? email = null)
    {
        var client = CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email = email ?? $"{name.ToLowerInvariant()}-{Guid.NewGuid():N}@example.com", password = "correct horse",
            displayName = name, joinOrganisationSlug = organisationSlug,
        });
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        // Their details, as given when choosing a membership. Tests about that form start from NewBareGuestAsync.
        (await client.PutAsJsonAsync($"/api/orgs/{organisationSlug}/me/profile", new { firstName = name, lastName = "Tester" })).EnsureSuccessStatusCode();
        return client;
    }

    /// <summary>A guest who has only chosen an email address and password, as right after signing up.</summary>
    public async Task<HttpClient> NewBareGuestAsync(string organisationSlug)
    {
        var client = CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"bare-{Guid.NewGuid():N}@example.com", password = "correct horse", joinOrganisationSlug = organisationSlug,
        });
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        return client;
    }

    /// <summary>A browser with its own cookies, signed in as a brand-new organiser (who gets a first organisation of their own).</summary>
    public async Task<HttpClient> NewUserAsync(string name)
    {
        var client = CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/register",
            new
            {
                email = $"{name.ToLowerInvariant()}-{Guid.NewGuid():N}@example.com", password = "correct horse", displayName = name,
                organisationName = $"Test {Guid.NewGuid():N}",
            });
        response.EnsureSuccessStatusCode();
        return client;
    }
}

public static class HttpExtensions
{
    public static async Task<JsonNode> PostOkAsync(this HttpClient client, string url, object body)
    {
        var response = await client.PostAsJsonAsync(url, body);
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, $"POST {url} -> {(int)response.StatusCode} {text}");
        return text.Length == 0 ? new JsonObject() : JsonNode.Parse(text)!;
    }

    public static async Task<JsonNode> GetOkAsync(this HttpClient client, string url)
    {
        var response = await client.GetAsync(url);
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, $"GET {url} -> {(int)response.StatusCode} {text}");
        return JsonNode.Parse(text)!;
    }

    /// <summary>Follows a checkout address as the buyer and presses "Pay" on the test checkout page.</summary>
    public static async Task PayAsync(this HttpClient client, JsonNode started)
    {
        var url = started["checkoutUrl"]!.GetValue<string>();
        // The address is /<organisation>/checkout/<payment>.
        var parts = url.Trim('/').Split('/');
        (await client.PostAsync($"/api/orgs/{parts[0]}/payments/{parts[2]}/test-pay", null)).EnsureSuccessStatusCode();
    }

    public static string Str(this JsonNode node, string key) => node[key]!.GetValue<string>();
    public static int Int(this JsonNode node, string key) => node[key]!.GetValue<int>();
}
