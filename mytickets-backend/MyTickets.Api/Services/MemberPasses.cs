using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;

namespace MyTickets.Api.Services;

/// <summary>
/// The code in a member's QR code. Staff scan or type it wherever they would tap the member's card: at the door,
/// behind the bar, at the cash top-up. It starts with "MT" so it can never be mistaken for a card number or a
/// ticket code (those are hex only).
/// </summary>
public static class MemberPasses
{
    private const string Prefix = "MT";
    private const int RandomLength = 12;
    // No 0/O or 1/I: staff may have to read it off a screen and type it.
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    public static string NewCode() => Prefix + RandomNumberGenerator.GetString(Alphabet, RandomLength);

    /// <summary>The canonical form of a scanned or typed pass code, or null when it isn't one.</summary>
    public static string? Normalise(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var code = new string(raw.Where(c => c is not (' ' or '-')).ToArray()).ToUpperInvariant();
        return code.Length == Prefix.Length + RandomLength && code.StartsWith(Prefix, StringComparison.Ordinal)
               && code[Prefix.Length..].All(Alphabet.Contains)
            ? code
            : null;
    }

    /// <summary>"MTABCD2345WXYZ" -> "MT-ABCD-2345-WXYZ", easier to read out.</summary>
    public static string Display(string code) =>
        $"{code[..2]}-{code[2..6]}-{code[6..10]}-{code[10..]}";

    /// <summary>The member's code, made and saved the first time it is asked for.</summary>
    public static async Task<string> EnsureCodeAsync(AppDbContext db, Guid membershipId)
    {
        for (var attempt = 0; ; attempt++)
        {
            var existing = await db.Memberships.Where(m => m.Id == membershipId).Select(m => m.PassCode).FirstAsync();
            if (existing is not null) return existing;
            var code = NewCode();
            try
            {
                // Only fills an empty code, so two first visits at once end up with the same one.
                await db.Memberships.Where(m => m.Id == membershipId && m.PassCode == null)
                    .ExecuteUpdateAsync(s => s.SetProperty(m => m.PassCode, code));
            }
            catch (Exception e) when (attempt < 3 && e is DbUpdateException or Microsoft.Data.Sqlite.SqliteException) { } // Another member drew the same code: draw again.
        }
    }
}
