using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Endpoints;

namespace MyTickets.Api.Services;

/// <summary>
/// Finds the card staff tapped, scanned or typed: the chip's serial number (a tap), the card's link or link code
/// (the QR printed on it), or the number printed on it (typed).
/// </summary>
public static class CardLookup
{
    private const int MaxNumberDigits = 6;

    public static async Task<NfcCard?> FindAsync(AppDbContext db, string? raw)
    {
        var cards = db.NfcCards.AsNoTracking().Include(c => c.Wallet);
        if (CardCodes.Normalise(raw) is { } code && await cards.FirstOrDefaultAsync(c => c.Code == code) is { } byCode)
            return byCode;
        if (Http.NormaliseCardUid(raw) is { } uid && await cards.FirstOrDefaultAsync(c => c.Uid == uid) is { } bySerial)
            return bySerial;
        // Serial numbers have at least 8 digits, so a short number is the one printed on the card.
        var typed = raw?.Trim().TrimStart('#') ?? "";
        if (typed.Length is > 0 and <= MaxNumberDigits && typed.All(char.IsAsciiDigit))
            return await cards.FirstOrDefaultAsync(c => c.Number == int.Parse(typed));
        return null;
    }
}
