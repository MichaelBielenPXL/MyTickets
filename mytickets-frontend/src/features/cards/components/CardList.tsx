import { ErrorNote } from '@/components'
import { t } from '@/lib/i18n'

import { useSetCardBlocked } from '../api/cards'
import type { Card } from '../types'

type CardListProps = {
  slug: string
  cards: Card[]
}

/**
 * The cards that pay with this wallet. A lost card can be blocked (and unblocked if it turns up); taking a card
 * off the account is for the organisation, so nobody gets round the one-card-a-year rule.
 */
export function CardList({ slug, cards }: CardListProps) {
  const setBlocked = useSetCardBlocked(slug)

  if (cards.length === 0) return <p className="muted">{t('No card linked yet.')}</p>
  return (
    <>
      <div className="list">
        {cards.map((card) => (
          <div key={card.id} className="list-item">
            <div>
              <strong>{card.label || t('Card {number}', { number: card.number })}</strong>{' '}
              {card.blocked && <span className="tag bad">{t('Blocked')}</span>}
            </div>
            <button
              className="btn"
              disabled={setBlocked.isPending}
              onClick={() => setBlocked.mutate({ id: card.id, blocked: !card.blocked })}
            >
              {card.blocked ? t('Unblock') : t('Block')}
            </button>
          </div>
        ))}
      </div>
      <ErrorNote error={setBlocked.error} />
    </>
  )
}
