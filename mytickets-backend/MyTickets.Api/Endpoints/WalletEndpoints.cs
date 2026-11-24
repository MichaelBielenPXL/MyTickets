using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

/// <summary>A member's wallet at the organisation: balance, history, and topping up online.</summary>
public static class WalletEndpoints
{
    public record TopUpRequest(int AmountCents, Guid? DealId = null);

    public static void MapWallet(this RouteGroupBuilder org)
    {
        org.MapGet("/wallet", async (HttpContext http, AppDbContext db) =>
        {
            var (o, _) = http.Org();
            var userId = http.User.TryUserId();
            var wallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(w => w.UserId == userId && w.OrganisationId == o.Id);
            if (wallet is null) return Http.Error(404, "Join this organisation to get a wallet.");
            var transactions = await db.WalletTransactions.AsNoTracking().Where(t => t.WalletId == wallet.Id)
                .OrderByDescending(t => t.CreatedAt).Take(100)
                .Select(t => new { t.Id, t.AmountCents, t.Type, t.Description, t.CreatedAt }).ToListAsync();
            var deals = await db.TopUpDeals.AsNoTracking().Where(d => d.OrganisationId == o.Id).OrderBy(d => d.SortOrder)
                .Select(d => new { d.Id, d.PriceCents, d.TokensCents }).ToListAsync();
            return Results.Ok(new { wallet.BalanceCents, Transactions = transactions, WalletService.MinTopUpCents, WalletService.MaxTopUpCents, Deals = deals });
        });

        // Top up with one of the organisation's deals (its own price for its own number of tokens), or any
        // amount at one token per euro. The price and tokens of a deal come from the database, never the phone.
        org.MapPost("/wallet/topup", async (TopUpRequest req, HttpContext http, AppDbContext db, PaymentService payments) =>
        {
            var (o, membership) = http.Org();
            if (membership is null) return Http.Error(403, "Join this organisation to get a wallet.");
            int priceCents, tokensCents;
            if (req.DealId is { } dealId)
            {
                var deal = await db.TopUpDeals.AsNoTracking().FirstOrDefaultAsync(d => d.Id == dealId && d.OrganisationId == o.Id);
                if (deal is null) return Http.Error(409, "This top-up is no longer offered. Reload and pick another.");
                (priceCents, tokensCents) = (deal.PriceCents, deal.TokensCents);
            }
            else
            {
                // An organisation with its own deals sells only those: no amount of your own choosing.
                if (await db.TopUpDeals.AnyAsync(d => d.OrganisationId == o.Id))
                    return Http.Error(409, "Pick one of the top-ups on offer.");
                if (req.AmountCents is < WalletService.MinTopUpCents or > WalletService.MaxTopUpCents)
                    return Http.Error(400, $"Top up between {Http.Euro(WalletService.MinTopUpCents)} and {Http.Euro(WalletService.MaxTopUpCents)}.");
                (priceCents, tokensCents) = (req.AmountCents, req.AmountCents);
            }
            var url = await payments.StartAsync(new Payment
            {
                Id = Guid.NewGuid(), UserId = http.User.UserId(), OrganisationId = o.Id, AmountCents = priceCents,
                TokensCents = tokensCents == priceCents ? null : tokensCents,
                Purpose = PaymentPurpose.TopUp, Description = $"{Http.Tokens(tokensCents)} for {Http.Euro(priceCents)}",
            });
            return Results.Ok(new { CheckoutUrl = url });
        });
    }
}
