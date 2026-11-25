namespace MyTickets.Api.Data;

/// <summary>Which account created (and so owns) an organisation.</summary>
public class TenantOwner
{
    public Guid TenantId { get; set; }
    public Guid AccountId { get; set; }
}
