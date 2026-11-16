import { type RefObject, useEffect } from 'react'

/** Closes a menu when the person clicks outside it or presses Escape. */
export function useDismiss(container: RefObject<HTMLElement | null>, open: boolean, onDismiss: () => void) {
  useEffect(() => {
    if (!open) return

    function handlePointer(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) onDismiss()
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss()
    }

    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [container, open, onDismiss])
}
