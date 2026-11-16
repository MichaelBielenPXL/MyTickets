import { dateTime, money } from '@/utils/format'

import type { TicketType } from '../types'

type TicketTypeRowProps = {
  ticketType: TicketType
  quantity: number
  /** False for visitors without a working membership: they see prices but cannot pick. */
  canBuy: boolean
  onChange: (quantity: number) => void
}

const LOW_STOCK = 10

export function TicketTypeRow({ ticketType: t, quantity, canBuy, onChange }: TicketTypeRowProps) {
  const owned = t.owned ?? 0
  const max = Math.min(t.available, t.maxPerUser - owned)
  const blocked = whyNotBuyable(t, canBuy, max)

  return (
    <div className="list-item">
      <div>
        <strong>{t.name}</strong>
        <p>
          {t.yourPriceCents < t.priceCents && <s className="muted">{money(t.priceCents)}</s>}{' '}
          {t.yourPriceCents === 0 ? 'Free' : money(t.yourPriceCents)}
          {t.membersOnly && <span className="tag">Members only</span>}
        </p>
        {owned > 0 && <p className="muted">You have {owned}</p>}
        {t.onSale && t.available > 0 && t.available <= LOW_STOCK && (
          <p className="warn">Only {t.available} left</p>
        )}
      </div>
      {blocked && <span className="tag bad">{blocked}</span>}
      {!blocked && canBuy && (
        <div className="stepper">
          <button
            className="btn"
            onClick={() => onChange(quantity - 1)}
            disabled={quantity <= 0}
            aria-label={`Fewer ${t.name}`}
          >
            −
          </button>
          <output aria-label={`${t.name} quantity`}>{quantity}</output>
          <button
            className="btn"
            onClick={() => onChange(quantity + 1)}
            disabled={quantity >= max}
            aria-label={`More ${t.name}`}
          >
            +
          </button>
        </div>
      )}
    </div>
  )
}

/** The reason this ticket cannot be picked right now, or an empty string when it can. */
function whyNotBuyable(t: TicketType, canBuy: boolean, max: number): string {
  if (!t.onSale) {
    const opensLater = t.salesStartAt !== null && new Date(t.salesStartAt) > new Date()
    return opensLater ? `On sale ${dateTime(t.salesStartAt!)}` : 'Sales closed'
  }
  if (t.available <= 0) return 'Sold out'
  if (canBuy && !t.allowedForYou) return 'Not for your membership'
  if (canBuy && max <= 0) return 'You have the maximum'
  return ''
}
