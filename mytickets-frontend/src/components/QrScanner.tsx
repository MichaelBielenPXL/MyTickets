import QrScannerLib from 'qr-scanner'
import { useEffect, useRef } from 'react'

type QrScannerProps = {
  /** Called once per code, even though the camera sees it many times a second. */
  onScan: (code: string) => void
  /** Called when the camera cannot start, usually because access was not allowed. */
  onError: () => void
}

const SAME_CODE_PAUSE_MS = 4000

/** Live camera view that reads QR codes for as long as it is on screen. */
export function QrScanner({ onScan, onError }: QrScannerProps) {
  const video = useRef<HTMLVideoElement>(null)
  // The scanner is created once; it reaches the latest callbacks through this ref.
  const latest = useRef({ onScan, onError })
  const lastScan = useRef({ code: '', at: 0 })

  useEffect(() => {
    latest.current = { onScan, onError }
  })

  useEffect(() => {
    if (!video.current) return
    const scanner = new QrScannerLib(
      video.current,
      (scan) => {
        const now = Date.now()
        if (scan.data === lastScan.current.code && now - lastScan.current.at < SAME_CODE_PAUSE_MS) return
        lastScan.current = { code: scan.data, at: now }
        latest.current.onScan(scan.data)
      },
      { highlightScanRegion: true, maxScansPerSecond: 8 },
    )
    scanner.start().catch(() => latest.current.onError())
    return () => scanner.destroy()
  }, [])

  // The library draws its yellow scan brackets in a layer next to the video, placed relative to the nearest
  // positioned parent: this frame, so they always sit on the video wherever the scanner is shown.
  return (
    <div className="scanner-frame">
      <video ref={video} className="scanner" muted playsInline />
    </div>
  )
}
