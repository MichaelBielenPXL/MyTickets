import { Link } from 'react-router-dom'

import { dayNumber, money, monthShort, timeOnly } from '@/utils/format'

import type { UpcomingEvent } from '../types'

type UpcomingEventsProps = {
  slug: string
  events: UpcomingEvent[]
}

/** What is coming up, each with its date set like a ticket stub so the calendar reads at a glance. */
export function UpcomingEvents({ slug, events }: UpcomingEventsProps) {
  return (
    <section className="upcoming-events">
      <div className="section-heading">
        <h2>Upcoming events</h2>
        {events.length > 0 && <span className="muted">{events.length} planned</span>}
      </div>
      {events.length === 0 && <p className="muted">No upcoming events yet.</p>}
      <div className="list">
        {events.map((event) => (
          <Link key={event.id} to={`/${slug}/events/${event.id}`} className="list-item event-row">
            <span className="event-date" aria-hidden="true">
              <span>{monthShort(event.startsAt)}</span>
              <strong>{dayNumber(event.startsAt)}</strong>
            </span>
            {event.imageUrl && <img className="event-thumb" src={event.imageUrl} alt="" />}
            <div className="list-item-main">
              <strong>{event.name}</strong>
              <p className="muted">
                <time dateTime={event.startsAt}>
                  {monthShort(event.startsAt)} {dayNumber(event.startsAt)}, {timeOnly(event.startsAt)}
                </time>
                {event.location && ` · ${event.location}`}
              </p>
            </div>
            <span className={event.soldOut ? 'tag bad' : 'tag'}>{priceLabel(event)}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function priceLabel(event: UpcomingEvent) {
  if (event.soldOut) return 'Sold out'
  if (event.fromPriceCents === null) return 'Soon'
  if (event.fromPriceCents === 0) return 'Free'
  return `from ${money(event.fromPriceCents)}`
}
