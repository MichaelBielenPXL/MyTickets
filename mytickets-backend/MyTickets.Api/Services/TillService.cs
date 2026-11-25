using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Endpoints;

namespace MyTickets.Api.Services;

/// <summary>
/// The till: charging an order at the bar to a card, and topping a card up at the cashier. Both are safe to send
/// twice (a phone on bad wifi): the request id makes a repeat return the first result instead of charging again.
/// </summary>
public class TillService(AppDbContext db, AppCache cache, WalletService wallets, TimeProvider clock)
{
    /// <summary>One line of an order. A negative quantity is a deposit handed back (an empty cup).</summary>
    public record Item(Guid ProductId, int Quantity);

    public record Result(int TotalCents, int DepositCents, int BalanceCents, string DisplayName, bool AlreadyProcessed);
    public record TopUpResult(int BalanceCents, string DisplayName, bool AlreadyProcessed);

    /// <summary>The lowest top-up at the cashier.</summary>
    public const int MinCashTopUpCents = 100;

    public async Task<Result> ChargeAsync(Guid organisationId, string? cardUid, IEnumerable<Item>? requested, Guid? requestId, Guid staffId)
    {
        // Buying and returning the same thing in one order cancels out, so only the difference is kept.
        var items = (requested ?? []).GroupBy(i => i.ProductId).Select(g => new Item(g.Key, g.Sum(i => i.Quantity)))
            .Where(i => i.Quantity != 0).ToList();
        if (items.Count == 0) throw AppProblem.BadRequest("The order is empty.");
        if (items.Any(i => i.Quantity is < -200 or > 200)) throw AppProblem.BadRequest("Invalid quantity.");
        var holder = await CardLookup.FindHolderAsync(db, organisationId, cardUid);

        // Prices come from the database, never from the cache or the phone: this is the amount that gets charged.
        var menu = await db.Products.AsNoTracking().Where(p => p.OrganisationId == organisationId && p.Active).ToDictionaryAsync(p => p.Id);
        if (items.Any(i => !menu.ContainsKey(i.ProductId)))
        {
            await cache.ProductsChangedAsync(organisationId);
            throw AppProblem.Conflict("The menu has changed. Reload and try again.");
        }
        if (items.FirstOrDefault(i => i.Quantity < 0 && !menu[i.ProductId].IsDeposit) is { } notDeposit)
            throw AppProblem.BadRequest($"\"{menu[notDeposit.ProductId].Name}\" can't be returned.");

        var (total, depositCents, description) = Price(items, menu, holder);

        await using var tx = await db.Database.BeginTransactionAsync();
        if (await AlreadyProcessedAsync(requestId))
            return new Result(total, depositCents, await wallets.BalanceAsync(holder.Wallet.Id), holder.User.DisplayName, true);
        if (total < 0)
        {
            // More came back than was bought: the difference goes onto the card.
            await wallets.CreditAsync(holder.Wallet.Id, -total, WalletTxType.Return, description, staffId, requestId: requestId, depositCents: depositCents);
        }
        else if (!await wallets.TryDebitAsync(holder.Wallet.Id, total, WalletTxType.Purchase, description, staffId, requestId, depositCents))
        {
            var balance = await wallets.BalanceAsync(holder.Wallet.Id);
            throw new AppProblem(402, $"Not enough tokens: {Http.Tokens(balance)} on the card, {Http.Tokens(total)} needed.",
                details: new Dictionary<string, object?> { ["balanceCents"] = balance, ["totalCents"] = total });
        }
        await tx.CommitAsync();
        return new Result(total, depositCents, await wallets.BalanceAsync(holder.Wallet.Id), holder.User.DisplayName, false);
    }

    /// <summary>Someone pays at the cashier (cash or card) and gets tokens on their card.</summary>
    public async Task<TopUpResult> TopUpAsync(Guid organisationId, string? cardUid, int amountCents, Guid? requestId, Guid staffId)
    {
        if (amountCents is < MinCashTopUpCents or > WalletService.MaxTopUpCents)
            throw AppProblem.BadRequest($"Top up between {Http.Euro(MinCashTopUpCents)} and {Http.Euro(WalletService.MaxTopUpCents)}.");
        var holder = await CardLookup.FindHolderAsync(db, organisationId, cardUid);

        await using var tx = await db.Database.BeginTransactionAsync();
        var repeated = await AlreadyProcessedAsync(requestId);
        if (!repeated)
            await wallets.CreditAsync(holder.Wallet.Id, amountCents, WalletTxType.CashTopUp, "Cash top-up", staffId, requestId: requestId);
        await tx.CommitAsync();
        return new TopUpResult(await wallets.BalanceAsync(holder.Wallet.Id), holder.User.DisplayName, repeated);
    }

    /// <summary>
    /// What the order costs, how much of that is deposit, and how it reads in the guest's history. Every drink that
    /// comes with a deposit adds one; the till works that out, so nobody can leave it off. A deposit is never
    /// discounted: otherwise a member could buy a cup cheaper than it is worth handed back, and every return would
    /// create credit out of nothing.
    /// </summary>
    private (int Total, int DepositCents, string Description) Price(List<Item> items, Dictionary<Guid, Product> menu, CardHolder holder)
    {
        var drinks = items.Where(i => !menu[i.ProductId].IsDeposit).ToList();
        var deposits = items.Where(i => menu[i.ProductId].IsDeposit).ToDictionary(i => i.ProductId, i => i.Quantity);
        foreach (var drink in drinks)
            if (menu[drink.ProductId].DepositProductId is { } depositId && menu.ContainsKey(depositId))
                deposits[depositId] = deposits.GetValueOrDefault(depositId) + drink.Quantity;

        var discount = holder.Membership.IsActive(clock.GetUtcNow().UtcDateTime) ? holder.Membership.Tier.DrinkDiscountPercent : 0;
        var depositCents = deposits.Sum(d => menu[d.Key].PriceCents * d.Value);
        var total = drinks.Sum(i => Prices.Discounted(menu[i.ProductId].PriceCents, discount) * i.Quantity) + depositCents;
        // A cup swapped for a new one (returned and charged again) cancels out and isn't mentioned.
        var description = string.Join(", ", drinks.Select(i => $"{i.Quantity}× {menu[i.ProductId].Name}")
            .Concat(deposits.Where(d => d.Value != 0).Select(d =>
                d.Value > 0 ? $"{d.Value}× {menu[d.Key].Name} deposit" : $"{-d.Value}× {menu[d.Key].Name} returned")));
        return (total, depositCents, description.Length > 300 ? description[..300] : description);
    }

    /// <summary>A phone on bad wifi may send the same sale twice; the request id lets us spot the repeat.</summary>
    private async Task<bool> AlreadyProcessedAsync(Guid? requestId) =>
        requestId is { } id && await db.WalletTransactions.AnyAsync(t => t.RequestId == id);
}
