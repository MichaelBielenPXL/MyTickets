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

/** One of the organisation's own top-ups: pay `priceCents`, get `tokensCents` worth of tokens. */
export interface TopUpDeal {
  id: string
  priceCents: number
  tokensCents: number
}

export interface Wallet {
  balanceCents: number
  minTopUpCents: number
  maxTopUpCents: number
  transactions: WalletTransaction[]
  /** Empty when the organisation sells one token per euro. */
  deals: TopUpDeal[]
}
