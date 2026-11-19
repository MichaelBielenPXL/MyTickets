import { useState } from 'react'

import { ErrorNote, QrScanner } from '@/components'
import { t } from '@/lib/i18n'
import { nfcSupported, writeCard } from '@/lib/nfc'
import { cardCodeFromQr } from '@/utils/qr'

import { useCardWriting, useCreateBlankCard, useReportCardWritten } from '../api/admin'
import type { AdminCard } from '../types'

type WriteCardsProps = {
  slug: string
  /** The organisation's cards, to find the one whose printed QR was scanned. */
  cards: AdminCard[]
}

type Step =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'holding'; card: AdminCard }
  /** Written and locked, but the server didn't hear which chip: only that is sent again. */
  | { kind: 'unreported'; card: AdminCard; uid: string }
  | { kind: 'done'; card: AdminCard }

/**
 * Writing cards on an Android phone. A printed card: scan its QR first, so the chip can't end up paired with
 * the wrong print, then hold the chip to the phone. A blank card: a new card is made and written straight away.
 * Either way the chip gets the card's link, is locked, and the server learns its serial number.
 */
export function WriteCards({ slug, cards }: WriteCardsProps) {
  const writing = useCardWriting(slug).data
  const createBlank = useCreateBlankCard(slug)
  const report = useReportCardWritten(slug)
  const [step, setStep] = useState<Step>({ kind: 'idle' })
  const [problem, setProblem] = useState('')

  if (!nfcSupported) return <p className="muted">{t('Writing cards needs Chrome on an Android phone.')}</p>
  if (!writing) return null
  if (!writing.ready) return <ErrorNote>{writing.reason ?? ''}</ErrorNote>

  async function write(card: AdminCard) {
    if (!card.url) return
    setProblem('')
    setStep({ kind: 'holding', card })
    try {
      const { serialNumber } = await writeCard(card.url, {})
      sendChip(card, serialNumber)
    } catch (error) {
      setStep({ kind: 'idle' })
      setProblem(writeProblem(error))
    }
  }

  function sendChip(card: AdminCard, uid: string) {
    report.mutate(
      { id: card.id, uid },
      {
        onSuccess: () => setStep({ kind: 'done', card }),
        onError: () => setStep({ kind: 'unreported', card, uid }),
      },
    )
  }

  function scanned(payload: string) {
    const code = cardCodeFromQr(payload)
    const card = cards.find((c) => c.code === code)
    if (!card) {
      setStep({ kind: 'idle' })
      return setProblem(t("This QR code isn't one of your cards."))
    }
    if (card.uid) {
      setStep({ kind: 'idle' })
      return setProblem(t('Card {number} is already written.', { number: card.number }))
    }
    void write(card)
  }

  function writeBlank() {
    setProblem('')
    createBlank.mutate(undefined, { onSuccess: (card) => void write(card) })
  }

  const busy = step.kind === 'holding' || createBlank.isPending || report.isPending
  return (
    <section className="panel stack write-cards">
      <h3>{t('Write cards')}</h3>
      <p className="muted">{t("Cards are locked after writing and can't be changed.")}</p>

      {step.kind === 'scanning' ? (
        <div className="card-qr-camera">
          <QrScanner
            onScan={scanned}
            onError={() => {
              setStep({ kind: 'idle' })
              setProblem(t('The camera could not start. Allow camera access for this site.'))
            }}
          />
          <button type="button" className="btn" onClick={() => setStep({ kind: 'idle' })}>
            {t('Close QR scanner')}
          </button>
        </div>
      ) : (
        <div className="row wrap">
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => {
              setProblem('')
              setStep({ kind: 'scanning' })
            }}
          >
            {t('Write a printed card')}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={writeBlank}>
            {t('Write a blank card')}
          </button>
        </div>
      )}

      {step.kind === 'holding' && (
        <p className="write-cards-hold">
          {t('Card {number}: hold the chip to the back of the phone.', { number: step.card.number })}
        </p>
      )}
      {step.kind === 'unreported' && (
        <div className="stack">
          <ErrorNote>
            {t('Card {number} is written, but the server did not hear which chip it is.', {
              number: step.card.number,
            })}
          </ErrorNote>
          <button
            type="button"
            className="btn"
            disabled={report.isPending}
            onClick={() => sendChip(step.card, step.uid)}
          >
            {t('Try again')}
          </button>
        </div>
      )}
      {step.kind === 'done' && (
        <p className="note ok" role="status">
          {t('Card {number} is written.', { number: step.card.number })}
        </p>
      )}
      <ErrorNote>{problem}</ErrorNote>
      <ErrorNote error={createBlank.error} />
    </section>
  )
}

function writeProblem(error: unknown) {
  switch (error instanceof Error ? error.message : '') {
    case 'lock-failed':
      return t(
        'The link is written, but the chip could not be locked. Put this card aside and use another one.',
      )
    case 'unsupported':
      return t('The phone could not start writing. Turn on NFC and allow it for this site.')
    default:
      return t('The card could not be written. Hold it still against the phone and try again.')
  }
}
