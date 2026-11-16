import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { QueryResult } from '@/components'

import { useMyTickets } from '../api/tickets'
import { TicketCard } from '../components/TicketCard'
import type { MyTicket } from '../types'

const DAY_MS = 24 * 3600 * 1000

export function TicketsPage() {
  const [openId, setOpenId] = useState<string | null>(null)
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
          <h1>Your tickets</h1>
          <p className="lead">Everything you need for the door, all in one place.</p>
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
                  No tickets yet. <Link to={`/${slug}`}>Find an event</Link>.
                </p>
              )}
              {upcoming.length > 0 && (
                <section className="content-section">
                  <div className="section-heading">
                    <h2>Upcoming</h2>
                    <span className="muted">{upcoming.length}</span>
                  </div>
                  <div className="list">{renderList(upcoming)}</div>
                </section>
              )}
              {past.length > 0 && (
                <>
                  <div className="section-heading">
                    <h2>Past</h2>
                  </div>
                  <div className="list faded">{renderList(past)}</div>
                </>
              )}
            </>
          )
        }}
      </QueryResult>
    </main>
  )
}
