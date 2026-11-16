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

        // Payments: the buyer's view of one payment, and the buttons of the test checkout page.
        var payments = app.MapGroup("/api/orgs/{slug}/payments").RequireAuthorization();

        payments.MapGet("/{id:guid}", async (Guid id, HttpContext http, AppDbContext db) =>
        {
            var userId = http.User.UserId();
            var payment = await (
                from p in db.Payments.AsNoTracking()
                join o in db.Organisations on p.OrganisationId equals o.Id
                where p.Id == id && p.UserId == userId
                select new { p.Id, p.AmountCents, p.Description, p.Purpose, p.Status, p.Provider, OrganisationName = o.Name, OrganisationSlug = o.Slug }
            ).FirstOrDefaultAsync();
            return payment is null ? Http.Error(404, "Payment not found.") : Results.Ok(payment);
        });

        if (app.ServiceProvider.GetRequiredService<IPaymentProvider>() is FakePaymentProvider)
        {
            payments.MapPost("/{id:guid}/test-pay", (Guid id, HttpContext http, AppDbContext db, PaymentService service) =>
                FinishTestPayment(id, http, db, () => service.CompleteAsync(id)));
            payments.MapPost("/{id:guid}/test-cancel", (Guid id, HttpContext http, AppDbContext db, PaymentService service) =>
                FinishTestPayment(id, http, db, () => service.FailAsync(id)));
        }
    }

    private static async Task<IResult> FinishTestPayment(Guid id, HttpContext http, AppDbContext db, Func<Task<bool>> finish)
    {
        var userId = http.User.UserId();
        if (!await db.Payments.AnyAsync(p => p.Id == id && p.UserId == userId)) return Http.Error(404, "Payment not found.");
        return await finish() ? Results.NoContent() : Http.Error(409, "This payment was already finished or has expired.");
    }
}
