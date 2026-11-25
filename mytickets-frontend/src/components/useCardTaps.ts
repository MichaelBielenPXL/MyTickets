import { useEffect, useRef, useState } from 'react'

import { t } from '@/lib/i18n'
import { listenForCards, nfcSupported } from '@/lib/nfc'

// A card held against the phone is read many times a second; act on it once.
const SAME_CARD_PAUSE_MS = 2500

/**
 * Listens for cards held to the phone (Chrome on Android) once `start` is called from a button press,
 * and keeps listening until the component goes away, so staff can serve one guest after another.
 * Taps are ignored while `ignore` is true, for example while the last one is still being handled.
 */
export function useCardTaps(onCard: (uid: string) => void, ignore = false) {
  const [listening, setListening] = useState(false)
  const [problem, setProblem] = useState('')
  // The reader outlives renders, so it reads the latest values through a ref.
  const latest = useRef({ onCard, ignore })
  const stop = useRef<AbortController | null>(null)
  const lastRead = useRef({ uid: '', at: 0 })

  useEffect(() => {
    latest.current = { onCard, ignore }
  })

  useEffect(() => () => stop.current?.abort(), [])

  function handleTap(uid: string) {
    const now = Date.now()
    const repeat = uid === lastRead.current.uid && now - lastRead.current.at < SAME_CARD_PAUSE_MS
    if (latest.current.ignore || repeat) return
    lastRead.current = { uid, at: now }
    navigator.vibrate?.(60)
    latest.current.onCard(uid)
  }

  async function start() {
    setProblem('')
    stop.current?.abort()
    stop.current = new AbortController()
    try {
      await listenForCards(stop.current.signal, handleTap, () =>
        setProblem("Couldn't read that card. Hold it still against the back of the phone."),
      )
      setListening(true)
    } catch {
      setProblem(t("The card reader could not start. Allow NFC for this site, or scan the card's QR code."))
    }
  }

  return { supported: nfcSupported, listening, problem, start }
}
