namespace MyTickets.Api.Data;

/// <summary>
/// That an account has a record at an organisation (made when they joined it, or created it), and which: the
/// <see cref="User"/> with id <see cref="UserId"/> in that organisation's own database.
/// </summary>
public class AccountLink
{
    public Guid AccountId { get; set; }
    public Guid TenantId { get; set; }
    public Guid UserId { get; set; }
    public DateTime CreatedAt { get; set; }
}
