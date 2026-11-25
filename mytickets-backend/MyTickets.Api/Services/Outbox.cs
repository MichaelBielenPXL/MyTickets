using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MyTickets.Api.Data;

namespace MyTickets.Api.Services;

/// <summary>
/// The events the app publishes. Each is written to the organisation's outbox in the same transaction as the
/// change it is about, so the change and the work it causes are recorded together or not at all.
/// </summary>
public static class OutboxEvents
{
    /// <summary>A payment was paid. Handled by passing the organisation its money (see <see cref="SettlementService.SettleAsync"/>).</summary>
    public const string PaymentCompleted = "PaymentCompleted";

    public record PaymentCompletedData(Guid PaymentId);

    /// <summary>Tickets became valid (paid, or free): emailed to the buyer, with a PDF (see <see cref="Tickets.TicketMailer"/>).</summary>
    public const string TicketsIssued = "TicketsIssued";

    public record TicketsIssuedData(List<Guid> TicketIds);

    /// <summary>Adds the event to the outbox; it is saved with the caller's other changes.</summary>
    public static void Publish(this AppDbContext db, string type, object data, DateTime now) =>
        db.Outbox.Add(new OutboxMessage
        {
            Id = Guid.NewGuid(), Type = type, Data = JsonSerializer.Serialize(data), CreatedAt = now, NextAttemptAt = now,
        });
}

/// <summary>
/// Works through an organisation's outbox: runs the handler for each event that is due, marks it done when the
/// handler succeeds, and otherwise tries again later, waiting longer each time. An event is claimed before it is
/// handled, so two workers never handle the same one at once; handlers are safe to repeat anyway (a crash after
/// the work but before marking it done means it is done again).
/// </summary>
public class OutboxDispatcher(AppDbContext db, IServiceProvider services, TimeProvider clock, ILogger<OutboxDispatcher> log)
{
    /// <summary>How long a claimed event is left alone; after that a worker may take it again (its handler crashed).</summary>
    private static readonly TimeSpan Lease = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan LongestWait = TimeSpan.FromHours(1);

    /// <summary>Handles the events that are due. <paramref name="asOf"/> lets tests act as if retries were due already.</summary>
    public async Task<int> ProcessDueAsync(int max = 50, DateTime? asOf = null, CancellationToken ct = default)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var due = await db.Outbox.AsNoTracking().Where(m => m.ProcessedAt == null && m.NextAttemptAt <= (asOf ?? now))
            .OrderBy(m => m.CreatedAt).Select(m => m.Id).Take(max).ToListAsync(ct);
        var done = 0;
        foreach (var id in due)
            if (await ProcessAsync(id, asOf, ct)) done++;
        return done;
    }

    private async Task<bool> ProcessAsync(Guid id, DateTime? asOf, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        // Claim it: only one worker gets the row.
        var claimed = await db.Outbox.Where(m => m.Id == id && m.ProcessedAt == null && m.NextAttemptAt <= (asOf ?? now))
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.NextAttemptAt, now + Lease).SetProperty(m => m.Attempts, m => m.Attempts + 1), ct);
        if (claimed == 0) return false;
        var message = await db.Outbox.AsNoTracking().FirstAsync(m => m.Id == id, ct);

        string? error;
        try
        {
            error = await HandleAsync(message) ? null : "Not done yet; will try again.";
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            log.LogError(e, "Handling {Type} event {Id} failed", message.Type, message.Id);
            error = e.Message;
        }

        if (error is null)
        {
            await db.Outbox.Where(m => m.Id == id)
                .ExecuteUpdateAsync(s => s.SetProperty(m => m.ProcessedAt, now).SetProperty(m => m.LastError, (string?)null), ct);
            return true;
        }
        var wait = TimeSpan.FromMinutes(Math.Min(Math.Pow(2, message.Attempts - 1), LongestWait.TotalMinutes));
        await db.Outbox.Where(m => m.Id == id)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.NextAttemptAt, now + wait).SetProperty(m => m.LastError, error), ct);
        return false;
    }

    /// <summary>Runs the event's handler; true when its work is done.</summary>
    private async Task<bool> HandleAsync(OutboxMessage message)
    {
        switch (message.Type)
        {
            case OutboxEvents.PaymentCompleted:
                var data = JsonSerializer.Deserialize<OutboxEvents.PaymentCompletedData>(message.Data)!;
                return await services.GetRequiredService<SettlementService>().SettleAsync(data.PaymentId);
            case OutboxEvents.TicketsIssued:
                var issued = JsonSerializer.Deserialize<OutboxEvents.TicketsIssuedData>(message.Data)!;
                await services.GetRequiredService<Tickets.TicketMailer>().SendAsync(issued.TicketIds);
                return true;
            default:
                throw new InvalidOperationException($"No handler for outbox event \"{message.Type}\".");
        }
    }
}
