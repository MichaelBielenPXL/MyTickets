import { useEffect } from 'react'

/** Asks the device not to dim or lock the screen while `on`. Quietly does nothing where that isn't possible. */
export function useKeepAwake(on: boolean) {
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
