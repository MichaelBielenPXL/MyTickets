using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Endpoints;

namespace MyTickets.Api.Services;

/// <summary>
/// Finds the card staff tapped or scanned: the chip's serial number (a tap), or the card's link or link code
/// (the QR printed on it). Never by its number: that counts up 1, 2, 3…, so anyone could guess one.
/// </summary>
public static class CardLookup
{

    public static async Task<NfcCard?> FindAsync(AppDbContext db, string? raw)
    {
        var cards = db.NfcCards.AsNoTracking().Include(c => c.Wallet);
        if (CardCodes.Normalise(raw) is { } code && await cards.FirstOrDefaultAsync(c => c.Code == code) is { } byCode)
            return byCode;
        if (Http.NormaliseCardUid(raw) is { } uid && await cards.FirstOrDefaultAsync(c => c.Uid == uid) is { } bySerial)
            return bySerial;
        return null;
    }
}
