import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { QueryResult } from '@/components'
import { t } from '@/lib/i18n'

import { useMyTickets } from '../api/tickets'
import { TicketCard } from '../components/TicketCard'
import type { MyTicket } from '../types'

const DAY_MS = 24 * 3600 * 1000

export function TicketsPage() {
  const [openId, setOpenId] = useState<string | null>(null)
  // Past tickets are out of the way until asked for.
  const [showHistory, setShowHistory] = useState(false)
  // A ticket stays under "upcoming" until a day after the event starts, so it is easy to find at the door.
  const [pastBefore] = useState(() => Date.now() - DAY_MS)
  const { slug = '' } = useParams()
  const tickets = useMyTickets(slug)

  function renderList(list: MyTicket[]) {
    return list.map((ticket) => (
      <TicketCard
        key={ticket.id}
        ticket={ticket}
        open={openId === ticket.id}
        onToggle={() => setOpenId(openId === ticket.id ? null : ticket.id)}
      />
    ))
  }

  return (
    <main className="customer-page tickets-page">
      <header className="page-heading">
        <div>
          <h1>{t('Your tickets')}</h1>
          <p className="lead">{t('Everything you need for the door, all in one place.')}</p>
        </div>
      </header>
      <QueryResult query={tickets}>
        {(all) => {
          const isPast = (ticket: MyTicket) => new Date(ticket.startsAt).getTime() <= pastBefore
          const upcoming = all.filter((t) => !isPast(t)).reverse()
          const past = all.filter(isPast)
          return (
            <>
              {all.length === 0 && (
                <p className="muted empty-state">
                  {t('No tickets yet.')} <Link to={`/${slug}`}>{t('Find an event')}</Link>.
                </p>
              )}
              {upcoming.length > 0 && (
                <section className="content-section">
                  <div className="section-heading">
                    <h2>{t('Upcoming')}</h2>
                    <span className="muted">{upcoming.length}</span>
                  </div>
                  <div className="list">{renderList(upcoming)}</div>
                </section>
              )}
              {upcoming.length === 0 && past.length > 0 && (
                <p className="muted empty-state">
                  {t('No upcoming tickets.')} <Link to={`/${slug}`}>{t('Find an event')}</Link>.
                </p>
              )}
              {past.length > 0 && (
                <button
                  type="button"
                  className="btn ghost small ticket-history-toggle"
                  aria-expanded={showHistory}
                  onClick={() => setShowHistory(!showHistory)}
                >
                  {showHistory
                    ? t('Hide ticket history')
                    : t('Show ticket history ({count})', { count: past.length })}
                </button>
              )}
              {showHistory && past.length > 0 && (
                <section className="content-section" aria-labelledby="ticket-history">
                  <div className="section-heading">
                    <h2 id="ticket-history">{t('Ticket history')}</h2>
                  </div>
                  <div className="list faded">{renderList(past)}</div>
                </section>
              )}
            </>
          )
        }}
      </QueryResult>
    </main>
  )
}
