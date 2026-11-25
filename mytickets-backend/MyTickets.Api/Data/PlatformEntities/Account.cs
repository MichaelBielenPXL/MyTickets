namespace MyTickets.Api.Data;

/// <summary>
/// Someone's MyTickets account: the one email address and password they sign in with everywhere, for every
/// organisation they are in and every organisation they run. What an organisation knows about them (their details,
/// membership, tokens, tickets) is in that organisation's own database, linked by an <see cref="AccountLink"/>.
/// </summary>
public class Account
{
    public Guid Id { get; set; }
    /// <summary>Lower case. One account per address.</summary>
    public required string Email { get; set; }
    /// <summary>The name given when signing up as an organiser, or the first part of the email address until then.</summary>
    public required string DisplayName { get; set; }
    public string PasswordHash { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    /// <summary>When they agreed to the terms of service and privacy policy, and which version (see <see cref="Services.Legal"/>).</summary>
    public DateTime? TermsAcceptedAt { get; set; }
    public string? TermsVersion { get; set; }
}
