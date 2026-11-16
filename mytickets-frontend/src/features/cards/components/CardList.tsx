import { ErrorNote } from '@/components'

import { useRemoveCard, useSetCardBlocked } from '../api/cards'
import type { Card } from '../types'

type CardListProps = {
  slug: string
  cards: Card[]
}

export function CardList({ slug, cards }: CardListProps) {
  const setBlocked = useSetCardBlocked(slug)
  const remove = useRemoveCard(slug)
  const busy = setBlocked.isPending || remove.isPending

  function confirmRemove(card: Card) {
    if (confirm('Remove this card from your account?')) remove.mutate(card.id)
  }

  if (cards.length === 0) return <p className="muted">No card linked yet.</p>
  return (
    <>
      <div className="list">
        {cards.map((card) => (
          <div key={card.id} className="list-item">
            <div>
              <strong>{card.label || 'Card'}</strong>{' '}
              {card.blocked && <span className="tag bad">Blocked</span>}
              <p className="muted">
                <code>{card.uid}</code>
              </p>
            </div>
            <div className="row">
              <button
                className="btn"
                disabled={busy}
                onClick={() => setBlocked.mutate({ id: card.id, blocked: !card.blocked })}
              >
                {card.blocked ? 'Unblock' : 'Block'}
              </button>
              <button className="btn danger" disabled={busy} onClick={() => confirmRemove(card)}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <ErrorNote error={setBlocked.error ?? remove.error} />
    </>
  )
}
