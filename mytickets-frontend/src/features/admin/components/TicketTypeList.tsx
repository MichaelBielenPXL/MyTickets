import { useState } from 'react'

import { money } from '@/utils/format'

import type { AdminEvent, AdminTicketType, AdminTier } from '../types'
import { TicketTypeForm } from './TicketTypeForm'

type TicketTypeListProps = {
  slug: string
  event: AdminEvent
  tiers: AdminTier[]
}

/** The tickets of one event with how they are selling, and the form to add or edit one. */
export function TicketTypeList({ slug, event, tiers }: TicketTypeListProps) {
  const [editing, setEditing] = useState<AdminTicketType | 'new' | null>(null)

  return (
    <div className="stack">
      {event.ticketTypes.length === 0 && !editing && (
        <p className="warn">No tickets yet: add one so people can buy.</p>
      )}
      {event.ticketTypes.map((ticketType) => (
        <div key={ticketType.id} className="spread sub-row">
          <div>
            <strong>{ticketType.name}</strong> ·{' '}
            {ticketType.priceCents === 0 ? 'Free' : money(ticketType.priceCents)}
            {ticketType.allowedTierIds.length > 0 && <span className="tag">Members only</span>}
            <SalesMeter sold={ticketType.sold} capacity={ticketType.capacity} />
            <p className="muted">
              {ticketType.sold} of {ticketType.capacity} sold · {ticketType.checkedIn} checked in
            </p>
          </div>
          <button className="btn small" onClick={() => setEditing(ticketType)}>
            Edit
          </button>
        </div>
      ))}
      {editing ? (
        <TicketTypeForm
          // A fresh form per ticket, so fields never carry over from the previous one.
          key={editing === 'new' ? 'new' : editing.id}
          slug={slug}
          eventId={event.id}
          ticketType={editing === 'new' ? null : editing}
          tiers={tiers}
          onDone={() => setEditing(null)}
        />
      ) : (
        <button className="btn" onClick={() => setEditing('new')}>
          Add ticket
        </button>
      )}
    </div>
  )
}

function SalesMeter({ sold, capacity }: { sold: number; capacity: number }) {
  const percent = capacity > 0 ? (100 * sold) / capacity : 0
  return (
    <div className="meter" role="img" aria-label={`${sold} of ${capacity} sold`}>
      <span style={{ width: `${percent}%` }} />
    </div>
  )
}
