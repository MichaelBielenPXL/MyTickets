import { type FormEvent, useState } from 'react'

import { ErrorNote } from './ErrorNote'
import { useCardTaps } from './useCardTaps'

type CardReaderProps = {
  /** Called with the card number each time a card is tapped or typed. */
  onCard: (uid: string) => void
  /** What to tell staff while the reader is listening, e.g. "Tap card to charge € 9,60". */
  prompt: string
  /** Ignore cards for now, for example while the previous one is still being handled. */
  disabled?: boolean
}

/**
 * Gets a card number, by holding the card to the phone (Chrome on Android) or by typing it.
 * Once started the reader keeps listening, so staff can serve one guest after another.
 */
export function CardReader({ onCard, prompt, disabled }: CardReaderProps) {
  const [typed, setTyped] = useState('')
  const { supported, listening, problem, start } = useCardTaps(onCard, disabled)

  function submitTyped(event: FormEvent) {
    event.preventDefault()
    if (!typed.trim() || disabled) return
    onCard(typed.trim())
    setTyped('')
  }

  return (
    <div className="card-reader">
      {supported && <TapArea listening={listening} prompt={prompt} onStart={start} />}
      <ErrorNote>{problem}</ErrorNote>
      <form onSubmit={submitTyped} className="row">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={supported ? 'or type the card number' : 'Card number'}
          aria-label="Card number"
          autoCapitalize="characters"
          autoComplete="off"
        />
        <button className="btn" disabled={disabled || !typed.trim()}>
          Use
        </button>
      </form>
      {!supported && (
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
