using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;

namespace MyTickets.Api.Services;

/// <summary>
/// The only place wallet balances change. Every change is a single atomic UPDATE plus a ledger row,
/// so two bars charging the same card at the same moment can never push a balance below zero.
/// Callers that combine a wallet change with other writes wrap both in one database transaction.
/// </summary>
public class WalletService(AppDbContext db, TimeProvider clock)
{
    public async Task<Wallet> GetOrCreateAsync(Guid userId, Guid organisationId)
    {
        var wallet = await db.Wallets.FirstOrDefaultAsync(w => w.UserId == userId && w.OrganisationId == organisationId);
        if (wallet is not null) return wallet;
        wallet = new Wallet { Id = Guid.NewGuid(), UserId = userId, OrganisationId = organisationId };
        db.Wallets.Add(wallet);
        await db.SaveChangesAsync();
        return wallet;
    }

    public Task<int> BalanceAsync(Guid walletId) =>
        db.Wallets.Where(w => w.Id == walletId).Select(w => w.BalanceCents).FirstAsync();

    public async Task CreditAsync(Guid walletId, int amountCents, WalletTxType type, string description,
        Guid? performedBy = null, Guid? paymentId = null, Guid? requestId = null)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(amountCents);
        await db.Wallets.Where(w => w.Id == walletId)
            .ExecuteUpdateAsync(s => s.SetProperty(w => w.BalanceCents, w => w.BalanceCents + amountCents));
        await AddLedgerRowAsync(walletId, amountCents, type, description, performedBy, paymentId, requestId);
    }

    /// <summary>Takes credit off the wallet. Returns false, changing nothing, when the balance is too low.</summary>
    public async Task<bool> TryDebitAsync(Guid walletId, int amountCents, WalletTxType type, string description,
        Guid? performedBy = null, Guid? requestId = null)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(amountCents);
        var rows = await db.Wallets.Where(w => w.Id == walletId && w.BalanceCents >= amountCents)
            .ExecuteUpdateAsync(s => s.SetProperty(w => w.BalanceCents, w => w.BalanceCents - amountCents));
        if (rows == 0) return false;
        await AddLedgerRowAsync(walletId, -amountCents, type, description, performedBy, null, requestId);
        return true;
    }

    private async Task AddLedgerRowAsync(Guid walletId, int amount, WalletTxType type, string description,
        Guid? performedBy, Guid? paymentId, Guid? requestId)
    {
        db.WalletTransactions.Add(new WalletTransaction
        {
            Id = Guid.NewGuid(), WalletId = walletId, AmountCents = amount, Type = type, Description = description,
            PerformedByUserId = performedBy, PaymentId = paymentId, RequestId = requestId,
            CreatedAt = clock.GetUtcNow().UtcDateTime,
        });
        await db.SaveChangesAsync();
    }
}
