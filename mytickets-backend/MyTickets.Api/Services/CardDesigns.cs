using System.Text.Json;
using System.Text.RegularExpressions;
using MyTickets.Api.Data;

namespace MyTickets.Api.Services;

/// <summary>One side of a printed card: its background (brand colour, another colour or a picture), the logo, and a line of text.</summary>
public record CardSide(string Background, string? Colour, string? ImageKey, bool ShowLogo, string Tagline);

/// <summary>
/// How an organisation's printed cards look, front and back. The front is the organisation's own; the back always
/// carries the QR (on a white tile, so it scans), the card number and the organisation's name, in a fixed layout.
/// </summary>
public record CardDesign(CardSide Front, CardSide Back);

public static partial class CardDesigns
{
    public const int MaxTaglineLength = 40;
    public static readonly CardSide DefaultSide = new("brand", null, null, true, "");
    public static readonly CardDesign Default = new(DefaultSide, DefaultSide);
    private static readonly string[] Backgrounds = ["brand", "colour", "image"];

    [GeneratedRegex("^#[0-9a-fA-F]{6}$")]
    private static partial Regex HexColour();

    public static CardDesign Load(Organisation organisation)
    {
        if (string.IsNullOrWhiteSpace(organisation.CardDesignJson)) return Default;
        try
        {
            using var json = JsonDocument.Parse(organisation.CardDesignJson);
            // Saved before cards had two sides: that one design is the back, the side with the QR.
            if (json.RootElement.TryGetProperty("Background", out _))
                return Default with { Back = json.RootElement.Deserialize<CardSide>() ?? DefaultSide };
            return json.RootElement.Deserialize<CardDesign>() ?? Default;
        }
        catch (JsonException) { return Default; }
    }

    /// <summary>The design in its stored form, or why it can't be saved.</summary>
    public static (CardDesign? Design, string? Problem) Check(CardDesign? asked, Guid organisationId)
    {
        if (asked?.Front is null || asked.Back is null) return (null, "Design both sides of the card.");
        var (front, frontProblem) = CheckSide(asked.Front, organisationId);
        if (front is null) return (null, frontProblem);
        var (back, backProblem) = CheckSide(asked.Back, organisationId);
        if (back is null) return (null, backProblem);
        return (new CardDesign(front, back), null);
    }

    private static (CardSide? Side, string? Problem) CheckSide(CardSide asked, Guid organisationId)
    {
        if (!Backgrounds.Contains(asked.Background)) return (null, "Choose a background for the card.");
        var tagline = asked.Tagline?.Trim() ?? "";
        if (tagline.Length > MaxTaglineLength) return (null, $"Keep the line on the card to {MaxTaglineLength} characters.");
        string? colour = null, imageKey = null;
        if (asked.Background == "colour")
        {
            if (asked.Colour is null || !HexColour().IsMatch(asked.Colour)) return (null, "Choose a colour for the card.");
            colour = asked.Colour.ToLowerInvariant();
        }
        if (asked.Background == "image")
        {
            if (asked.ImageKey is null || !Images.BelongsTo(asked.ImageKey, organisationId)) return (null, "Upload the picture for the card again.");
            imageKey = asked.ImageKey;
        }
        return (new CardSide(asked.Background, colour, imageKey, asked.ShowLogo, tagline), null);
    }
}
