import { ErrorNote, QrScanner } from '@/components'
import { t } from '@/lib/i18n'
import { nfcSupported } from '@/lib/nfc'

import type { AdminCard } from '../types'
import type { CardWriter } from './useCardWriter'

type WriteCardsProps = {
  writer: CardWriter
  /** The organisation's cards, to find the one whose printed QR was scanned. */
  cards: AdminCard[]
}

/**
 * Writing cards on an Android phone. A printed card: scan its QR first, so the chip can't end up paired with
 * the wrong print, then hold the chip to the phone. A blank card: a new card is made and written straight away.
 * A card in the list can also be written with its own button. Either way the chip gets the card's link, is
 * locked, and the server learns its serial number.
 */
export function WriteCards({ writer, cards }: WriteCardsProps) {
  const { step, busy } = writer

  if (!nfcSupported) {
    return (
      <p className="muted">
        {t('Writing cards needs Chrome on an Android phone. Open Manage › Cards there to write them.')}
      </p>
    )
  }
  if (!writer.writing) return null
  if (!writer.writing.ready) return <ErrorNote>{writer.writing.reason ?? ''}</ErrorNote>

  return (
    <section className="panel stack write-cards">
      <h3>{t('Write cards')}</h3>
      <p className="muted">{t("Cards are locked after writing and can't be changed.")}</p>

      {step.kind === 'scanning' ? (
        <div className="card-qr-camera">
          <QrScanner onScan={(payload) => writer.scanned(payload, cards)} onError={writer.cameraFailed} />
          <button type="button" className="btn" onClick={writer.stopScanning}>
            {t('Close QR scanner')}
          </button>
        </div>
      ) : (
        <div className="row wrap">
          <button type="button" className="btn primary" disabled={busy} onClick={writer.startScanning}>
            {t('Write a printed card')}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={writer.writeBlank}>
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
            disabled={writer.reporting}
            onClick={() => writer.sendChip(step.card, step.uid)}
          >
            {t('Try again')}
          </button>
        </div>
      )}
      {step.kind === 'reusable' && (
        <div className="stack">
          <p>{t('Card {number} is blocked and nobody has it.', { number: step.card.number })}</p>
          <button type="button" className="btn" disabled={busy} onClick={() => writer.reuse(step.card)}>
            {t('Reuse as a new card')}
          </button>
        </div>
      )}
      {step.kind === 'reused' && (
        <p className="note ok" role="status">
          {t('Card {number} is ready to be linked again.', { number: step.card.number })}
        </p>
      )}
      {step.kind === 'done' && (
        <p className="note ok" role="status">
          {t('Card {number} is written.', { number: step.card.number })}
        </p>
      )}
      <ErrorNote>{writer.problem}</ErrorNote>
      <ErrorNote error={writer.error} />
    </section>
  )
}
