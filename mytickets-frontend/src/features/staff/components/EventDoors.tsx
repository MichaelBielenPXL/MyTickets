import { useState } from 'react'

import { ConfirmDialog, ErrorNote } from '@/components'
import { t } from '@/lib/i18n'
import { dateTime } from '@/utils/format'

import { useEventDoors } from '../api/staff'
import type { EventStatus } from '../types'

type EventDoorsProps = {
  slug: string
  event: { id: string; name: string; startsAt: string; status: EventStatus }
}

const LABELS: Record<EventStatus, string> = { Upcoming: 'Not open yet', Open: 'Doors open', Closed: 'Closed' }

/**
 * Whether people can get in, and the button to change it: open the doors early, close the event (for
 * one without an end time, this is how it ends), or open it again.
 */
export function EventDoors({ slug, event }: EventDoorsProps) {
  const doors = useEventDoors(slug, event.id)
  const [confirmClose, setConfirmClose] = useState(false)

  return (
    <div className="event-doors">
      <span className={`tag event-status ${event.status.toLowerCase()}`}>{t(LABELS[event.status])}</span>
      {event.status === 'Upcoming' && (
        <>
          <span className="muted">{t('Opens {when}', { when: dateTime(event.startsAt) })}</span>
          <button className="btn small" disabled={doors.isPending} onClick={() => doors.mutate('open')}>
            {t('Open doors now')}
          </button>
        </>
      )}
      {event.status === 'Open' && (
        <button className="btn small" disabled={doors.isPending} onClick={() => setConfirmClose(true)}>
          {t('Close event')}
        </button>
      )}
      {event.status === 'Closed' && (
        <button className="btn small" disabled={doors.isPending} onClick={() => doors.mutate('open')}>
          {t('Reopen')}
        </button>
      )}
      <ErrorNote error={doors.error} />
      <ConfirmDialog
        open={confirmClose}
        title={t('Close {name}?', { name: event.name })}
        message={t('Nobody gets in after this and ticket sales stop. You can reopen it later.')}
        confirmLabel={t('Close event')}
        destructive
        busy={doors.isPending}
        onConfirm={() => doors.mutate('close', { onSuccess: () => setConfirmClose(false) })}
        onCancel={() => setConfirmClose(false)}
      />
    </div>
  )
}
