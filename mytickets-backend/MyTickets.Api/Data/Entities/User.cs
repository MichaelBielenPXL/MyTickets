namespace MyTickets.Api.Data;

/// <summary>
/// Someone at this organisation: their details for it, and (through other tables) their membership, wallet and tickets.
/// They sign in with their MyTickets <see cref="Account"/>; this record has no password of its own. Made when they join.
/// </summary>
public class User
{
    public Guid Id { get; set; }
    public required string Email { get; set; }
    /// <summary>What staff see when the card is tapped: first and last name once given, the email's name until then.</summary>
    public required string DisplayName { get; set; }
    public DateTime CreatedAt { get; set; }

    // ---- The details asked when choosing a membership (which ones, each organisation decides) ----
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Phone { get; set; }
    public string? Street { get; set; }
    public string? PostalCode { get; set; }
    public string? City { get; set; }
    public string? School { get; set; }
    public string? Faculty { get; set; }
    /// <summary>Free text, as people say it: "2nd bachelor", "Master 1".</summary>
    public string? StudyYear { get; set; }
    public DateTime? ProfileUpdatedAt { get; set; }
    /// <summary>The language they use the app in ("en", "nl"), for the emails they get from this organisation.</summary>
    public string? Language { get; set; }
}
