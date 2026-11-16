import { useState } from 'react'

import { QueryResult } from '@/components'
import { dateTime } from '@/utils/format'

import { useAdminEvents, useAdminTiers } from '../api/admin'
import type { AdminEvent } from '../types'
import { EventForm } from './EventForm'
import { TicketTypeList } from './TicketTypeList'

type EventsTabProps = {
  slug: string
}

export function EventsTab({ slug }: EventsTabProps) {
  const [editing, setEditing] = useState<AdminEvent | 'new' | null>(null)
  const events = useAdminEvents(slug)
  const tiers = useAdminTiers(slug).data ?? []

  return (
    <div className="stack">
      {editing ? (
        <EventForm
          key={editing === 'new' ? 'new' : editing.id}
          slug={slug}
          event={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      ) : (
        <button className="btn primary" onClick={() => setEditing('new')}>
          New event
        </button>
      )}
      <QueryResult query={events}>
        {(list) => (
          <>
            {list.length === 0 && <p className="muted">No events yet.</p>}
            {list.map((event) => (
              <section key={event.id} className="panel stack">
                <div className="spread">
                  <div>
                    <strong>{event.name}</strong>{' '}
                    <span className={event.published ? 'tag good' : 'tag'}>
                      {event.published ? 'Published' : 'Draft'}
                    </span>
                    <p className="muted">
                      {dateTime(event.startsAt)}
                      {event.location && ` · ${event.location}`}
                    </p>
                  </div>
                  <button className="btn" onClick={() => setEditing(event)}>
                    Edit
                  </button>
                </div>
                <TicketTypeList slug={slug} event={event} tiers={tiers} />
              </section>
            ))}
          </>
        )}
      </QueryResult>
    </div>
  )
}
