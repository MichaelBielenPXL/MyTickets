using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

public static partial class OrgEndpoints
{
    public record CreateOrgRequest(string? Name, string? Description);
    public record JoinRequest(Guid TierId, string? InviteCode);
    public record OrderItem(Guid TicketTypeId, int Quantity);
    public record OrderRequest(List<OrderItem>? Items, string? PayWith);
    public record TopUpRequest(int AmountCents, Guid? DealId = null);

    public const int MinTopUpCents = 500;
    public const int MaxTopUpCents = 50_000;

    /// <summary>Anyone may create an organisation unless Organisations:CreatorEmails lists who may.</summary>
    public static bool MayCreateOrganisation(IConfiguration config, string email)
    {
        var allowed = config.GetSection("Organisations:CreatorEmails").Get<string[]>() ?? [];
        return allowed.Length == 0 || allowed.Contains(email, StringComparer.OrdinalIgnoreCase);
    }

    public static void MapOrgs(this IEndpointRouteBuilder app)
    {
        var orgs = app.MapGroup("/api/orgs").RequireAuthorization();

        // Every organisation, marked with whether this browser is signed in there.
        orgs.MapGet("", async (HttpContext http, AppCache cache) =>
        {
            var signedInAt = Sessions.Accounts(http).Select(a => a.TenantId).ToHashSet();
            var all = await cache.OrganisationsAsync();
            return Results.Ok(all.Select(o => new { o.Slug, o.Name, o.Description, LogoUrl = Images.Url(o.LogoKey), Joined = signedInAt.Contains(o.Id) }));
        });

        // An owner adds another organisation. It gets its own database; nothing is shared with their other ones.
        orgs.MapPost("", async (CreateOrgRequest req, HttpContext http, PlatformDbContext platform, OrganisationProvisioner provisioner, IConfiguration config) =>
        {
            var owner = Sessions.OwnerId(http) is { } ownerId
                ? await platform.OwnerAccounts.AsNoTracking().FirstOrDefaultAsync(o => o.Id == ownerId)
                : null;
            if (owner is null) return Http.Error(403, "Sign in with your organiser account to create an organisation.");
            if (!MayCreateOrganisation(config, owner.Email)) return Http.Error(403, "You are not allowed to create organisations.");
            var name = req.Name?.Trim() ?? "";
            if (name.Length is < 2 or > 80) return Http.Error(400, "Give the organisation a name of 2 to 80 characters.");

            var baseSlug = OrganisationSlug.FromName(name);
            if (baseSlug.Length == 0 || OrganisationSlug.IsReserved(baseSlug))
                return Http.Error(400, "Choose a different organisation name.");

            // A taken address gets a number added. Try again if someone takes our pick in the same instant.
            for (var attempt = 0; attempt < 5; attempt++)
            {
                var slug = baseSlug;
                for (var n = 2; await platform.Tenants.AnyAsync(t => t.Slug == slug); n++) slug = $"{baseSlug}-{n}";
                try
                {
                    var (created, adminUserId) = await provisioner.CreateAsync(owner, ownerIsNew: false, name, slug, req.Description?.Trim() ?? "");
                    await Sessions.SignInAsync(http, Sessions.ForUser(created.Id, adminUserId));
                    return Results.Ok(new { created.Slug, created.Name });
                }
                catch (SlugTakenException) { }
            }
            return Http.Error(409, "Could not find a free page address for this name. Try another name.");
        });

        var org = app.MapGroup("/api/orgs/{slug}").RequireOrg(null);

        org.MapGet("", async (HttpContext http, AppDbContext db, IConfiguration config, TimeProvider clock) =>
        {
            var zone = MembershipService.LocalZone(config);
            var (o, membership) = http.Org();
            var now = clock.GetUtcNow().UtcDateTime;
            var userId = http.User.UserId();
            var tiers = await db.MembershipTiers.AsNoTracking()
                .Where(t => t.OrganisationId == o.Id && !t.Archived).OrderBy(t => t.SortOrder).ThenBy(t => t.PriceCents).ThenBy(t => t.Name).ToListAsync();
            var balance = await db.Wallets.Where(w => w.UserId == userId && w.OrganisationId == o.Id)
                .Select(w => (int?)w.BalanceCents).FirstOrDefaultAsync();
            var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId);
            var request = await db.MembershipRequests.AsNoTracking().Include(r => r.Tier)
                .Where(r => r.UserId == userId && r.Status != RequestStatus.Completed)
                .OrderByDescending(r => r.CreatedAt).FirstOrDefaultAsync();
            var events = await db.Events.AsNoTracking()
                .Where(e => e.OrganisationId == o.Id && e.Published).Where(Event.NotClosed(now))
                .OrderBy(e => e.StartsAt)
                .Select(e => new
                {
                    e.Id, e.Name, e.Location, e.StartsAt, e.EndsAt, e.ImageKey,
                    FromPriceCents = e.TicketTypes.Min(t => (int?)t.PriceCents),
                    SoldOut = e.TicketTypes.Any() && e.TicketTypes.All(t => t.Sold >= t.Capacity),
                }).ToListAsync();
            return Results.Ok(new
            {
                o.Slug, o.Name, o.Description, LogoUrl = Images.Url(o.LogoKey),
                // The colour lives only in the organisation's own database, not in the shared list the request came through.
                BrandColor = await db.Organisations.Where(x => x.Id == o.Id).Select(x => x.BrandColor).FirstOrDefaultAsync(),
                Membership = membership is null ? null : new
                {
                    membership.Role, membership.TierId, Tier = membership.Tier.Name, membership.ExpiresAt,
                    Active = membership.IsActive(now),
                    membership.Tier.TicketDiscountPercent, membership.Tier.DrinkDiscountPercent,
                },
                BalanceCents = balance,
                // Invite-only and ended tiers stay hidden unless you are already on one.
                Tiers = tiers.Where(t => (t.IsPublic && !t.HasEnded(now, zone)) || t.Id == membership?.TierId).Select(t => new
                {
                    t.Id, t.Name, t.Description, t.PriceCents, t.EndsOn, t.IsPublic, t.RequiresApproval,
                    t.TicketDiscountPercent, t.DrinkDiscountPercent,
                }),
                // An open request for a membership that needs approval: waiting, approved (ready to pay), or turned down.
                Request = request is null ? null : new { request.Id, request.TierId, Tier = request.Tier.Name, request.Status, request.CreatedAt },
                ProfileComplete = ProfileFields.IsComplete(user, ProfileFields.Read(await db.Organisations.AsNoTracking().FirstAsync())),
                HasInviteOnlyTiers = tiers.Any(t => !t.IsPublic && !t.HasEnded(now, zone)),
                Events = events.Select(e => new { e.Id, e.Name, e.Location, e.StartsAt, e.EndsAt, ImageUrl = Images.Url(e.ImageKey), e.FromPriceCents, e.SoldOut }),
            });
        });

        // Join the organisation, switch tier, or renew. Free tiers apply at once; paid tiers go through checkout.
        org.MapPost("/join", async (JoinRequest req, HttpContext http, AppDbContext db, MembershipService memberships, PaymentService payments,
            IConfiguration config, TimeProvider clock) =>
        {
            var (o, _) = http.Org();
            var userId = http.User.UserId();
            var code = req.InviteCode?.Trim();
            MembershipTier? tier;
            if (!string.IsNullOrEmpty(code))
            {
                // An invite code picks its own tier, so people only need the code.
                tier = await db.MembershipTiers.FirstOrDefaultAsync(t => t.OrganisationId == o.Id && !t.Archived && t.InviteCode == code);
                if (tier is null) return Http.Error(400, "That invite code is not valid.");
            }
            else
            {
                tier = await db.MembershipTiers.FirstOrDefaultAsync(t => t.Id == req.TierId && t.OrganisationId == o.Id && !t.Archived);
                if (tier is null) return Http.Error(404, "Membership type not found.");
                if (!tier.IsPublic) return Http.Error(403, "This membership needs an invite code.");
            }

            var now = clock.GetUtcNow().UtcDateTime;
            var zone = MembershipService.LocalZone(config);
            if (tier.HasEnded(now, zone))
                return Http.Error(409, $"\"{tier.Name}\" ended on {tier.EndsOn:dd/MM/yyyy}. Choose another membership.");
            // Renewing only makes sense when it gives you more time; never let someone pay for what they have.
            var current = await db.Memberships.AsNoTracking().FirstOrDefaultAsync(m => m.UserId == userId && m.OrganisationId == o.Id);
            if (current is not null && current.TierId == tier.Id && current.IsActive(now) && current.ExpiresAt == tier.ExpiresAt(zone))
                return Http.Error(409, current.ExpiresAt is { } until
                    ? $"You already have this membership until {TimeZoneInfo.ConvertTimeFromUtc(until, zone).AddDays(-1):dd/MM/yyyy}."
                    : "You already have this membership.");

            // The organisation's questions come first.
            var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId);
            if (!ProfileFields.IsComplete(user, ProfileFields.Read(await db.Organisations.AsNoTracking().FirstAsync())))
                return Results.Json(new { error = "Fill in your details first.", Code = "profile-incomplete" }, statusCode: 409);

            // Some memberships need an admin's yes first. The request waits; once approved, joining again goes through.
            if (tier.RequiresApproval)
            {
                var request = await db.MembershipRequests
                    .Where(r => r.UserId == userId && r.TierId == tier.Id && (r.Status == RequestStatus.Pending || r.Status == RequestStatus.Approved))
                    .OrderByDescending(r => r.CreatedAt).FirstOrDefaultAsync();
                if (request is null)
                {
                    // One open request at a time: asking for another membership replaces the earlier question.
                    await db.MembershipRequests.Where(r => r.UserId == userId && r.Status == RequestStatus.Pending).ExecuteDeleteAsync();
                    db.MembershipRequests.Add(new MembershipRequest
                    {
                        Id = Guid.NewGuid(), UserId = userId, TierId = tier.Id, Status = RequestStatus.Pending, CreatedAt = now,
                    });
                    await db.SaveChangesAsync();
                    return Results.Ok(new { Joined = false, Pending = true, CheckoutUrl = (string?)null });
                }
                if (request.Status == RequestStatus.Pending)
                    return Http.Error(409, $"Your request for \"{tier.Name}\" is still waiting for approval.");
            }

            if (tier.PriceCents == 0)
            {
                await using var tx = await db.Database.BeginTransactionAsync();
                await memberships.ApplyTierAsync(userId, o.Id, tier);
                await tx.CommitAsync();
                return Results.Ok(new { Joined = true, Pending = false, CheckoutUrl = (string?)null });
            }

            var url = await payments.StartAsync(new Payment
            {
                Id = Guid.NewGuid(), UserId = userId, OrganisationId = o.Id, AmountCents = tier.PriceCents,
                Purpose = PaymentPurpose.Membership, TierId = tier.Id, Description = $"{tier.Name} membership",
            });
            return Results.Ok(new { Joined = false, Pending = false, CheckoutUrl = (string?)url });
        });

        org.MapGet("/events/{eventId:guid}", async (Guid eventId, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var (o, membership) = http.Org();
            var userId = http.User.UserId();
            var now = clock.GetUtcNow().UtcDateTime;
            var ev = await db.Events.AsNoTracking().Include(e => e.TicketTypes)
                .FirstOrDefaultAsync(e => e.Id == eventId && e.OrganisationId == o.Id && e.Published);
            if (ev is null) return Http.Error(404, "Event not found.");
            var owned = await db.Tickets.Where(t => t.EventId == ev.Id && t.UserId == userId && t.Status != TicketStatus.Cancelled)
                .GroupBy(t => t.TicketTypeId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(g => g.Key, g => g.Count);
            var active = membership?.IsActive(now) == true;
            var discount = active ? membership!.Tier.TicketDiscountPercent : 0;
            return Results.Ok(new
            {
                ev.Id, ev.Name, ev.Description, ev.Location, ev.StartsAt, ev.EndsAt, ImageUrl = Images.Url(ev.ImageKey),
                Status = ev.Status(now),
                TicketTypes = ev.TicketTypes.OrderBy(t => t.PriceCents).ThenBy(t => t.Name).Select(t => new
                {
                    t.Id, t.Name, t.PriceCents, YourPriceCents = Http.Discounted(t.PriceCents, discount),
                    Available = t.Capacity - t.Sold, t.MaxPerUser, t.SalesStartAt, t.SalesEndAt,
                    OnSale = OnSale(t, now) && ev.Status(now) != EventStatus.Closed,
                    AllowedForYou = active && (t.AllowedTierIds.Count == 0 || t.AllowedTierIds.Contains(membership!.TierId)),
                    MembersOnly = t.AllowedTierIds.Count > 0,
                    Owned = owned.GetValueOrDefault(t.Id),
                }),
            });
        });

        org.MapPost("/events/{eventId:guid}/order", async (Guid eventId, OrderRequest req, HttpContext http, AppDbContext db,
            WalletService wallets, PaymentService payments, TimeProvider clock) =>
        {
            var (o, membership) = http.Org();
            var userId = http.User.UserId();
            var now = clock.GetUtcNow().UtcDateTime;
            if (membership is null) return Http.Error(403, "Join this organisation to buy tickets.");
            if (!membership.IsActive(now)) return Http.Error(403, "Your membership has expired. Renew it to buy tickets.");
            var payWithWallet = req.PayWith == "wallet";

            var items = (req.Items ?? []).Where(i => i.Quantity != 0)
                .GroupBy(i => i.TicketTypeId).Select(g => new OrderItem(g.Key, g.Sum(i => i.Quantity))).ToList();
            if (items.Count == 0) return Http.Error(400, "Choose at least one ticket.");
            if (items.Any(i => i.Quantity < 0)) return Http.Error(400, "Invalid quantity.");

            var ev = await db.Events.AsNoTracking().Include(e => e.TicketTypes)
                .FirstOrDefaultAsync(e => e.Id == eventId && e.OrganisationId == o.Id && e.Published);
            if (ev is null) return Http.Error(404, "Event not found.");
            if (ev.Status(now) == EventStatus.Closed) return Http.Error(409, "This event is closed. Tickets are no longer sold.");

            // Writers queue up on the database here, so the checks below and the reservation happen as one step.
            await using var tx = await db.Database.BeginTransactionAsync();
            var total = 0;
            var tickets = new List<Ticket>();
            foreach (var item in items)
            {
                var type = ev.TicketTypes.FirstOrDefault(t => t.Id == item.TicketTypeId);
                if (type is null) return Http.Error(400, "Unknown ticket.");
                if (!OnSale(type, now)) return Http.Error(409, $"\"{type.Name}\" is not on sale right now.");
                if (type.AllowedTierIds.Count > 0 && !type.AllowedTierIds.Contains(membership.TierId))
                    return Http.Error(403, $"\"{type.Name}\" is not available for your membership.");
                var owned = await db.Tickets.CountAsync(t => t.TicketTypeId == type.Id && t.UserId == userId && t.Status != TicketStatus.Cancelled);
                if (owned + item.Quantity > type.MaxPerUser)
                    return Http.Error(409, $"You can have at most {type.MaxPerUser} \"{type.Name}\" tickets.");

                var reserved = await db.TicketTypes.Where(t => t.Id == type.Id && t.Sold + item.Quantity <= t.Capacity)
                    .ExecuteUpdateAsync(s => s.SetProperty(t => t.Sold, t => t.Sold + item.Quantity));
                if (reserved == 0) return Http.Error(409, $"Not enough \"{type.Name}\" tickets left.");

                var price = Http.Discounted(type.PriceCents, membership.Tier.TicketDiscountPercent);
                total += price * item.Quantity;
                for (var n = 0; n < item.Quantity; n++)
                    tickets.Add(new Ticket
                    {
                        Id = Guid.NewGuid(), TicketTypeId = type.Id, EventId = ev.Id, UserId = userId, PricePaidCents = price,
                        Code = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(12)),
                        Status = TicketStatus.Valid, CreatedAt = now,
                    });
            }

            string? checkoutUrl = null;
            Payment? payment = null;
            if (total > 0 && payWithWallet)
            {
                var wallet = await wallets.GetOrCreateAsync(userId, o.Id);
                if (!await wallets.TryDebitAsync(wallet.Id, total, WalletTxType.TicketPurchase, $"Tickets for {ev.Name}"))
                    return Http.Error(402, "You don't have enough tokens for this.");
            }
            else if (total > 0)
            {
                payment = new Payment
                {
                    Id = Guid.NewGuid(), UserId = userId, OrganisationId = o.Id, AmountCents = total,
                    Purpose = PaymentPurpose.Tickets, Description = $"{tickets.Count} ticket(s) for {ev.Name}",
                };
                foreach (var t in tickets) { t.Status = TicketStatus.Reserved; t.PaymentId = payment.Id; }
                await payments.PrepareAsync(payment);
            }
            db.Tickets.AddRange(tickets);
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            // The tickets are held for this buyer now; open the payment page only after letting go of the database.
            if (payment is not null) checkoutUrl = await payments.CheckoutAsync(payment.Id);
            return Results.Ok(new { CheckoutUrl = checkoutUrl, Tickets = tickets.Count, TotalCents = total });
        });

        org.MapGet("/wallet", async (HttpContext http, AppDbContext db) =>
        {
            var (o, _) = http.Org();
            var userId = http.User.UserId();
            var wallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(w => w.UserId == userId && w.OrganisationId == o.Id);
            if (wallet is null) return Http.Error(404, "Join this organisation to get a wallet.");
            var transactions = await db.WalletTransactions.AsNoTracking().Where(t => t.WalletId == wallet.Id)
                .OrderByDescending(t => t.CreatedAt).Take(100)
                .Select(t => new { t.Id, t.AmountCents, t.Type, t.Description, t.CreatedAt }).ToListAsync();
            var deals = await db.TopUpDeals.AsNoTracking().Where(d => d.OrganisationId == o.Id).OrderBy(d => d.SortOrder)
                .Select(d => new { d.Id, d.PriceCents, d.TokensCents }).ToListAsync();
            return Results.Ok(new { wallet.BalanceCents, Transactions = transactions, MinTopUpCents, MaxTopUpCents, Deals = deals });
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
                if (req.AmountCents is < MinTopUpCents or > MaxTopUpCents)
                    return Http.Error(400, $"Top up between {Http.Euro(MinTopUpCents)} and {Http.Euro(MaxTopUpCents)}.");
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

    private static bool OnSale(TicketType t, DateTime now) =>
        (t.SalesStartAt is null || t.SalesStartAt <= now) && (t.SalesEndAt is null || t.SalesEndAt > now);
}
