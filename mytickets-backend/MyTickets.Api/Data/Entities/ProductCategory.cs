namespace MyTickets.Api.Data;

/// <summary>A tab at the bar till (Beer, Soft drinks, Food...), in the order the admin put them.</summary>
public class ProductCategory
{
    public Guid Id { get; set; }
    public Guid OrganisationId { get; set; }
    public required string Name { get; set; }
    public int SortOrder { get; set; }
}
