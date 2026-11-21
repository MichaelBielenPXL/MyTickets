using System.Security.Cryptography;

namespace MyTickets.Api.Services;

/// <summary>
/// The code in an issued card's link (<c>{PublicUrl}/c/{code}</c>), written to the chip and printed as a QR.
/// Random, so nobody can guess another card's link; no 0/O or 1/I, so it can be read off a print.
/// </summary>
public static class CardCodes
{
    private const int Length = 10;
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    public static string NewCode() => RandomNumberGenerator.GetString(Alphabet, Length);

    /// <summary>The code from a typed code or a scanned link, or null when it isn't one.</summary>
    public static string? Normalise(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var value = raw.Trim();
        if (Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https")
            value = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries).LastOrDefault() ?? "";
        var code = new string(value.Where(c => c is not (' ' or '-')).ToArray()).ToUpperInvariant();
        return code.Length == Length && code.All(Alphabet.Contains) ? code : null;
    }

    /// <summary>The card number as shown to admins and members: 42 -> "42".</summary>
    public static string Display(int number) => number.ToString(System.Globalization.CultureInfo.InvariantCulture);

    /// <summary>The link on the chip and in the printed QR.</summary>
    public static string Url(string publicUrl, string code) => $"{publicUrl.TrimEnd('/')}/c/{code}";
}
