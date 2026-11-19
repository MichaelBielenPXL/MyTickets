import { t } from '@/lib/i18n'
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

export function TicketTypeRow({ ticketType: type, quantity, canBuy, onChange }: TicketTypeRowProps) {
  const owned = type.owned ?? 0
  const max = Math.min(type.available, type.maxPerUser - owned)
  const blocked = whyNotBuyable(type, canBuy, max)

  return (
    <div className="list-item">
      <div>
        <strong>{type.name}</strong>
        <p>
          {type.yourPriceCents < type.priceCents && <s className="muted">{money(type.priceCents)}</s>}{' '}
          {type.yourPriceCents === 0 ? t('Free') : money(type.yourPriceCents)}
          {type.membersOnly && <span className="tag">{t('Members only')}</span>}
        </p>
        {owned > 0 && <p className="muted">{t('You have {count}', { count: owned })}</p>}
        {type.onSale && type.available > 0 && type.available <= LOW_STOCK && (
          <p className="warn">{t('Only {count} left', { count: type.available })}</p>
        )}
      </div>
      {blocked && <span className="tag bad">{blocked}</span>}
      {!blocked && canBuy && (
        <div className="stepper">
          <button
            className="btn"
            onClick={() => onChange(quantity - 1)}
            disabled={quantity <= 0}
            aria-label={t('Fewer {name}', { name: type.name })}
          >
            −
          </button>
          <output aria-label={t('{name} quantity', { name: type.name })}>{quantity}</output>
          <button
            className="btn"
            onClick={() => onChange(quantity + 1)}
            disabled={quantity >= max}
            aria-label={t('More {name}', { name: type.name })}
          >
            +
          </button>
        </div>
      )}
    </div>
  )
}

/** The reason this ticket cannot be picked right now, or an empty string when it can. */
function whyNotBuyable(type: TicketType, canBuy: boolean, max: number): string {
  if (!type.onSale) {
    const opensLater = type.salesStartAt !== null && new Date(type.salesStartAt) > new Date()
    return opensLater ? t('On sale {when}', { when: dateTime(type.salesStartAt!) }) : t('Sales closed')
  }
  if (type.available <= 0) return t('Sold out')
  if (canBuy && !type.allowedForYou) return t('Not for your membership')
  if (canBuy && max <= 0) return t('You have the maximum')
  return ''
}
