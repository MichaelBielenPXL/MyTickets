using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

/// <summary>
/// Cards the organisation issues. Admins make them, write each one to a chip (the chip gets the card's link and
/// the server learns the chip's serial number), and members claim one by tapping it with their phone.
/// </summary>
public static class CardEndpoints
{
    public record CreateCardsRequest(int Count);
    public record WrittenRequest(string? Uid, bool Locked);
    public record BlockedRequest(bool Blocked);
    public record ExtraCardRequest(bool Allowed);

    /// <summary>A member links at most one new card in this many days, unless an admin allows one more.</summary>
    private const int DaysBetweenCards = 365;

    private const int MaxCardsAtOnce = 500;

    public static void MapCards(this IEndpointRouteBuilder app)
    {
        // A card's link carries no organisation name, so it still works after a rename.
        app.MapGet("/api/c/{code}", async (string code, PlatformDbContext platform) =>
        {
            var normal = CardCodes.Normalise(code);
            var slug = normal is null ? null : await (
                from c in platform.CardCodes.AsNoTracking()
                join t in platform.Tenants.AsNoTracking() on c.TenantId equals t.Id
                where c.Code == normal
                select t.Slug).FirstOrDefaultAsync();
            return slug is null ? Http.Error(404, "This card is not known.") : Results.Ok(new { Slug = slug });
        });

        // A member's phone after tapping a card: whose card is this, and claim it.
        var cards = app.MapGroup("/api/orgs/{slug}/cards").RequireOrg(null);

        cards.MapGet("/{code}", async (string code, HttpContext http, AppDbContext db) =>
        {
            var card = await FindByCodeAsync(db, code);
            if (card is null) return Http.Error(404, "This card is not known here.");
            var access = http.Org();
            var userId = http.User.UserId();
            var state = card.Blocked ? "blocked"
                : card.Wallet is null ? "free"
                : card.Wallet.UserId == userId ? "mine"
                : "taken";
            return Results.Ok(new { Number = CardCodes.Display(card.Number), State = state, Member = access.Membership is not null });
        });

        cards.MapPost("/{code}/link", async (string code, HttpContext http, AppDbContext db, WalletService wallets, IConfiguration config, TimeProvider clock) =>
        {
            var card = await FindByCodeAsync(db, code);
            if (card is null) return Http.Error(404, "This card is not known here.");
            var access = http.Org();
            if (access.Membership is null) return Http.Error(403, "Join this organisation to link a card.");
            var wallet = await wallets.GetOrCreateAsync(http.User.UserId(), access.Org.Id);
            if (card.WalletId == wallet.Id) return Results.Ok(new { Number = CardCodes.Display(card.Number) });
            if (card.Blocked) return Http.Error(409, "This card is blocked.");
            if (card.WalletId is not null) return Http.Error(409, "This card is linked to another account.");

            var now = clock.GetUtcNow().UtcDateTime;
            if (!wallet.ExtraCardAllowed)
            {
                var last = await db.NfcCards.Where(c => c.WalletId == wallet.Id).MaxAsync(c => c.LinkedAt);
                if (last is { } linked && linked.AddDays(DaysBetweenCards) > now)
                {
                    var zone = TimeZoneInfo.FindSystemTimeZoneById(config["App:TimeZone"] ?? "Europe/Brussels");
                    var on = TimeZoneInfo.ConvertTimeFromUtc(Http.Utc(linked), zone);
                    return Http.Error(409, $"You linked a card on {on:dd/MM/yyyy}. You can link a new one from {on.AddDays(DaysBetweenCards):dd/MM/yyyy}, or ask the organisation.");
                }
            }

            // Only if still free: two phones tapping the same card at once can't both get it.
            var rows = await db.NfcCards.Where(c => c.Id == card.Id && c.WalletId == null && !c.Blocked)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.WalletId, wallet.Id).SetProperty(c => c.LinkedAt, now));
            if (rows == 0) return Http.Error(409, "This card is linked to another account.");
            if (wallet.ExtraCardAllowed)
                await db.Wallets.Where(w => w.Id == wallet.Id).ExecuteUpdateAsync(s => s.SetProperty(w => w.ExtraCardAllowed, false));
            return Results.Ok(new { Number = CardCodes.Display(card.Number) });
        });

        app.MapGroup("/api/orgs/{slug}/admin/members").RequireOrg(OrgRole.Admin)
            .MapPut("/{id:guid}/extra-card", async (Guid id, ExtraCardRequest req, HttpContext http, AppDbContext db, WalletService wallets) =>
            {
                var member = await db.Memberships.AsNoTracking().FirstOrDefaultAsync(m => m.Id == id);
                if (member is null) return Http.Error(404, "Member not found.");
                var wallet = await wallets.GetOrCreateAsync(member.UserId, http.Org().Org.Id);
                await db.Wallets.Where(w => w.Id == wallet.Id).ExecuteUpdateAsync(s => s.SetProperty(w => w.ExtraCardAllowed, req.Allowed));
                return Results.NoContent();
            });

        var admin = app.MapGroup("/api/orgs/{slug}/admin/cards").RequireOrg(OrgRole.Admin);

        admin.MapGet("", async (HttpContext http, AppDbContext db, IConfiguration config) =>
            Results.Ok(await ListAsync(db, LinkBase(http, config))));

        admin.MapPost("", async (CreateCardsRequest req, HttpContext http, AppDbContext db, PlatformDbContext platform, TimeProvider clock, IConfiguration config) =>
        {
            if (req.Count is < 1 or > MaxCardsAtOnce) return Http.Error(400, $"Make between 1 and {MaxCardsAtOnce} cards at a time.");
            var ids = await CreateAsync(db, platform, http.Org().Org.Id, req.Count, clock);
            return Results.Ok(await ListAsync(db, LinkBase(http, config), ids));
        });

        admin.MapGet("/export", async (HttpContext http, AppDbContext db, IConfiguration config) =>
        {
            var linkBase = LinkBase(http, config);
            var cards = await db.NfcCards.AsNoTracking().Where(c => c.Uid == null && c.Code != null).OrderBy(c => c.Number)
                .Select(c => new { c.Number, c.Code }).ToListAsync();
            var lines = cards.Select(c => $"{CardCodes.Display(c.Number)},{c.Code},{CardCodes.Url(linkBase, c.Code!)}");
            var csv = string.Join("\n", lines.Prepend("number,code,url")) + "\n";
            return Results.File(System.Text.Encoding.UTF8.GetBytes(csv), "text/csv", "cards.csv");
        });

        admin.MapGet("/design", async (HttpContext http, AppDbContext db) =>
        {
            var organisation = await db.Organisations.AsNoTracking().FirstAsync(o => o.Id == http.Org().Org.Id);
            var design = CardDesigns.Load(organisation);
            static object Side(CardSide side) =>
                new { side.Background, side.Colour, side.ImageKey, ImageUrl = Images.Url(side.ImageKey), side.ShowLogo, side.Tagline };
            return Results.Ok(new { Front = Side(design.Front), Back = Side(design.Back) });
        });

        admin.MapPut("/design", async (CardDesign req, HttpContext http, AppDbContext db) =>
        {
            var orgId = http.Org().Org.Id;
            var (design, problem) = CardDesigns.Check(req, orgId);
            if (design is null) return Http.Error(400, problem!);
            var json = System.Text.Json.JsonSerializer.Serialize(design);
            await db.Organisations.Where(o => o.Id == orgId).ExecuteUpdateAsync(s => s.SetProperty(o => o.CardDesignJson, json));
            return Results.NoContent();
        });

        admin.MapGet("/writing", (IConfiguration config) =>
        {
            var reason = WritingProblem(config);
            return Results.Ok(new { Ready = reason is null, Reason = reason });
        });

        admin.MapPost("/blank", async (HttpContext http, AppDbContext db, PlatformDbContext platform, TimeProvider clock, IConfiguration config) =>
        {
            if (WritingProblem(config) is { } problem) return Http.Error(409, problem);
            var ids = await CreateAsync(db, platform, http.Org().Org.Id, 1, clock);
            return Results.Ok((await ListAsync(db, LinkBase(http, config), ids))[0]);
        });

        admin.MapPost("/{id:guid}/written", async (Guid id, WrittenRequest req, HttpContext http, AppDbContext db, TimeProvider clock, IConfiguration config) =>
        {
            if (WritingProblem(config) is { } problem) return Http.Error(409, problem);
            var uid = Http.NormaliseCardUid(req.Uid);
            if (uid is null) return Http.Error(400, "The chip's serial number could not be read. Try again.");
            var card = await db.NfcCards.FirstOrDefaultAsync(c => c.Id == id);
            if (card is null) return Http.Error(404, "Card not found.");
            if (card.Uid is not null && card.Uid != uid) return Http.Error(409, $"Card {CardCodes.Display(card.Number)} is already written to another chip.");
            var other = await db.NfcCards.AsNoTracking().FirstOrDefaultAsync(c => c.Uid == uid && c.Id != id);
            if (other is not null) return Http.Error(409, $"This chip is already card {CardCodes.Display(other.Number)}.");
            if (card.Uid is null)
            {
                card.Uid = uid;
                card.WrittenAt = clock.GetUtcNow().UtcDateTime;
            }
            card.Locked |= req.Locked;
            try { await db.SaveChangesAsync(); }
            catch (DbUpdateException) { return Http.Error(409, "This chip is already another card."); }
            return Results.Ok((await ListAsync(db, LinkBase(http, config), [id]))[0]);
        });

        admin.MapPut("/{id:guid}/blocked", async (Guid id, BlockedRequest req, AppDbContext db) =>
        {
            var rows = await db.NfcCards.Where(c => c.Id == id).ExecuteUpdateAsync(s => s.SetProperty(c => c.Blocked, req.Blocked));
            return rows == 0 ? Http.Error(404, "Card not found.") : Results.NoContent();
        });

        admin.MapDelete("/{id:guid}/link", async (Guid id, AppDbContext db) =>
        {
            var rows = await db.NfcCards.Where(c => c.Id == id)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.WalletId, (Guid?)null).SetProperty(c => c.LinkedAt, (DateTime?)null));
            return rows == 0 ? Http.Error(404, "Card not found.") : Results.NoContent();
        });

        admin.MapDelete("/{id:guid}", async (Guid id, AppDbContext db, PlatformDbContext platform) =>
        {
            var card = await db.NfcCards.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id);
            if (card is null) return Http.Error(404, "Card not found.");
            if (card.Uid is not null || card.WalletId is not null)
                return Http.Error(409, "Only cards that are not written and not linked can be deleted. Block it instead.");
            await db.NfcCards.Where(c => c.Id == id).ExecuteDeleteAsync();
            if (card.Code is not null) await platform.CardCodes.Where(c => c.Code == card.Code).ExecuteDeleteAsync();
            return Results.NoContent();
        });
    }

    private static Task<NfcCard?> FindByCodeAsync(AppDbContext db, string raw) =>
        CardCodes.Normalise(raw) is { } code
            ? db.NfcCards.AsNoTracking().Include(c => c.Wallet).FirstOrDefaultAsync(c => c.Code == code)
            : Task.FromResult<NfcCard?>(null);

    /// <summary>Why cards can't be written yet, or null when they can: the link on a locked chip can never change.</summary>
    public static string? WritingProblem(IConfiguration config)
    {
        var configured = config["App:PublicUrl"];
        if (string.IsNullOrWhiteSpace(configured) || !Uri.TryCreate(configured, UriKind.Absolute, out var uri))
            return "Set the site's public address (App:PublicUrl) before writing cards: it is locked onto every chip.";
        if (uri.IsLoopback || uri.Host == "localhost")
            return "The site's public address points at this computer. Set the real address before writing cards.";
        return null;
    }

    /// <summary>The start of card links: the public address, or this request's address while that isn't set.</summary>
    private static string LinkBase(HttpContext http, IConfiguration config) =>
        config["App:PublicUrl"] is { Length: > 0 } configured ? configured.TrimEnd('/') : $"{http.Request.Scheme}://{http.Request.Host}";

    private static async Task<List<Guid>> CreateAsync(AppDbContext db, PlatformDbContext platform, Guid tenantId, int count, TimeProvider clock)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        for (var attempt = 0; ; attempt++)
        {
            var next = (await db.NfcCards.MaxAsync(c => (int?)c.Number) ?? 0) + 1;
            var cards = Enumerable.Range(next, count)
                .Select(number => new NfcCard { Id = Guid.NewGuid(), Number = number, Code = CardCodes.NewCode(), CreatedAt = now })
                .ToList();
            // The platform first: a code there without a card is harmless, a card without its code would be unreachable.
            platform.CardCodes.AddRange(cards.Select(c => new CardCode { Code = c.Code!, TenantId = tenantId }));
            db.NfcCards.AddRange(cards);
            try
            {
                await platform.SaveChangesAsync();
                await db.SaveChangesAsync();
                return cards.Select(c => c.Id).ToList();
            }
            catch (DbUpdateException) when (attempt < 3)
            {
                // Another admin made cards at the same moment, or a code clashed: start over with fresh numbers.
                platform.ChangeTracker.Clear();
                db.ChangeTracker.Clear();
                await platform.CardCodes.Where(p => cards.Select(c => c.Code).Contains(p.Code)).ExecuteDeleteAsync();
            }
        }
    }

    private static async Task<List<object>> ListAsync(AppDbContext db, string linkBase, List<Guid>? only = null)
    {
        var query = db.NfcCards.AsNoTracking();
        if (only is not null) query = query.Where(c => only.Contains(c.Id));
        var rows = await (
            from c in query
            join u in db.Users on c.Wallet!.UserId equals u.Id into owners
            from u in owners.DefaultIfEmpty()
            orderby c.Number descending
            select new { c.Id, c.Number, c.Code, c.Uid, c.Locked, c.Blocked, c.CreatedAt, c.WrittenAt, c.LinkedAt, c.WalletId, Name = u == null ? null : u.DisplayName })
            .ToListAsync();
        return rows.Select(c => (object)new
        {
            c.Id,
            Number = CardCodes.Display(c.Number),
            c.Code,
            Url = c.Code is null ? null : CardCodes.Url(linkBase, c.Code),
            c.Uid,
            c.Locked,
            c.Blocked,
            LinkedTo = c.WalletId is null ? null : new { Name = c.Name ?? "" },
            c.CreatedAt,
            c.WrittenAt,
            c.LinkedAt,
        }).ToList();
    }
}
