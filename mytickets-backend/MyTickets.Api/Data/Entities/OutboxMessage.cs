namespace MyTickets.Api.Data;

/// <summary>
/// An event that still has work to do outside this database, such as passing a payment on to the organisation.
/// Written in the same transaction as the change it is about; worked off by <see cref="Services.OutboxDispatcher"/>.
/// </summary>
public class OutboxMessage
{
    public Guid Id { get; set; }
    /// <summary>Which event; see <see cref="Services.OutboxEvents"/>.</summary>
    public required string Type { get; set; }
    /// <summary>The event's details, as JSON.</summary>
    public required string Data { get; set; }
    public DateTime CreatedAt { get; set; }
    /// <summary>When it may be handled (again): straight away at first, later after each failed try.</summary>
    public DateTime NextAttemptAt { get; set; }
    public int Attempts { get; set; }
    public string? LastError { get; set; }
    /// <summary>When its work was done. Null while it still has to be.</summary>
    public DateTime? ProcessedAt { get; set; }
}
