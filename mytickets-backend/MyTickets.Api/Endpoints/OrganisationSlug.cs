using System.Text.RegularExpressions;

namespace MyTickets.Api.Endpoints;

public static partial class OrganisationSlug
{
    private static readonly HashSet<string> Reserved = new(StringComparer.OrdinalIgnoreCase)
    {
        "api", "login", "register", "tickets", "cards", "checkout", "discover", "o", "health", "assets",
        "favicon.ico", "robots.txt", "sitemap.xml",
    };

    public static string FromName(string name) =>
        NonSlugChars().Replace(name.Trim().ToLowerInvariant(), "-").Trim('-');

    public static bool IsReserved(string slug) => Reserved.Contains(slug);

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NonSlugChars();
}
