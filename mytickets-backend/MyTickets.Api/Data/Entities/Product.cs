namespace MyTickets.Api.Data;

public class Product
{
    public Guid Id { get; set; }
    public Guid OrganisationId { get; set; }
    public required string Name { get; set; }
    public int PriceCents { get; set; }
    public bool Active { get; set; } = true;
    public int SortOrder { get; set; }
    /// <summary>A deposit, such as a reusable cup: staff can take it back and the price returns to the wallet.</summary>
    public bool IsDeposit { get; set; }
    /// <summary>For a drink: the deposit (a cup) charged with every one sold, added by the till itself.</summary>
    public Guid? DepositProductId { get; set; }
    /// <summary>The tab it shows under at the till; none puts it under "Other".</summary>
    public Guid? CategoryId { get; set; }
    /// <summary>The tile colour at the till, one of <see cref="ProductColors.All"/>, so bartenders find it at a glance.</summary>
    public string? Color { get; set; }
}

public static class ProductColors
{
    public static readonly string[] All = ["grey", "red", "orange", "yellow", "green", "teal", "blue", "indigo", "purple", "pink"];
}
