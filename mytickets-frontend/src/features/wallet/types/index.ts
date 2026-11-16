export type WalletTransactionType =
  'TopUp' | 'CashTopUp' | 'Purchase' | 'TicketPurchase' | 'Adjustment' | 'Return'

export interface WalletTransaction {
  id: string
  /** Positive adds credit, negative spends it. */
  amountCents: number
  type: WalletTransactionType
  description: string
  createdAt: string
}

export interface Wallet {
  balanceCents: number
  minTopUpCents: number
  maxTopUpCents: number
  transactions: WalletTransaction[]
}
