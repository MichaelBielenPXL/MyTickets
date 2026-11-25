import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'

import { ConfirmDialog, ErrorNote, Field, QueryResult } from '@/components'
import { t } from '@/lib/i18n'

import { useAdminCards, useCreateCards } from '../api/admin'
import type { AdminCard } from '../types'
import { CARD_FILTERS, type CardFilter, isRetired, statusOf } from '../utils/card-status'
import { CardDesignPanel } from './CardDesignPanel'
import { CardRow } from './CardRow'
import { WriteCards } from './WriteCards'
import { useCardWriter } from './useCardWriter'

/** Manage → Cards: make cards, print and write them, and see who has which. */
export function CardsTab({ slug }: { slug: string }) {
  const cards = useAdminCards(slug)
  return <QueryResult query={cards}>{(list) => <Cards slug={slug} cards={list} />}</QueryResult>
}

function Cards({ slug, cards }: { slug: string; cards: AdminCard[] }) {
  const [count, setCount] = useState('50')
  // The number of cards waiting for "yes, create them".
  const [confirming, setConfirming] = useState<number | null>(null)
  const [filter, setFilter] = useState<CardFilter>('all')
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
        {(Object.keys(CARD_FILTERS) as CardFilter[]).map((key) => (
          <button
            key={key}
            type="button"
            className={filter === key ? 'btn chosen' : 'btn'}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {t(CARD_FILTERS[key])}
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
