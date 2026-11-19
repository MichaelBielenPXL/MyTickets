import { t } from '@/lib/i18n'
import { money, tokens } from '@/utils/format'

type OrderBarProps = {
  ticketCount: number
  totalCents: number
  /** The member's tokens with this organisation, in cents (one token is one euro). */
  balanceCents: number
  busy: boolean
  onOrder: (payWith: 'online' | 'wallet') => void
}

/** Sticks to the bottom of the event page once tickets are picked. */
export function OrderBar({ ticketCount, totalCents, balanceCents, busy, onOrder }: OrderBarProps) {
  const free = totalCents === 0

  return (
    <section className="panel checkout-bar">
      <div className="spread">
        <span>{ticketCount === 1 ? t('1 ticket') : t('{count} tickets', { count: ticketCount })}</span>
        <strong>{free ? t('Free') : money(totalCents)}</strong>
      </div>
      <button className="btn primary block" disabled={busy} onClick={() => onOrder('online')}>
        {free ? t('Get tickets') : t('Pay {price}', { price: money(totalCents) })}
      </button>
      {!free && (
        <button
          className="btn block"
          disabled={busy || balanceCents < totalCents}
          onClick={() => onOrder('wallet')}
        >
          {t('Pay with tokens ({balance})', { balance: tokens(balanceCents) })}
        </button>
      )}
    </section>
  )
}
