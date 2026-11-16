import { Link } from 'react-router-dom'

import { dateTime, money } from '@/utils/format'

import type { UpcomingEvent } from '../types'

type UpcomingEventsProps = {
  slug: string
  events: UpcomingEvent[]
}

export function UpcomingEvents({ slug, events }: UpcomingEventsProps) {
  return (
    <section>
      <h2>Events</h2>
      {events.length === 0 && <p className="muted">No upcoming events yet.</p>}
      <div className="list">
        {events.map((event) => (
          <Link key={event.id} to={`/${slug}/events/${event.id}`} className="list-item">
            {event.imageUrl && <img className="event-thumb" src={event.imageUrl} alt="" />}
            <div className="list-item-main">
              <strong>{event.name}</strong>
              <p className="muted">
                {dateTime(event.startsAt)}
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
