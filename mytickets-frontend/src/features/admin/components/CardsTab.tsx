import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'

import { ConfirmDialog, ErrorNote, Field, QueryResult } from '@/components'
import { t } from '@/lib/i18n'

import { useAdminCards, useCreateCards, useDeleteCard, useSetCardBlocked, useUnlinkCard } from '../api/admin'
import type { AdminCard } from '../types'
import { CardDesignPanel } from './CardDesignPanel'
import { WriteCards } from './WriteCards'
import { type CardWriter, useCardWriter } from './useCardWriter'

type Filter = 'all' | 'unwritten' | 'ready' | 'linked' | 'blocked'

const FILTERS: Record<Filter, string> = {
  all: 'All',
  unwritten: 'Not written',
  ready: 'Ready',
  linked: 'Linked',
  blocked: 'Blocked',
}

/** Blocked and nobody has it: lost and given up on. Out of the way until it turns up and is reused. */
const isRetired = (card: AdminCard) => card.blocked && !card.linkedTo

/** Where a card is: made, written to a chip and waiting for a member, linked to someone, or blocked. */
function statusOf(card: AdminCard): Exclude<Filter, 'all'> {
  if (card.blocked) return 'blocked'
  if (card.linkedTo) return 'linked'
  return card.uid ? 'ready' : 'unwritten'
}

/** Manage → Cards: make cards, print and write them, and see who has which. */
export function CardsTab({ slug }: { slug: string }) {
  const cards = useAdminCards(slug)
  return <QueryResult query={cards}>{(list) => <Cards slug={slug} cards={list} />}</QueryResult>
}

function Cards({ slug, cards }: { slug: string; cards: AdminCard[] }) {
  const [count, setCount] = useState('50')
  // The number of cards waiting for "yes, create them".
  const [confirming, setConfirming] = useState<number | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [showRetired, setShowRetired] = useState(false)
  const create = useCreateCards(slug)
  // One writer for the panel and every row, so only one card is written at a time.
  const writer = useCardWriter(slug)

  function submit(event: FormEvent) {
    event.preventDefault()
    const wanted = Number(count)
    if (Number.isInteger(wanted) && wanted > 0) setConfirming(wanted)
  }

  // Numbers carry on from the highest card so far.
  const first = Math.max(0, ...cards.map((card) => Number(card.number) || 0)) + 1

  const shown = cards
    .filter((card) => filter === 'all' || statusOf(card) === filter)
    .filter((card) => filter === 'blocked' || showRetired || !isRetired(card))
    .filter((card) => card.number.includes(search.trim()))
    // Retired cards last, the rest newest first as the server sends them.
    .sort((a, b) => Number(isRetired(a)) - Number(isRetired(b)))

  return (
    <div className="stack cards-admin">
      <form onSubmit={submit} className="panel stack">
        <div className="row wrap cards-create">
          <Field label={t('How many cards')}>
            <input inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
          </Field>
          <button className="btn primary" disabled={create.isPending}>
            {t('Create cards')}
          </button>
        </div>
        <p className="muted">
          {t(
            'Each card gets a number and its own link. Print them with the file below, then write each chip.',
          )}
        </p>
        <div className="row wrap">
          <Link className="btn" to={`/${slug}/admin/cards/print`}>
            {t('Print cards with QR codes')}
          </Link>
          <a className="btn ghost" href={`/api/orgs/${slug}/admin/cards/export`} download>
            {t('Download for the card printer')}
          </a>
        </div>
        <ErrorNote error={create.error} />
      </form>
      <ConfirmDialog
        open={confirming !== null}
        title={t('Create {count} cards?', { count: confirming ?? 0 })}
        message={t('They get the numbers {first} to {last}.', {
          first: String(first),
          last: String(first + (confirming ?? 1) - 1),
        })}
        confirmLabel={t('Create')}
        busy={create.isPending}
        onCancel={() => setConfirming(null)}
        onConfirm={() => create.mutate(confirming ?? 0, { onSettled: () => setConfirming(null) })}
      />

      <WriteCards writer={writer} cards={cards} />
      <CardDesignPanel slug={slug} />

      <div className="row wrap" role="group" aria-label={t('Show')}>
        {(Object.keys(FILTERS) as Filter[]).map((key) => (
          <button
            key={key}
            type="button"
            className={filter === key ? 'btn chosen' : 'btn'}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {t(FILTERS[key])}
          </button>
        ))}
      </div>
      <label className="check">
        <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />
        {t('Show blocked cards nobody has')}
      </label>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('Search by number')}
        aria-label={t('Search by number')}
        inputMode="numeric"
      />

      {shown.length === 0 ? (
        <p className="muted">{cards.length === 0 ? t('No cards yet.') : t('No cards match.')}</p>
      ) : (
        <ul className="list card-rows">
          {shown.map((card) => (
            <CardRow key={card.id} slug={slug} card={card} writer={writer} />
          ))}
        </ul>
      )}
    </div>
  )
}

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
function CardRow({ slug, card, writer }: { slug: string; card: AdminCard; writer: CardWriter }) {
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
          <span className={status === 'blocked' ? 'tag bad' : 'tag'}>{t(FILTERS[status])}</span>
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
