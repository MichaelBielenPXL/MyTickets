namespace MyTickets.Api.Data;

/// <summary>
/// One organisation. Everything that belongs to it (accounts, tickets, credit, cards) lives in its
/// own database; this record only says that it exists and where its page is.
/// </summary>
public class Tenant
{
    public Guid Id { get; set; }
    public required string Slug { get; set; }
    public required string Name { get; set; }
    public string Description { get; set; } = "";
    public string? LogoKey { get; set; }
    public DateTime CreatedAt { get; set; }

    /// <summary>The same organisation in the shape the rest of the code works with.</summary>
    public Organisation ToOrganisation() => new()
    {
        Id = Id, Slug = Slug, Name = Name, Description = Description, LogoKey = LogoKey, CreatedAt = CreatedAt,
    };
}
