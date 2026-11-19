import { t } from '@/lib/i18n'
import { dateTime, signedTokens } from '@/utils/format'

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
  if (transactions.length === 0) return <p className="muted">{t('Nothing yet.')}</p>
  return (
    <div className="list">
      {transactions.map((transaction) => (
        <div key={transaction.id} className="list-item">
          <div>
            <strong>{t(TYPE_LABELS[transaction.type] ?? transaction.type)}</strong>
            <p className="muted">
              {transaction.description} · {dateTime(transaction.createdAt)}
            </p>
          </div>
          <span className={transaction.amountCents >= 0 ? 'good amount' : 'amount'}>
            {signedTokens(transaction.amountCents)}
          </span>
        </div>
      ))}
    </div>
  )
}
