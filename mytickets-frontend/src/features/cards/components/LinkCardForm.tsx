import { useState } from 'react'

import { ErrorNote, QrScanner } from '@/components'
import { t } from '@/lib/i18n'
import { cardCodeFromQr } from '@/utils/qr'

import { LinkCardDialog } from './LinkCardDialog'

type LinkCardFormProps = {
  slug: string
}

/**
 * Linking a card the organisation handed out. Holding it to the phone opens its link by itself; on a phone
 * that doesn't, the QR printed on it does the same. There is no number to type: only issued cards can be linked.
 */
export function LinkCardForm({ slug }: LinkCardFormProps) {
  const [cameraOn, setCameraOn] = useState(false)
  const [problem, setProblem] = useState('')
  const [code, setCode] = useState<string | null>(null)

  function scanned(payload: string) {
    const found = cardCodeFromQr(payload)
    setCameraOn(false)
    if (!found) return setProblem(t("This QR code isn't a card."))
    setProblem('')
    setCode(found)
  }

  return (
    <section className="stack panel">
      <div>
        <h2>{t('Link a card')}</h2>
        <p className="muted">{t('Hold the card to your phone, or scan its QR code.')}</p>
      </div>
      {cameraOn ? (
        <div className="card-qr-camera">
          <QrScanner
            onScan={scanned}
            onError={() => {
              setCameraOn(false)
              setProblem(
                t(
                  'The camera could not start. Allow camera access for this site, or hold the card to your phone.',
                ),
              )
            }}
          />
          <button type="button" className="btn" onClick={() => setCameraOn(false)}>
            {t('Close QR scanner')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn"
          onClick={() => {
            setProblem('')
            setCameraOn(true)
          }}
        >
          {t('Scan the QR code on the card')}
        </button>
      )}
      <ErrorNote>{problem}</ErrorNote>
      {code && <LinkCardDialog key={code} slug={slug} code={code} onDone={() => setCode(null)} />}
    </section>
  )
}
