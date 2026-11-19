import { useState } from 'react'

import { ErrorNote } from '@/components'
import { QrScanner } from '@/components/QrScanner'
import { t } from '@/lib/i18n'

type ScanQrButtonProps = {
  /** The raw text in each new QR code the camera sees. */
  onScan: (payload: string) => void
  /** Shown when the camera will not start: how to allow it, and what else staff can do. */
  cameraProblem: string
  disabled?: boolean
}

/** A button that turns the camera on to scan QR codes, and off again. */
export function ScanQrButton({ onScan, cameraProblem, disabled }: ScanQrButtonProps) {
  const [cameraOn, setCameraOn] = useState(false)
  const [problem, setProblem] = useState('')

  function cameraFailed() {
    setProblem(cameraProblem)
    setCameraOn(false)
  }

  return (
    <>
      {cameraOn ? (
        <>
          <QrScanner onScan={(payload) => !disabled && onScan(payload)} onError={cameraFailed} />
          <button className="btn" onClick={() => setCameraOn(false)}>
            {t('Stop camera')}
          </button>
        </>
      ) : (
        <button
          className="btn primary block"
          onClick={() => {
            setProblem('')
            setCameraOn(true)
          }}
        >
          {t('Scan QR code')}
        </button>
      )}
      <ErrorNote>{problem}</ErrorNote>
    </>
  )
}
