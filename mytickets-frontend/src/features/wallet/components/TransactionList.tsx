import { dateTime, money } from '@/utils/format'

import type { WalletTransaction, WalletTransactionType } from '../types'

type TransactionListProps = {
  transactions: WalletTransaction[]
}

const TYPE_LABELS: Record<WalletTransactionType, string> = {
  TopUp: 'Top-up',
  CashTopUp: 'Cash top-up',
  Purchase: 'Bar',
  TicketPurchase: 'Tickets',
  Adjustment: 'Correction',
  Return: 'Deposit back',
}

export function TransactionList({ transactions }: TransactionListProps) {
  if (transactions.length === 0) return <p className="muted">Nothing yet.</p>
  return (
    <div className="list">
      {transactions.map((transaction) => (
        <div key={transaction.id} className="list-item">
          <div>
            <strong>{TYPE_LABELS[transaction.type] ?? transaction.type}</strong>
            <p className="muted">
              {transaction.description} · {dateTime(transaction.createdAt)}
            </p>
          </div>
          <span className={transaction.amountCents >= 0 ? 'good amount' : 'amount'}>
            {signedMoney(transaction.amountCents)}
          </span>
        </div>
      ))}
    </div>
  )
}

/** "+€ 40,00" for credit coming in, "−€ 12,50" for credit spent. */
function signedMoney(cents: number) {
  return `${cents >= 0 ? '+' : '−'}${money(Math.abs(cents))}`
}
