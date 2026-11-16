import { type FormEvent, useEffect, useRef, useState } from 'react'

import { listenForCards, nfcSupported } from '@/lib/nfc'

import { ErrorNote } from './ErrorNote'

type CardReaderProps = {
  /** Called with the card number each time a card is tapped or typed. */
  onCard: (uid: string) => void
  /** What to tell staff while the reader is listening, e.g. "Tap card to charge € 9,60". */
  prompt: string
  /** Ignore cards for now, for example while the previous one is still being handled. */
  disabled?: boolean
}

// A card held against the phone is read many times a second; act on it once.
const SAME_CARD_PAUSE_MS = 2500

/**
 * Gets a card number, by holding the card to the phone (Chrome on Android) or by typing it.
 * Once started the reader keeps listening, so staff can serve one guest after another.
 */
export function CardReader({ onCard, prompt, disabled }: CardReaderProps) {
  const [listening, setListening] = useState(false)
  const [problem, setProblem] = useState('')
  const [typed, setTyped] = useState('')
  // The reader outlives renders, so it reads the latest props through refs.
  const latest = useRef({ onCard, disabled })
  const stop = useRef<AbortController | null>(null)
  const lastRead = useRef({ uid: '', at: 0 })

  useEffect(() => {
    latest.current = { onCard, disabled }
  })

  useEffect(() => () => stop.current?.abort(), [])

  async function start() {
    setProblem('')
    stop.current = new AbortController()
    try {
      await listenForCards(stop.current.signal, handleTap, () =>
        setProblem("Couldn't read that card. Hold it still against the back of the phone."),
      )
      setListening(true)
    } catch {
      setProblem('The card reader could not start. Allow NFC for this site, or type the card number.')
    }
  }

  function handleTap(uid: string) {
    const now = Date.now()
    const repeat = uid === lastRead.current.uid && now - lastRead.current.at < SAME_CARD_PAUSE_MS
    if (latest.current.disabled || repeat) return
    lastRead.current = { uid, at: now }
    navigator.vibrate?.(60)
    latest.current.onCard(uid)
  }

  function submitTyped(event: FormEvent) {
    event.preventDefault()
    if (!typed.trim() || disabled) return
    onCard(typed.trim())
    setTyped('')
  }

  return (
    <div className="card-reader">
      {nfcSupported && <TapArea listening={listening} prompt={prompt} onStart={start} />}
      <ErrorNote>{problem}</ErrorNote>
      <form onSubmit={submitTyped} className="row">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={nfcSupported ? 'or type the card number' : 'Card number'}
          aria-label="Card number"
          autoCapitalize="characters"
          autoComplete="off"
        />
        <button className="btn" disabled={disabled || !typed.trim()}>
          Use
        </button>
      </form>
      {!nfcSupported && (
        <small className="muted">
          Tapping cards works in Chrome on an Android phone. Here you can type the number.
        </small>
      )}
    </div>
  )
}

function TapArea({
  listening,
  prompt,
  onStart,
}: {
  listening: boolean
  prompt: string
  onStart: () => void
}) {
  if (!listening) {
    return (
      <button type="button" className="btn primary block" onClick={onStart}>
        Start card reader
      </button>
    )
  }
  return (
    <p className="reader-ready">
      <span className="pulse" /> {prompt}
    </p>
  )
}
