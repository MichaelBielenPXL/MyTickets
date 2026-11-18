using System.Text.RegularExpressions;

namespace MyTickets.Api.Services;

/// <summary>An organisation's own colour: any "#rrggbb", so it can match the club's crest.</summary>
public static partial class BrandColors
{
    public static bool IsValid(string color) => Hex().IsMatch(color);

    [GeneratedRegex("^#[0-9a-f]{6}$")]
    private static partial Regex Hex();
}
