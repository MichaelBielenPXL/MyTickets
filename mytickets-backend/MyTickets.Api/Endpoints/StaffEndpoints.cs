using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

/// <summary>What the people at the door and behind the bar use.</summary>
public static class StaffEndpoints
{
    public record LookupRequest(string? CardUid, Guid? EventId);
    public record CheckInRequest(Guid EventId, string? Code, string? CardUid);
    public record ChargeItem(Guid ProductId, int Quantity);
    public record ChargeRequest(string? CardUid, List<ChargeItem>? Items, Guid? RequestId);
    public record CashTopUpRequest(string? CardUid, int AmountCents, Guid? RequestId);

    private record Holder(NfcCard Card, Membership Membership, Wallet Wallet);

    public static void MapStaff(this IEndpointRouteBuilder app)
    {
        var staff = app.MapGroup("/api/orgs/{slug}/staff").RequireOrg(OrgRole.Staff);

        staff.MapGet("/context", async (HttpContext http, AppDbContext db, AppCache cache, TimeProvider clock) =>
        {
            var org = http.Org().Org;
            var since = clock.GetUtcNow().UtcDateTime.AddDays(-1);
            var events = await db.Events.AsNoTracking()
                .Where(e => e.OrganisationId == org.Id && e.Published && (e.EndsAt ?? e.StartsAt) > since)
                .OrderBy(e => e.StartsAt).Select(e => new { e.Id, e.Name, e.StartsAt }).ToListAsync();
            return Results.Ok(new { org.Name, Events = events, Products = await cache.ActiveProductsAsync(org.Id) });
        });

        staff.MapPost("/lookup", async (LookupRequest req, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var org = http.Org().Org;
            var (holder, error) = await FindHolderAsync(db, org.Id, req.CardUid);
            if (holder is null) return error!;
            var now = clock.GetUtcNow().UtcDateTime;
            var tickets = req.EventId is null ? [] : await db.Tickets.AsNoTracking()
                .Where(t => t.EventId == req.EventId && t.UserId == holder.Card.UserId &&
                            (t.Status == TicketStatus.Valid || t.Status == TicketStatus.CheckedIn))
                .Select(t => new { TicketType = t.TicketType.Name, t.Status, t.CheckedInAt }).ToListAsync();
            return Results.Ok(new
            {
                Name = holder.Card.User.DisplayName, Tier = holder.Membership.Tier.Name,
                MembershipActive = holder.Membership.IsActive(now), holder.Membership.ExpiresAt,
                holder.Wallet.BalanceCents, Tickets = tickets,
                DrinkDiscountPercent = holder.Membership.IsActive(now) ? holder.Membership.Tier.DrinkDiscountPercent : 0,
            });
        });

        // Let someone in: scan the ticket's QR code, or tap the card of the person who bought it.
        staff.MapPost("/checkin", async (CheckInRequest req, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var org = http.Org().Org;
            var staffId = http.User.UserId();
            var now = clock.GetUtcNow().UtcDateTime;
            if (!await db.Events.AnyAsync(e => e.Id == req.EventId && e.OrganisationId == org.Id)) return Http.Error(404, "Event not found.");

            var candidates = db.Tickets.Where(t => t.EventId == req.EventId);
            if (!string.IsNullOrWhiteSpace(req.Code))
            {
                var code = req.Code.Trim().ToUpperInvariant();
                candidates = candidates.Where(t => t.Code == code);
            }
            else
            {
                var uid = Http.NormaliseCardUid(req.CardUid);
                if (uid is null) return Http.Error(400, "Scan a ticket or tap a card.");
                var card = await db.NfcCards.AsNoTracking().FirstOrDefaultAsync(c => c.Uid == uid);
                if (card is null) return Http.Error(404, "This card is not linked to an account.");
                if (card.Blocked) return Http.Error(403, "This card is blocked.");
                candidates = candidates.Where(t => t.UserId == card.UserId);
            }

            var found = await candidates.AsNoTracking()
                .Where(t => t.Status == TicketStatus.Valid || t.Status == TicketStatus.CheckedIn)
                .OrderBy(t => t.Status == TicketStatus.Valid ? 0 : 1).ThenBy(t => t.CreatedAt)
                .Select(t => new { t.Id, t.Status, t.CheckedInAt, Name = t.User.DisplayName, TicketType = t.TicketType.Name })
                .ToListAsync();
            if (found.Count == 0) return Http.Error(404, "No ticket for this event.");

            foreach (var ticket in found.Where(t => t.Status == TicketStatus.Valid))
            {
                // Atomic, so the same ticket scanned at two doors at once only gets in once.
                var rows = await db.Tickets.Where(t => t.Id == ticket.Id && t.Status == TicketStatus.Valid)
                    .ExecuteUpdateAsync(s => s.SetProperty(t => t.Status, TicketStatus.CheckedIn)
                        .SetProperty(t => t.CheckedInAt, now).SetProperty(t => t.CheckedInByUserId, staffId));
                if (rows == 1)
                    return Results.Ok(new { ticket.Name, ticket.TicketType, Remaining = found.Count(t => t.Status == TicketStatus.Valid) - 1 });
            }
            var last = found.Max(t => t.CheckedInAt);
            return Results.Json(new { error = "Already checked in.", found[0].Name, CheckedInAt = last }, statusCode: 409);
        });

        staff.MapPost("/charge", async (ChargeRequest req, HttpContext http, AppDbContext db, AppCache cache, WalletService wallets, TimeProvider clock) =>
        {
            var org = http.Org().Org;
            // A negative quantity is something handed back (a cup with a deposit). Buying and returning
            // the same product in one order cancels out, so only the difference is kept.
            var items = (req.Items ?? []).GroupBy(i => i.ProductId).Select(g => new ChargeItem(g.Key, g.Sum(i => i.Quantity)))
                .Where(i => i.Quantity != 0).ToList();
            if (items.Count == 0) return Http.Error(400, "The order is empty.");
            if (items.Any(i => i.Quantity is < -200 or > 200)) return Http.Error(400, "Invalid quantity.");
            var (holder, error) = await FindHolderAsync(db, org.Id, req.CardUid);
            if (holder is null) return error!;

            // Prices come from the database, never from the cache or the phone: this is the amount that gets charged.
            var ids = items.Select(i => i.ProductId).ToList();
            var products = await db.Products.AsNoTracking()
                .Where(p => p.OrganisationId == org.Id && p.Active && ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id);
            if (products.Count != items.Count)
            {
                await cache.ProductsChangedAsync(org.Id);
                return Http.Error(409, "The menu has changed. Reload and try again.");
            }
            if (items.FirstOrDefault(i => i.Quantity < 0 && !products[i.ProductId].Returnable) is { } notReturnable)
                return Http.Error(400, $"\"{products[notReturnable.ProductId].Name}\" can't be returned.");

            // A deposit is never discounted. Otherwise a member could buy a cup cheaper than it is worth
            // handed back, and every return would create credit out of nothing.
            var discount = holder.Membership.IsActive(clock.GetUtcNow().UtcDateTime) ? holder.Membership.Tier.DrinkDiscountPercent : 0;
            int PriceOf(Product product) => product.Returnable ? product.PriceCents : Http.Discounted(product.PriceCents, discount);
            var total = items.Sum(i => PriceOf(products[i.ProductId]) * i.Quantity);
            var description = string.Join(", ", items.Select(i =>
                i.Quantity > 0 ? $"{i.Quantity}× {products[i.ProductId].Name}" : $"{-i.Quantity}× {products[i.ProductId].Name} returned"));
            if (description.Length > 300) description = description[..300];

            await using var tx = await db.Database.BeginTransactionAsync();
            if (await AlreadyProcessedAsync(db, req.RequestId))
                return Results.Ok(new { TotalCents = total, BalanceCents = await wallets.BalanceAsync(holder.Wallet.Id), holder.Card.User.DisplayName, AlreadyProcessed = true });
            if (total < 0)
            {
                // More came back than was bought: the difference goes onto the card.
                await wallets.CreditAsync(holder.Wallet.Id, -total, WalletTxType.Return, description, http.User.UserId(), requestId: req.RequestId);
            }
            else if (!await wallets.TryDebitAsync(holder.Wallet.Id, total, WalletTxType.Purchase, description, http.User.UserId(), req.RequestId))
            {
                var balance = await wallets.BalanceAsync(holder.Wallet.Id);
                return Results.Json(new { error = $"Not enough credit: {Http.Euro(balance)} on the card, {Http.Euro(total)} needed.", BalanceCents = balance, TotalCents = total }, statusCode: 402);
            }
            await tx.CommitAsync();
            return Results.Ok(new { TotalCents = total, BalanceCents = await wallets.BalanceAsync(holder.Wallet.Id), holder.Card.User.DisplayName, AlreadyProcessed = false });
        });

        // Someone hands over cash at the event and gets credit on their card.
        staff.MapPost("/topup", async (CashTopUpRequest req, HttpContext http, AppDbContext db, WalletService wallets) =>
        {
            var org = http.Org().Org;
            if (req.AmountCents is < 100 or > OrgEndpoints.MaxTopUpCents)
                return Http.Error(400, $"Top up between €1.00 and {Http.Euro(OrgEndpoints.MaxTopUpCents)}.");
            var (holder, error) = await FindHolderAsync(db, org.Id, req.CardUid);
            if (holder is null) return error!;

            await using var tx = await db.Database.BeginTransactionAsync();
            var repeated = await AlreadyProcessedAsync(db, req.RequestId);
            if (!repeated)
                await wallets.CreditAsync(holder.Wallet.Id, req.AmountCents, WalletTxType.CashTopUp, "Cash top-up", http.User.UserId(), requestId: req.RequestId);
            await tx.CommitAsync();
            return Results.Ok(new { BalanceCents = await wallets.BalanceAsync(holder.Wallet.Id), holder.Card.User.DisplayName, AlreadyProcessed = repeated });
        });
    }

    /// <summary>A phone on bad wifi may send the same sale twice; the request id lets us spot the repeat.</summary>
    private static async Task<bool> AlreadyProcessedAsync(AppDbContext db, Guid? requestId) =>
        requestId is { } id && await db.WalletTransactions.AnyAsync(t => t.RequestId == id);

    private static async Task<(Holder?, IResult?)> FindHolderAsync(AppDbContext db, Guid orgId, string? rawUid)
    {
        var uid = Http.NormaliseCardUid(rawUid);
        if (uid is null) return (null, Http.Error(400, "Tap a card or enter its number."));
        var card = await db.NfcCards.AsNoTracking().Include(c => c.User).FirstOrDefaultAsync(c => c.Uid == uid);
        if (card is null) return (null, Http.Error(404, "This card is not linked to an account."));
        if (card.Blocked) return (null, Http.Error(403, "This card is blocked."));
        var membership = await db.Memberships.AsNoTracking().Include(m => m.Tier)
            .FirstOrDefaultAsync(m => m.UserId == card.UserId && m.OrganisationId == orgId);
        var wallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(w => w.UserId == card.UserId && w.OrganisationId == orgId);
        if (membership is null || wallet is null)
            return (null, Http.Error(404, $"{card.User.DisplayName} has not joined this organisation."));
        return (new Holder(card, membership, wallet), null);
    }
}
