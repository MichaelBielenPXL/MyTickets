using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;
using MyTickets.Api.Services;

namespace MyTickets.Api.Endpoints;

public static class MeEndpoints
{
    public record LinkCardRequest(string? Uid, string? Label);
    public record BlockCardRequest(bool Blocked);

    public static void MapMe(this IEndpointRouteBuilder app)
    {
        // Everything a person owns belongs to their account at one organisation.
        var group = app.MapGroup("/api/orgs/{slug}/me").RequireAuthorization();

        // The details asked when choosing a membership, and which ones this organisation asks.
        group.MapGet("/profile", async (HttpContext http, AppDbContext db) =>
        {
            var userId = http.User.UserId();
            var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId);
            var modes = ProfileFields.Read(await db.Organisations.AsNoTracking().FirstAsync());
            return Results.Ok(new { Fields = modes, Profile = ProfileFields.Of(user), Complete = ProfileFields.IsComplete(user, modes), user.Email });
        });

        group.MapPut("/profile", async (ProfileFields.Values values, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var userId = http.User.UserId();
            var modes = ProfileFields.Read(await db.Organisations.AsNoTracking().FirstAsync());
            if (ProfileFields.Problem(values, modes) is { } problem) return Http.Error(400, problem);
            var user = await db.Users.FirstAsync(u => u.Id == userId);
            ProfileFields.Apply(user, values, modes, clock.GetUtcNow().UtcDateTime);
            await db.SaveChangesAsync();
            return Results.Ok(new { Profile = ProfileFields.Of(user), Complete = true });
        });

        group.MapGet("/tickets", async (HttpContext http, AppDbContext db) =>
        {
            var userId = http.User.UserId();
            var tickets = await (
                from t in db.Tickets.AsNoTracking()
                join e in db.Events on t.EventId equals e.Id
                join o in db.Organisations on e.OrganisationId equals o.Id
                where t.UserId == userId && (t.Status == TicketStatus.Valid || t.Status == TicketStatus.CheckedIn)
                orderby e.StartsAt descending
                select new
                {
                    t.Id, t.Code, t.Status, t.CheckedInAt, TicketType = t.TicketType.Name,
                    EventId = e.Id, EventName = e.Name, e.StartsAt, e.Location,
                    OrganisationName = o.Name, OrganisationSlug = o.Slug,
                }).ToListAsync();
            return Results.Ok(tickets);
        });

        group.MapGet("/cards", async (HttpContext http, AppDbContext db) =>
        {
            var userId = http.User.UserId();
            return Results.Ok(await db.NfcCards.AsNoTracking().Where(c => c.UserId == userId).OrderBy(c => c.LinkedAt)
                .Select(c => new { c.Id, c.Uid, c.Label, c.Blocked, c.LinkedAt }).ToListAsync());
        });

        group.MapPost("/cards", async (LinkCardRequest req, HttpContext http, AppDbContext db, TimeProvider clock) =>
        {
            var uid = Http.NormaliseCardUid(req.Uid);
            if (uid is null) return Http.Error(400, "That doesn't look like a card number. It is 8 to 20 letters and digits (0-9, A-F).");
            var userId = http.User.UserId();
            var existing = await db.NfcCards.AsNoTracking().FirstOrDefaultAsync(c => c.Uid == uid);
            if (existing is not null)
                return Http.Error(409, existing.UserId == userId ? "This card is already linked to your account." : "This card is already linked to another account.");

            var card = new NfcCard { Id = Guid.NewGuid(), Uid = uid, UserId = userId, Label = req.Label?.Trim() ?? "", LinkedAt = clock.GetUtcNow().UtcDateTime };
            db.NfcCards.Add(card);
            try { await db.SaveChangesAsync(); }
            catch (DbUpdateException) { return Http.Error(409, "This card is already linked to an account."); }
            return Results.Ok(new { card.Id, card.Uid, card.Label, card.Blocked, card.LinkedAt });
        });

        group.MapPut("/cards/{id:guid}/blocked", async (Guid id, BlockCardRequest req, HttpContext http, AppDbContext db) =>
        {
            var userId = http.User.UserId();
            var rows = await db.NfcCards.Where(c => c.Id == id && c.UserId == userId)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.Blocked, req.Blocked));
            return rows == 0 ? Http.Error(404, "Card not found.") : Results.NoContent();
        });

        group.MapDelete("/cards/{id:guid}", async (Guid id, HttpContext http, AppDbContext db) =>
        {
            var userId = http.User.UserId();
            var rows = await db.NfcCards.Where(c => c.Id == id && c.UserId == userId).ExecuteDeleteAsync();
            return rows == 0 ? Http.Error(404, "Card not found.") : Results.NoContent();
        });

        // Payments: the buyer's view of one payment, checking it with Stripe, and the buttons of the test checkout.
        var payments = app.MapGroup("/api/orgs/{slug}/payments").RequireAuthorization();

        payments.MapGet("/{id:guid}", async (Guid id, HttpContext http, AppDbContext db) =>
        {
            var payment = await PaymentViewAsync(db, id, http.User.UserId());
            return payment is null ? Http.Error(404, "Payment not found.") : Results.Ok(payment);
        });

        // Coming back from Stripe's page: ask Stripe how it went, so the buyer does not have to wait for the webhook.
        payments.MapPost("/{id:guid}/refresh", async (Guid id, HttpContext http, AppDbContext db, PaymentService service) =>
        {
            var userId = http.User.UserId();
            if (!await db.Payments.AnyAsync(p => p.Id == id && p.UserId == userId)) return Http.Error(404, "Payment not found.");
            try { await service.SyncAsync(id); }
            catch (StripeException)
            {
                // Stripe is unreachable for a moment. The payment simply stays pending and is checked again later.
            }
            return Results.Ok(await PaymentViewAsync(db, id, userId));
        });

        // The buyer went back from Stripe's page without paying.
        payments.MapPost("/{id:guid}/cancel", async (Guid id, HttpContext http, AppDbContext db, PaymentService service) =>
        {
            var userId = http.User.UserId();
            if (!await db.Payments.AnyAsync(p => p.Id == id && p.UserId == userId)) return Http.Error(404, "Payment not found.");
            try { await service.CancelAsync(id); }
            catch (StripeException) { }
            return Results.Ok(await PaymentViewAsync(db, id, userId));
        });

        payments.MapPost("/{id:guid}/test-pay", (Guid id, HttpContext http, AppDbContext db, PaymentService service) =>
            FinishTestPayment(id, http, db, () => service.CompleteAsync(id)));
        payments.MapPost("/{id:guid}/test-cancel", (Guid id, HttpContext http, AppDbContext db, PaymentService service) =>
            FinishTestPayment(id, http, db, () => service.FailAsync(id)));
    }

    /// <summary>One payment as its buyer sees it.</summary>
    private static Task<PaymentView?> PaymentViewAsync(AppDbContext db, Guid id, Guid userId) => (
        from p in db.Payments.AsNoTracking()
        join o in db.Organisations on p.OrganisationId equals o.Id
        where p.Id == id && p.UserId == userId
        select new PaymentView(p.Id, p.AmountCents, p.Description, p.Purpose, p.Status, p.Provider, p.CreatedAt, p.CompletedAt, o.Name, o.Slug)
    ).FirstOrDefaultAsync();

    public record PaymentView(Guid Id, int AmountCents, string Description, PaymentPurpose Purpose, PaymentStatus Status,
        string Provider, DateTime CreatedAt, DateTime? CompletedAt, string OrganisationName, string OrganisationSlug);

    private static async Task<IResult> FinishTestPayment(Guid id, HttpContext http, AppDbContext db, Func<Task<bool>> finish)
    {
        var userId = http.User.UserId();
        // Only payments that went to the test checkout can be finished by pressing a button.
        if (!await db.Payments.AnyAsync(p => p.Id == id && p.UserId == userId && p.Provider == TestCheckout.ProviderName))
            return Http.Error(404, "Payment not found.");
        return await finish() ? Results.NoContent() : Http.Error(409, "This payment was already finished or has expired.");
    }
}
