import QrScanner from 'qr-scanner'
import { type FormEvent, useEffect, useRef, useState } from 'react'

import { ErrorNote, Field } from '@/components'
import { nfcSupported, readCardOnce } from '@/lib/nfc'

import { useLinkCard } from '../api/cards'

type LinkCardFormProps = {
  slug: string
}

export function LinkCardForm({ slug }: LinkCardFormProps) {
  const [uid, setUid] = useState('')
  const [label, setLabel] = useState('')
  const [waitingForTap, setWaitingForTap] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [scanProblem, setScanProblem] = useState('')
  const video = useRef<HTMLVideoElement>(null)
  const link = useLinkCard(slug)

  useEffect(() => {
    if (!cameraOpen || !video.current) return
    const scanner = new QrScanner(
      video.current,
      (result) => {
        setUid(cardIdFromQr(result.data))
        setScanProblem('')
        setCameraOpen(false)
      },
      { highlightScanRegion: true, maxScansPerSecond: 8 },
    )
    scanner.start().catch(() => {
      setScanProblem(
        'The camera could not start. Allow camera access for this site, or enter the card number manually.',
      )
      setCameraOpen(false)
    })
    return () => scanner.destroy()
  }, [cameraOpen])

  async function readByTap() {
    setWaitingForTap(true)
    setScanProblem('')
    try {
      setUid(await readCardOnce())
    } catch {
      setScanProblem(
        'The NFC reader could not start. Try scanning the QR code or enter the card number manually.',
      )
    } finally {
      setWaitingForTap(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    link.mutate(
      { uid, label },
      {
        onSuccess: () => {
          setUid('')
          setLabel('')
        },
      },
    )
  }

  return (
    <form onSubmit={submit} className="stack panel">
      <div>
        <h2>Link a card</h2>
        <p className="muted">Scan the QR code on the card, tap the NFC card, or enter its number.</p>
      </div>

      <div className="row wrap">
        <button
          type="button"
          className="btn"
          onClick={() => {
            setScanProblem('')
            setCameraOpen((open) => !open)
          }}
          disabled={waitingForTap}
          aria-expanded={cameraOpen}
        >
          {cameraOpen ? 'Close QR scanner' : 'Scan card QR code'}
        </button>
        {nfcSupported && (
          <button type="button" className="btn" onClick={readByTap} disabled={waitingForTap || cameraOpen}>
            {waitingForTap ? 'Hold the card against your phone…' : 'Scan NFC card'}
          </button>
        )}
      </div>

      {cameraOpen && (
        <div className="card-qr-camera">
          <video ref={video} className="scanner" muted playsInline aria-label="QR code camera preview" />
          <p className="muted">Hold the QR code on the card inside the frame.</p>
        </div>
      )}

      <Field label="Card number" hint="The QR code or NFC chip must identify the same card number.">
        <input
          value={uid}
          onChange={(e) => setUid(e.target.value)}
          required
          autoCapitalize="characters"
          autoComplete="off"
        />
      </Field>
      <Field label="Name for this card (optional)">
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} />
      </Field>
      <ErrorNote>{scanProblem}</ErrorNote>
      <ErrorNote error={link.error} />
      <button className="btn primary" disabled={link.isPending || !uid.trim()}>
        {link.isPending ? 'Linking…' : 'Link card'}
      </button>
    </form>
  )
}

/** A card QR can contain the raw serial number, a URL query value, or a URL ending in the serial. */
function cardIdFromQr(payload: string): string {
  const value = payload.trim()
  try {
    const url = new URL(value)
    for (const key of ['uid', 'cardUid', 'card_id', 'card', 'serial', 'serialNumber']) {
      const id = url.searchParams.get(key)
      if (id) return id.trim()
    }
    const lastPart = url.pathname.split('/').filter(Boolean).at(-1)
    if (lastPart) return decodeURIComponent(lastPart)
  } catch {
    // A plain card serial number is also a valid QR payload.
  }
  return value
}
