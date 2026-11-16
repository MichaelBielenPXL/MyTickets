import { type FormEvent, useState } from 'react'

import { CardReader, ErrorNote, Field } from '@/components'
import { ApiError } from '@/lib/api-client'
import { dateTime, errorText } from '@/utils/format'

import { useCheckIn } from '../api/staff'
import type { CheckInRequest, CheckInResult, Outcome, StaffEvent } from '../types'
import { OutcomeBanner } from './OutcomeBanner'
import { QrScanner } from './QrScanner'

type DoorModeProps = {
  slug: string
  events: StaffEvent[]
}

/** Let people in: scan the ticket's QR code, tap their card, or type the ticket code. */
export function DoorMode({ slug, events }: DoorModeProps) {
  const [eventId, setEventId] = useState(events[0]?.id ?? '')
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [checkedInCount, setCheckedInCount] = useState(0)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraProblem, setCameraProblem] = useState('')
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

  function cameraFailed() {
    setCameraProblem(
      'The camera could not start. Allow camera access for this site, or type the ticket code.',
    )
    setCameraOn(false)
  }

  if (events.length === 0) {
    return <p className="muted">There is no published event to check people in for.</p>
  }
  return (
    <div className="stack">
      <Field label="Event">
        <select value={eventId} onChange={(e) => changeEvent(e.target.value)}>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name} · {dateTime(event.startsAt)}
            </option>
          ))}
        </select>
      </Field>
      <OutcomeBanner outcome={outcome} />
      <p className="muted">{checkedInCount} checked in on this phone</p>

      {cameraOn ? (
        <>
          <QrScanner onScan={(code) => admit({ code })} onError={cameraFailed} />
          <button className="btn" onClick={() => setCameraOn(false)}>
            Stop camera
          </button>
        </>
      ) : (
        <button
          className="btn primary block"
          onClick={() => {
            setCameraProblem('')
            setCameraOn(true)
          }}
        >
          Scan ticket QR code
        </button>
      )}
      <ErrorNote>{cameraProblem}</ErrorNote>
      <CardReader
        prompt="Ready. Hold a card against the back of the phone."
        onCard={(cardUid) => admit({ cardUid })}
      />
      <form onSubmit={submitTypedCode} className="row">
        <input
          value={typedCode}
          onChange={(e) => setTypedCode(e.target.value)}
          placeholder="or type the ticket code"
          aria-label="Ticket code"
          autoComplete="off"
        />
        <button className="btn" disabled={!typedCode.trim()}>
          Check in
        </button>
      </form>
    </div>
  )
}

function welcome(result: CheckInResult): Outcome {
  const more = result.remaining
  const others = more > 0 ? ` · ${more} more ticket${more > 1 ? 's' : ''} on this account` : ''
  return { ok: true, title: result.name, detail: result.ticketType + others }
}

/** "Already checked in" comes with who and when, so staff can tell a mistake from a copied ticket. */
function refusal(error: unknown): Outcome {
  const body = error instanceof ApiError ? error.body : {}
  if (typeof body.checkedInAt !== 'string') return { ok: false, title: errorText(error) }
  const who = typeof body.name === 'string' ? `${body.name} · ` : ''
  const when = new Date(body.checkedInAt).toLocaleTimeString()
  return { ok: false, title: errorText(error), detail: `${who}checked in at ${when}` }
}
