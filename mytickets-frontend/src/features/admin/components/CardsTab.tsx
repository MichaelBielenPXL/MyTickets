import { type FormEvent, useState } from 'react'

import { ErrorNote, Field, QueryResult } from '@/components'
import { t } from '@/lib/i18n'

import { useAdminCards, useCreateCards, useDeleteCard, useSetCardBlocked, useUnlinkCard } from '../api/admin'
import type { AdminCard } from '../types'
import { WriteCards } from './WriteCards'

type Filter = 'all' | 'unwritten' | 'ready' | 'linked' | 'blocked'

const FILTERS: Record<Filter, string> = {
  all: 'All',
  unwritten: 'Not written',
  ready: 'Ready',
  linked: 'Linked',
  blocked: 'Blocked',
}

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
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const create = useCreateCards(slug)

  function submit(event: FormEvent) {
    event.preventDefault()
    const wanted = Number(count)
    if (Number.isInteger(wanted) && wanted > 0) create.mutate(wanted)
  }

  const shown = cards.filter(
    (card) => (filter === 'all' || statusOf(card) === filter) && card.number.includes(search.trim()),
  )

  return (
    <div className="stack cards-admin">
      <form onSubmit={submit} className="panel stack">
        <div className="row wrap">
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
        <a className="btn" href={`/api/orgs/${slug}/admin/cards/export`} download>
          {t('Download for the card printer')}
        </a>
        <ErrorNote error={create.error} />
      </form>

      <WriteCards slug={slug} cards={cards} />

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
            <CardRow key={card.id} slug={slug} card={card} />
          ))}
        </ul>
      )}
    </div>
  )
}

function CardRow({ slug, card }: { slug: string; card: AdminCard }) {
  const setBlocked = useSetCardBlocked(slug)
  const unlink = useUnlinkCard(slug)
  const remove = useDeleteCard(slug)
  const busy = setBlocked.isPending || unlink.isPending || remove.isPending
  const status = statusOf(card)

  return (
    <li className="list-item">
      <div>
        <strong>{card.number}</strong>{' '}
        <span className={status === 'blocked' ? 'tag bad' : 'tag'}>{t(FILTERS[status])}</span>
        {card.linkedTo && <p className="muted">{card.linkedTo.name}</p>}
        <ErrorNote error={setBlocked.error ?? unlink.error ?? remove.error} />
      </div>
      <div className="row">
        <button
          className="btn"
          disabled={busy}
          onClick={() => setBlocked.mutate({ id: card.id, blocked: !card.blocked })}
        >
          {card.blocked ? t('Unblock') : t('Block')}
        </button>
        {card.linkedTo && (
          <button className="btn" disabled={busy} onClick={() => unlink.mutate(card.id)}>
            {t('Unlink')}
          </button>
        )}
        {!card.uid && !card.linkedTo && (
          <button className="btn danger" disabled={busy} onClick={() => remove.mutate(card.id)}>
            {t('Delete')}
          </button>
        )}
      </div>
    </li>
  )
}
