using System.Text.RegularExpressions;

namespace MyTickets.Api.Services;

/// <summary>
/// An organisation's own colour: any "#rrggbb" that white text reads on, so it can match the club's crest
/// without making buttons or cards unreadable.
/// </summary>
public static partial class BrandColors
{
    /// <summary>White text on the colour must reach this contrast ratio (WCAG AA for normal text).</summary>
    public const double MinContrast = 4.5;

    public static bool IsValid(string color) => Hex().IsMatch(color);

    public static bool IsReadable(string color) => WhiteContrast(color) >= MinContrast;

    /// <summary>How well white text reads on this colour, as a WCAG contrast ratio (1 to 21).</summary>
    public static double WhiteContrast(string color)
    {
        static double Channel(string hex, int at)
        {
            var c = Convert.ToInt32(hex.Substring(at, 2), 16) / 255.0;
            return c <= 0.03928 ? c / 12.92 : Math.Pow((c + 0.055) / 1.055, 2.4);
        }
        var luminance = 0.2126 * Channel(color, 1) + 0.7152 * Channel(color, 3) + 0.0722 * Channel(color, 5);
        return 1.05 / (luminance + 0.05);
    }

    /// <summary>
    /// The colour itself when white text reads on it, else the nearest darker shade where it does: the safety
    /// net for a colour saved before this rule existed. Matches readableShade in the frontend.
    /// </summary>
    public static string ReadableShade(string color)
    {
        for (var darken = 0; darken <= 100; darken += 2)
        {
            var shade = "#" + string.Concat(new[] { 1, 3, 5 }.Select(at =>
                ((int)Math.Round(Convert.ToInt32(color.Substring(at, 2), 16) * (1 - darken / 100.0), MidpointRounding.AwayFromZero)).ToString("x2")));
            if (IsReadable(shade)) return shade;
        }
        return "#000000";
    }

    [GeneratedRegex("^#[0-9a-f]{6}$")]
    private static partial Regex Hex();
}
