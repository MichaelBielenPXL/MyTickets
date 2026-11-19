import { type FormEvent, useState } from 'react'

import { CardReader, Field } from '@/components'
import { ApiError } from '@/lib/api-client'
import { t } from '@/lib/i18n'
import { dateTime, errorText, timeOnly } from '@/utils/format'
import { readStaffQr } from '@/utils/qr'

import { useCheckIn } from '../api/staff'
import type { CheckInRequest, CheckInResult, Outcome, StaffEvent } from '../types'
import { EventDoors } from './EventDoors'
import { OutcomeBanner } from './OutcomeBanner'
import { ScanQrButton } from './ScanQrButton'

type DoorModeProps = {
  slug: string
  events: StaffEvent[]
}

/**
 * Let people in: scan a QR code (the ticket, the member code from the app or wallet, or the one printed
 * on a card), tap their card, or type the ticket code.
 */
export function DoorMode({ slug, events }: DoorModeProps) {
  const [eventId, setEventId] = useState(events[0]?.id ?? '')
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [checkedInCount, setCheckedInCount] = useState(0)
  const [typedCode, setTypedCode] = useState('')
  const checkIn = useCheckIn(slug)

  function admit(by: Omit<CheckInRequest, 'eventId'>) {
    if (checkIn.isPending || !eventId) return
    checkIn.mutate(
      { eventId, ...by },
      {
        onSuccess: (result) => {
          setOutcome(welcome(result))
          setCheckedInCount((count) => count + 1)
          navigator.vibrate?.(80)
        },
        onError: (error) => {
          setOutcome(refusal(error))
          navigator.vibrate?.([120, 80, 120])
        },
      },
    )
  }

  function changeEvent(id: string) {
    setEventId(id)
    setOutcome(null)
    setCheckedInCount(0)
  }

  function submitTypedCode(event: FormEvent) {
    event.preventDefault()
    if (typedCode.trim()) admit({ code: typedCode.trim() })
    setTypedCode('')
  }

  const current = events.find((e) => e.id === eventId) ?? null
  const open = current?.status === 'Open'

  if (events.length === 0) {
    return <p className="muted">{t('There is no published event to check people in for.')}</p>
  }
  return (
    <div className="stack">
      <Field label={t('Event')}>
        <select value={eventId} onChange={(e) => changeEvent(e.target.value)}>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name} · {dateTime(event.startsAt)}
            </option>
          ))}
        </select>
      </Field>
      {current && <EventDoors slug={slug} event={current} />}
      {!open && <p className="muted">{t('Open the doors to start checking people in.')}</p>}
      {open && (
        <>
          <OutcomeBanner outcome={outcome} />
          <p className="muted">{t('{count} checked in on this phone', { count: checkedInCount })}</p>

          <ScanQrButton
            onScan={(payload) => admit(readStaffQr(payload))}
            cameraProblem={t(
              'The camera could not start. Allow camera access for this site, or type the ticket code.',
            )}
          />
          <CardReader
            prompt={t('Ready. Hold a card against the back of the phone.')}
            onCard={(cardUid) => admit({ cardUid })}
          />
          <form onSubmit={submitTypedCode} className="row">
            <input
              value={typedCode}
              onChange={(e) => setTypedCode(e.target.value)}
              placeholder={t('or type the ticket code')}
              aria-label={t('Ticket code')}
              autoComplete="off"
            />
            <button className="btn" disabled={!typedCode.trim()}>
              {t('Check in')}
            </button>
          </form>
        </>
      )}
    </div>
  )
}

function welcome(result: CheckInResult): Outcome {
  const more = result.remaining
  const others =
    more === 1
      ? ` · ${t('1 more ticket on this account')}`
      : more > 1
        ? ` · ${t('{count} more tickets on this account', { count: more })}`
        : ''
  return { ok: true, title: result.name, detail: result.ticketType + others }
}

/** "Already checked in" comes with who and when, so staff can tell a mistake from a copied ticket. */
function refusal(error: unknown): Outcome {
  const body = error instanceof ApiError ? error.body : {}
  if (typeof body.checkedInAt !== 'string') return { ok: false, title: errorText(error) }
  const who = typeof body.name === 'string' ? `${body.name} · ` : ''
  const when = timeOnly(body.checkedInAt)
  return { ok: false, title: errorText(error), detail: who + t('checked in at {time}', { time: when }) }
}
