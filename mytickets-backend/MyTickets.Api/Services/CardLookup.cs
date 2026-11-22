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

    /// <summary>
    /// Whose wallet a card or member QR code belongs to, for the till, the cashier and checking a card: a tapped or
    /// scanned card, or a scanned member code. Refuses unknown, unlinked and blocked cards.
    /// </summary>
    public static async Task<CardHolder> FindHolderAsync(AppDbContext db, Guid organisationId, string? raw)
    {
        if (MemberPasses.Normalise(raw) is { } passCode)
        {
            var member = await db.Memberships.AsNoTracking().Include(m => m.Tier).Include(m => m.User)
                .FirstOrDefaultAsync(m => m.PassCode == passCode && m.OrganisationId == organisationId)
                ?? throw AppProblem.NotFound("This member code is not known here.");
            var memberWallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(w => w.UserId == member.UserId && w.OrganisationId == organisationId)
                ?? throw AppProblem.NotFound($"{member.User.DisplayName} has no wallet here.");
            return new CardHolder(member.User, member, memberWallet);
        }
        if (string.IsNullOrWhiteSpace(raw)) throw AppProblem.BadRequest("Tap a card, or scan its QR code or a member QR code.");
        var card = await FindAsync(db, raw) ?? throw AppProblem.NotFound("This card is not known here.");
        if (card.Wallet is null) throw AppProblem.NotFound("This card isn't linked to anyone yet.");
        if (card.Blocked) throw AppProblem.Forbidden("This card is blocked.");
        var wallet = card.Wallet;
        var owner = await db.Users.AsNoTracking().FirstAsync(u => u.Id == wallet.UserId);
        var membership = await db.Memberships.AsNoTracking().Include(m => m.Tier)
            .FirstOrDefaultAsync(m => m.UserId == wallet.UserId && m.OrganisationId == organisationId)
            ?? throw AppProblem.NotFound($"{owner.DisplayName} has not joined this organisation.");
        return new CardHolder(owner, membership, wallet);
    }
}

/// <summary>The member a card (or member code) belongs to: who, their membership here, and the wallet it pays from.</summary>
public record CardHolder(User User, Membership Membership, Wallet Wallet);
