namespace MyTickets.Api.Data;

/// <summary>Says which organisations an owner created, and which account inside each one is theirs.</summary>
public class TenantOwner
{
    public Guid TenantId { get; set; }
    public Guid OwnerAccountId { get; set; }
    /// <summary>The owner's admin account inside that organisation's own database.</summary>
    public Guid UserId { get; set; }
}
