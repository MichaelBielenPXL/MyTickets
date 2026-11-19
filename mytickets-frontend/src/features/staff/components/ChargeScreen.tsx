import { type FormEvent, useEffect, useState } from 'react'

import { QrScanner } from '@/components/QrScanner'
import { t } from '@/lib/i18n'
import { money } from '@/utils/format'
import { cardIdFromQr } from '@/utils/qr'

import type { Outcome } from '../types'

export type ChargeStep =
  | { kind: 'waiting'; purpose: 'charge' | 'credit'; totalCents: number }
  | { kind: 'busy' }
  | { kind: 'done'; outcome: Outcome }

type ChargeScreenProps = {
  step: ChargeStep
  /** Whether cards held to the phone are being read; otherwise scanning or typing works. */
  listening: boolean
  /** A tapped or typed card number, or a scanned member QR code (app or wallet) or card QR. */
  onCard: (uid: string) => void
  onClose: () => void
  /** After a refused charge: try the same order again. */
  onRetry: () => void
}

const SUCCESS_SHOWN_MS = 2600

/**
 * The full-screen step after Charge: hold the card here, or scan the member's QR code (in the app, in
 * Apple or Google Wallet, or printed on the card), then a big ✓ or ✗ readable across the bar.
 */
export function ChargeScreen({ step, listening, onCard, onClose, onRetry }: ChargeScreenProps) {
  const [typed, setTyped] = useState('')
  // Off while the order is being sent; on again for "Try another card".
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraProblem, setCameraProblem] = useState('')

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
            {t('Next order')}
          </button>
        ) : (
          <div className="charge-actions">
            <button className="till-charge light" onClick={onRetry}>
              {t('Try another card')}
            </button>
            <button className="till-ghost" onClick={onClose}>
              {t('Back to the order')}
            </button>
          </div>
        )}
      </div>
    )
  }

  const waiting = step.kind === 'waiting' ? step : null
  return (
    <div className="charge-screen" role="dialog" aria-label={t('Tap card')}>
      <div className="charge-prompt">
        {waiting?.purpose === 'charge' && (
          <>
            <span className="charge-label">{waiting.totalCents < 0 ? t('Give back') : t('To pay')}</span>
            <strong className="charge-amount">{money(Math.abs(waiting.totalCents))}</strong>
          </>
        )}
        {waiting?.purpose === 'credit' && (
          <strong className="charge-amount small">{t('Check tokens')}</strong>
        )}
        {cameraOn && step.kind === 'waiting' ? (
          <QrScanner
            onScan={(payload) => onCard(cardIdFromQr(payload))}
            onError={() => {
              setCameraOn(false)
              setCameraProblem(
                t('The camera could not start. Allow camera access for this site, or type the card number.'),
              )
            }}
          />
        ) : (
          <div className={step.kind === 'busy' ? 'charge-card busy' : 'charge-card'} aria-hidden="true">
            <span />
          </div>
        )}
        <p>
          {step.kind === 'busy'
            ? t('One moment…')
            : cameraOn
              ? t('Hold the QR code in front of the camera')
              : listening
                ? t('Hold the card to the back of the phone')
                : t('Type the card number')}
        </p>
        {cameraProblem && <p className="charge-problem">{cameraProblem}</p>}
      </div>
      <button
        className="till-ghost"
        onClick={() => {
          setCameraProblem('')
          setCameraOn((on) => !on)
        }}
        disabled={step.kind === 'busy'}
      >
        {cameraOn ? t('Stop camera') : t('Scan QR code')}
      </button>
      <form onSubmit={submit} className="charge-typed">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={t('Card number')}
          aria-label={t('Card number')}
          autoCapitalize="characters"
          autoComplete="off"
          disabled={step.kind === 'busy'}
        />
        <button className="till-ghost" disabled={step.kind === 'busy' || !typed.trim()}>
          {t('Use')}
        </button>
      </form>
      <button className="till-ghost" onClick={onClose} disabled={step.kind === 'busy'}>
        {t('Cancel')}
      </button>
    </div>
  )
}
