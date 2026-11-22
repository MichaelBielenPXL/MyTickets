namespace MyTickets.Api.Data;

public class Organisation
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public required string Slug { get; set; }
    public string Description { get; set; } = "";
    /// <summary>Key of the logo in the image store, if one was uploaded.</summary>
    public string? LogoKey { get; set; }
    /// <summary>The organisation's own colour as "#rrggbb", used on its pages and member cards. Null: the house colour.</summary>
    public string? BrandColor { get; set; }
    public DateTime CreatedAt { get; set; }
    /// <summary>Which details are asked from members, see <see cref="Services.ProfileFields"/>. Empty: the defaults.</summary>
    public string ProfileFieldsJson { get; set; } = "";
    /// <summary>How its printed cards look, see <see cref="Services.CardDesigns"/>. Empty: the defaults.</summary>
    public string CardDesignJson { get; set; } = "";
}
