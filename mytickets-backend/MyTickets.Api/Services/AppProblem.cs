namespace MyTickets.Api.Services;

/// <summary>
/// Something the person asked can't be done, for a reason they should be told: "Not enough tickets left." Services
/// throw it so they don't need to know about HTTP; one handler (in Program) turns it into the error response, with
/// <see cref="Status"/> and the message, <see cref="Code"/> when the app reacts to it (a form to fill in first),
/// and any <see cref="Details"/> the app shows with it (the balance on a card that is short).
/// </summary>
public class AppProblem(int status, string message, string? code = null, IReadOnlyDictionary<string, object?>? details = null) : Exception(message)
{
    public int Status { get; } = status;
    public string? Code { get; } = code;
    /// <summary>Sent alongside the message, under these names (written as the app expects them: "balanceCents").</summary>
    public IReadOnlyDictionary<string, object?> Details { get; } = details ?? new Dictionary<string, object?>();

    public static AppProblem BadRequest(string message) => new(400, message);
    public static AppProblem Forbidden(string message) => new(403, message);
    public static AppProblem NotFound(string message) => new(404, message);
    public static AppProblem Conflict(string message, string? code = null) => new(409, message, code);
}
