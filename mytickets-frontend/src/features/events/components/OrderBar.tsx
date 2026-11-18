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
        <span>
          {ticketCount} ticket{ticketCount > 1 && 's'}
        </span>
        <strong>{free ? 'Free' : money(totalCents)}</strong>
      </div>
      <button className="btn primary block" disabled={busy} onClick={() => onOrder('online')}>
        {free ? 'Get tickets' : `Pay ${money(totalCents)}`}
      </button>
      {!free && (
        <button
          className="btn block"
          disabled={busy || balanceCents < totalCents}
          onClick={() => onOrder('wallet')}
        >
          Pay with tokens ({tokens(balanceCents)})
        </button>
      )}
    </section>
  )
}
