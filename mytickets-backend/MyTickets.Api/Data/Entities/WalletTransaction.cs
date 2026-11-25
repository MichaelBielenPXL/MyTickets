namespace MyTickets.Api.Data;

public class WalletTransaction
{
    public Guid Id { get; set; }
    public Guid WalletId { get; set; }
    /// <summary>Positive adds credit, negative spends it.</summary>
    public int AmountCents { get; set; }
    public WalletTxType Type { get; set; }
    public string Description { get; set; } = "";
    public Guid? PerformedByUserId { get; set; }
    public Guid? PaymentId { get; set; }
    /// <summary>Set by the staff app so a retried request can never charge twice.</summary>
    public Guid? RequestId { get; set; }
    /// <summary>
    /// For bar sales: the part of the amount that is deposit, positive for cups going out and negative for cups
    /// coming back. Deposit money is held for the guest, not earned, so it is kept apart from the takings.
    /// </summary>
    public int DepositCents { get; set; }
    public DateTime CreatedAt { get; set; }
}

public enum WalletTxType { TopUp, CashTopUp, Purchase, TicketPurchase, Adjustment, Return }
