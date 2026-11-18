import { useState } from 'react'

import { ConfirmDialog, ErrorNote } from '@/components'

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
  // The card someone asked to remove, while they confirm.
  const [removing, setRemoving] = useState<Card | null>(null)

  function removeConfirmed() {
    if (!removing) return
    remove.mutate(removing.id, { onSettled: () => setRemoving(null) })
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
              <button className="btn danger" disabled={busy} onClick={() => setRemoving(card)}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <ErrorNote error={setBlocked.error ?? remove.error} />
      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.label || 'this card'}?`}
        message={
          removing?.blocked
            ? 'It can no longer be used, and you can link it again later.'
            : 'It stops paying with your tokens. Lost it? Block it instead, so you can unblock it if it turns up.'
        }
        confirmLabel="Remove"
        destructive
        busy={remove.isPending}
        onConfirm={removeConfirmed}
        onCancel={() => setRemoving(null)}
      />
    </>
  )
}
