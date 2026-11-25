namespace MyTickets.Api.Data;

/// <summary>
/// A card the organisation issued: made in Manage, written to a chip, then claimed by a member, whose wallet it
/// pays from. Cards linked before cards were issued have no link code.
/// </summary>
public class NfcCard
{
    public Guid Id { get; set; }
    /// <summary>The card's number, 1, 2, 3… within the organisation. Not printed on it, and never used to find it.</summary>
    public int Number { get; set; }
    /// <summary>The code in the card's link and printed QR; see <see cref="Services.CardCodes"/>.</summary>
    public string? Code { get; set; }
    /// <summary>The chip's serial number, upper-case hex without separators; null until the card is written.</summary>
    public string? Uid { get; set; }
    /// <summary>The wallet the card pays from; null while nobody has claimed it.</summary>
    public Guid? WalletId { get; set; }
    public Wallet? Wallet { get; set; }
    public string Label { get; set; } = "";
    public bool Blocked { get; set; }
    /// <summary>The chip was made read-only after writing, so its link can't be changed.</summary>
    public bool Locked { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? WrittenAt { get; set; }
    public DateTime? LinkedAt { get; set; }
}
