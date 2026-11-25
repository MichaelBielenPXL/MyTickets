import { useCallback, useEffect, useState } from 'react'

/** Safari on iPad still only knows the prefixed names. */
type WebkitDocument = Document & {
  webkitFullscreenEnabled?: boolean
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
}
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }

const doc = () => document as WebkitDocument
const fullscreenElement = () => doc().fullscreenElement ?? doc().webkitFullscreenElement ?? null

/**
 * The whole page in fullscreen, for a till: no browser bars, and the screen kept awake while it lasts. `supported` is
 * false where browsers can't (an iPhone), so the button can be left out there. Leaving fullscreen with the browser's
 * own gesture or Escape is followed too.
 */
export function useFullscreen() {
  const supported =
    typeof document !== 'undefined' && Boolean(doc().fullscreenEnabled ?? doc().webkitFullscreenEnabled)
  const [active, setActive] = useState(() => supported && fullscreenElement() !== null)

  useEffect(() => {
    if (!supported) return
    const changed = () => setActive(fullscreenElement() !== null)
    document.addEventListener('fullscreenchange', changed)
    document.addEventListener('webkitfullscreenchange', changed)
    return () => {
      document.removeEventListener('fullscreenchange', changed)
      document.removeEventListener('webkitfullscreenchange', changed)
    }
  }, [supported])

  useKeepAwake(active)

  const toggle = useCallback(async () => {
    try {
      if (fullscreenElement()) await (document.exitFullscreen?.() ?? doc().webkitExitFullscreen?.())
      else {
        const root = document.documentElement as WebkitElement
        await (root.requestFullscreen?.() ?? root.webkitRequestFullscreen?.())
      }
    } catch {
      /* refused (not started by a tap, or a browser setting): the page simply stays as it is */
    }
  }, [])

  return { supported, active, toggle }
}

/** Asks the device not to dim or lock the screen while `on`. Quietly does nothing where that isn't possible. */
function useKeepAwake(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let stopped = false
    async function take() {
      try {
        const taken = await navigator.wakeLock.request('screen')
        if (stopped) await taken.release()
        else lock = taken
      } catch {
        /* not allowed right now (battery saver, page hidden): the screen may dim as usual */
      }
    }
    void take()
    // The lock is let go when the page is hidden; take it again on coming back.
    function visible() {
      if (document.visibilityState === 'visible') void take()
    }
    document.addEventListener('visibilitychange', visible)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', visible)
      void lock?.release().catch(() => {})
    }
  }, [on])
}
