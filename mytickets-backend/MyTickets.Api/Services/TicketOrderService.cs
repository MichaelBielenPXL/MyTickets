using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;

namespace MyTickets.Api.Services;

/// <summary>
/// A member ordering tickets for an event, paid with tokens or online. The checks and the reservation happen in one
/// transaction, so two buyers can never get the last ticket both. Refusals are <see cref="AppProblem"/>s.
/// </summary>
public class TicketOrderService(AppDbContext db, WalletService wallets, PaymentService payments, TimeProvider clock)
{
    public record Item(Guid TicketTypeId, int Quantity);

    /// <summary>The tickets are theirs (or held, when <see cref="CheckoutUrl"/> is where to pay for them).</summary>
    public record Result(string? CheckoutUrl, int Tickets, int TotalCents);

    public async Task<Result> OrderAsync(Organisation organisation, Membership? membership, Guid userId, Guid eventId,
        IEnumerable<Item>? requested, bool payWithWallet)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        if (membership is null) throw AppProblem.Forbidden("Join this organisation to buy tickets.");
        if (!membership.IsActive(now)) throw AppProblem.Forbidden("Your membership has expired. Renew it to buy tickets.");
        var items = Normalise(requested);

        var ev = await db.Events.AsNoTracking().Include(e => e.TicketTypes)
            .FirstOrDefaultAsync(e => e.Id == eventId && e.OrganisationId == organisation.Id && e.Published)
            ?? throw AppProblem.NotFound("Event not found.");
        if (ev.Status(now) == EventStatus.Closed) throw AppProblem.Conflict("This event is closed. Tickets are no longer sold.");

        // Writers queue up on the database here, so the checks below and the reservation happen as one step.
        await using var tx = await db.Database.BeginTransactionAsync();
        var tickets = new List<Ticket>();
        foreach (var item in items)
            tickets.AddRange(await ReserveAsync(ev, item, membership, userId, now));
        var total = tickets.Sum(t => t.PricePaidCents);

        Payment? payment = null;
        if (total > 0 && payWithWallet)
        {
            var wallet = await wallets.GetOrCreateAsync(userId, organisation.Id);
            if (!await wallets.TryDebitAsync(wallet.Id, total, WalletTxType.TicketPurchase, $"Tickets for {ev.Name}"))
                throw new AppProblem(402, "You don't have enough tokens for this.");
        }
        else if (total > 0)
        {
            payment = new Payment
            {
                Id = Guid.NewGuid(), UserId = userId, OrganisationId = organisation.Id, AmountCents = total,
                Purpose = PaymentPurpose.Tickets, Description = $"{tickets.Count} ticket(s) for {ev.Name}",
            };
            // Held for the buyer until they have paid.
            foreach (var t in tickets) { t.Status = TicketStatus.Reserved; t.PaymentId = payment.Id; }
            await payments.PrepareAsync(payment);
        }
        db.Tickets.AddRange(tickets);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        // The tickets are held for this buyer now; open the payment page only after letting go of the database.
        var checkoutUrl = payment is null ? null : await payments.CheckoutAsync(payment.Id);
        return new Result(checkoutUrl, tickets.Count, total);
    }

    /// <summary>One line per ticket type, quantities added up; at least one, none negative.</summary>
    private static List<Item> Normalise(IEnumerable<Item>? requested)
    {
        var items = (requested ?? []).Where(i => i.Quantity != 0)
            .GroupBy(i => i.TicketTypeId).Select(g => new Item(g.Key, g.Sum(i => i.Quantity))).ToList();
        if (items.Count == 0) throw AppProblem.BadRequest("Choose at least one ticket.");
        if (items.Any(i => i.Quantity < 0)) throw AppProblem.BadRequest("Invalid quantity.");
        return items;
    }

    /// <summary>Checks one line of the order and takes the tickets off the stock; the tickets, not saved yet.</summary>
    private async Task<List<Ticket>> ReserveAsync(Event ev, Item item, Membership membership, Guid userId, DateTime now)
    {
        var type = ev.TicketTypes.FirstOrDefault(t => t.Id == item.TicketTypeId) ?? throw AppProblem.BadRequest("Unknown ticket.");
        if (!type.IsOnSale(now)) throw AppProblem.Conflict($"\"{type.Name}\" is not on sale right now.");
        if (type.AllowedTierIds.Count > 0 && !type.AllowedTierIds.Contains(membership.TierId))
            throw AppProblem.Forbidden($"\"{type.Name}\" is not available for your membership.");
        var owned = await db.Tickets.CountAsync(t => t.TicketTypeId == type.Id && t.UserId == userId && t.Status != TicketStatus.Cancelled);
        if (owned + item.Quantity > type.MaxPerUser)
            throw AppProblem.Conflict($"You can have at most {type.MaxPerUser} \"{type.Name}\" tickets.");

        var reserved = await db.TicketTypes.Where(t => t.Id == type.Id && t.Sold + item.Quantity <= t.Capacity)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.Sold, t => t.Sold + item.Quantity));
        if (reserved == 0) throw AppProblem.Conflict($"Not enough \"{type.Name}\" tickets left.");

        var price = Prices.Discounted(type.PriceCents, membership.Tier.TicketDiscountPercent);
        return Enumerable.Range(0, item.Quantity).Select(_ => new Ticket
        {
            Id = Guid.NewGuid(), TicketTypeId = type.Id, EventId = ev.Id, UserId = userId, PricePaidCents = price,
            Code = Convert.ToHexString(RandomNumberGenerator.GetBytes(12)), Status = TicketStatus.Valid, CreatedAt = now,
        }).ToList();
    }
}
