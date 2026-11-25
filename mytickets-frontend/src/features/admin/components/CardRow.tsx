import { useState } from 'react'

import { ConfirmDialog, ErrorNote } from '@/components'
import { t } from '@/lib/i18n'

import { useDeleteCard, useSetCardBlocked, useUnlinkCard } from '../api/admin'
import type { AdminCard } from '../types'
import { CARD_FILTERS, isRetired, statusOf } from '../utils/card-status'
import type { CardWriter } from './useCardWriter'

type RowAction = 'block' | 'unlink' | 'delete'

/** What each action asks before it is done: these are hard to take back, or noticed only at the bar. */
const ASK: Record<RowAction, { title: string; message: string; label: string; destructive?: boolean }> = {
  block: {
    title: 'Block card {number}?',
    message: 'It stops working at the door and the bar straight away.',
    label: 'Block',
  },
  unlink: {
    title: 'Unlink card {number}?',
    message: 'It no longer pays from {name}’s tokens. They find out when they tap it.',
    label: 'Unlink',
  },
  delete: {
    title: 'Delete card {number}?',
    message: 'Its number and link are gone for good. Only cards that were never written can be deleted.',
    label: 'Delete',
    destructive: true,
  },
}

/**
 * One card: its number, where it is, and who has it. Writing it is the only action in view (on a phone that
 * writes); the rest wait behind one button, so a long list stays a list.
 */
export function CardRow({ slug, card, writer }: { slug: string; card: AdminCard; writer: CardWriter }) {
  const setBlocked = useSetCardBlocked(slug)
  const unlink = useUnlinkCard(slug)
  const remove = useDeleteCard(slug)
  const [open, setOpen] = useState(false)
  const [asking, setAsking] = useState<RowAction | null>(null)
  const busy = setBlocked.isPending || unlink.isPending || remove.isPending
  const status = statusOf(card)

  function confirmed() {
    const done = { onSettled: () => setAsking(null) }
    if (asking === 'block') setBlocked.mutate({ id: card.id, blocked: true }, done)
    if (asking === 'unlink') unlink.mutate(card.id, done)
    if (asking === 'delete') remove.mutate(card.id, done)
  }

  function choose(action: RowAction) {
    setOpen(false)
    setAsking(action)
  }

  const ask = asking ? ASK[asking] : null
  return (
    <li className="list-item card-row">
      <div className="card-row-main">
        <div>
          <strong>{card.number}</strong>{' '}
          <span className={status === 'blocked' ? 'tag bad' : 'tag'}>{t(CARD_FILTERS[status])}</span>
          {card.linkedTo && <p className="muted">{card.linkedTo.name}</p>}
          {writer.step.kind === 'holding' && writer.step.card.id === card.id && (
            <p className="write-cards-hold">{t('Hold the chip to the back of the phone.')}</p>
          )}
        </div>
        <div className="row">
          {writer.canWrite && !card.uid && card.url && !card.blocked && (
            <button
              className="btn primary"
              disabled={busy || writer.busy}
              onClick={() => void writer.write(card)}
            >
              {t('Write to chip')}
            </button>
          )}
          <button
            className="btn card-row-more"
            aria-expanded={open}
            aria-label={t('Actions for card {number}', { number: card.number })}
            onClick={() => setOpen((now) => !now)}
          >
            <span aria-hidden="true">•••</span>
          </button>
        </div>
      </div>
      {open && (
        <div className="row wrap card-row-actions">
          {card.blocked ? (
            <button
              className="btn"
              disabled={busy}
              onClick={() => {
                setOpen(false)
                setBlocked.mutate({ id: card.id, blocked: false })
              }}
            >
              {/* A lost card that turns up again goes back to Ready, for the next member to claim. */}
              {isRetired(card) && card.code ? t('Reuse as a new card') : t('Unblock')}
            </button>
          ) : (
            // Blocking only means something once the card is a chip someone could tap.
            card.uid && (
              <button className="btn" disabled={busy} onClick={() => choose('block')}>
                {t('Block')}
              </button>
            )
          )}
          {card.linkedTo && (
            <button className="btn" disabled={busy} onClick={() => choose('unlink')}>
              {t('Unlink')}
            </button>
          )}
          {!card.uid && !card.linkedTo && (
            <button className="btn danger" disabled={busy} onClick={() => choose('delete')}>
              {t('Delete')}
            </button>
          )}
        </div>
      )}
      <ErrorNote error={setBlocked.error ?? unlink.error ?? remove.error} />
      <ConfirmDialog
        open={ask !== null}
        title={ask ? t(ask.title, { number: card.number }) : ''}
        message={ask ? t(ask.message, { name: card.linkedTo?.name ?? '' }) : undefined}
        confirmLabel={ask ? t(ask.label) : ''}
        destructive={ask?.destructive}
        busy={busy}
        onCancel={() => setAsking(null)}
        onConfirm={confirmed}
      />
    </li>
  )
}
