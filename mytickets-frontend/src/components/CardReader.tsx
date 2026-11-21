import { t } from '@/lib/i18n'

import { ErrorNote } from './ErrorNote'
import { useCardTaps } from './useCardTaps'

type CardReaderProps = {
  /** Called with the chip's serial number each time a card is tapped. */
  onCard: (uid: string) => void
  /** What to tell staff while the reader is listening, e.g. "Tap card to charge € 9,60". */
  prompt: string
  /** Ignore cards for now, for example while the previous one is still being handled. */
  disabled?: boolean
}

/**
 * Reads cards held to the phone (Chrome on Android). Cards are never typed in: elsewhere, staff scan the
 * QR code printed on the card (the scan button next to this). Once started the reader keeps listening,
 * so staff can serve one guest after another.
 */
export function CardReader({ onCard, prompt, disabled }: CardReaderProps) {
  const { supported, listening, problem, start } = useCardTaps(onCard, disabled)

  return (
    <div className="card-reader">
      {supported && <TapArea listening={listening} prompt={prompt} onStart={start} />}
      <ErrorNote>{problem}</ErrorNote>
      {!supported && (
        <small className="muted">
          {t("Tapping cards works in Chrome on an Android phone. Here, scan the card's QR code.")}
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
        {t('Start card reader')}
      </button>
    )
  }
  return (
    <p className="reader-ready">
      <span className="pulse" /> {prompt}
    </p>
  )
}
