namespace MyTickets.Api.Data;

/// <summary>
/// An organiser's login. It is the only kind of account that reaches across organisations:
/// one person can create several and opens all of them with this one login.
/// </summary>
public class OwnerAccount
{
    public Guid Id { get; set; }
    public required string Email { get; set; }
    public required string DisplayName { get; set; }
    public string PasswordHash { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    /// <summary>When they agreed to the terms of service and privacy policy, and which version (see <see cref="Services.Legal"/>).</summary>
    public DateTime? TermsAcceptedAt { get; set; }
    public string? TermsVersion { get; set; }
}
