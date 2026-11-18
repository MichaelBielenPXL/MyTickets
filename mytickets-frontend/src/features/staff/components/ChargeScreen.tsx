import { type FormEvent, useEffect, useState } from 'react'

import { money } from '@/utils/format'

import type { Outcome } from '../types'

export type ChargeStep =
  | { kind: 'waiting'; purpose: 'charge' | 'credit'; totalCents: number }
  | { kind: 'busy' }
  | { kind: 'done'; outcome: Outcome }

type ChargeScreenProps = {
  step: ChargeStep
  /** Whether cards held to the phone are being read; otherwise only typing the number works. */
  listening: boolean
  onCard: (uid: string) => void
  onClose: () => void
  /** After a refused charge: try the same order again. */
  onRetry: () => void
}

const SUCCESS_SHOWN_MS = 2600

/** The full-screen step after Charge: hold the card here, then a big ✓ or ✗ readable across the bar. */
export function ChargeScreen({ step, listening, onCard, onClose, onRetry }: ChargeScreenProps) {
  const [typed, setTyped] = useState('')

  // A good result goes away by itself, ready for the next guest.
  useEffect(() => {
    if (step.kind !== 'done' || !step.outcome.ok) return
    const timer = window.setTimeout(onClose, SUCCESS_SHOWN_MS)
    return () => window.clearTimeout(timer)
  }, [step, onClose])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!typed.trim()) return
    onCard(typed.trim())
    setTyped('')
  }

  if (step.kind === 'done') {
    const { outcome } = step
    return (
      <div
        className={outcome.ok ? 'charge-screen ok' : 'charge-screen fail'}
        onClick={outcome.ok ? onClose : undefined}
      >
        <div className="charge-result" role="status" aria-live="assertive">
          <span className="charge-mark" aria-hidden="true">
            {outcome.ok ? '✓' : '✕'}
          </span>
          <strong>{outcome.title}</strong>
          {outcome.detail && <span>{outcome.detail}</span>}
        </div>
        {outcome.ok ? (
          <button className="till-charge light" onClick={onClose}>
            Next order
          </button>
        ) : (
          <div className="charge-actions">
            <button className="till-charge light" onClick={onRetry}>
              Try another card
            </button>
            <button className="till-ghost" onClick={onClose}>
              Back to the order
            </button>
          </div>
        )}
      </div>
    )
  }

  const waiting = step.kind === 'waiting' ? step : null
  return (
    <div className="charge-screen" role="dialog" aria-label="Tap card">
      <div className="charge-prompt">
        {waiting?.purpose === 'charge' && (
          <>
            <span className="charge-label">{waiting.totalCents < 0 ? 'Give back' : 'To pay'}</span>
            <strong className="charge-amount">{money(Math.abs(waiting.totalCents))}</strong>
          </>
        )}
        {waiting?.purpose === 'credit' && <strong className="charge-amount small">Check tokens</strong>}
        <div className={step.kind === 'busy' ? 'charge-card busy' : 'charge-card'} aria-hidden="true">
          <span />
        </div>
        <p>
          {step.kind === 'busy'
            ? 'One moment…'
            : listening
              ? 'Hold the card to the back of the phone'
              : 'Type the card number'}
        </p>
      </div>
      <form onSubmit={submit} className="charge-typed">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Card number"
          aria-label="Card number"
          autoCapitalize="characters"
          autoComplete="off"
          disabled={step.kind === 'busy'}
        />
        <button className="till-ghost" disabled={step.kind === 'busy' || !typed.trim()}>
          Use
        </button>
      </form>
      <button className="till-ghost" onClick={onClose} disabled={step.kind === 'busy'}>
        Cancel
      </button>
    </div>
  )
}
