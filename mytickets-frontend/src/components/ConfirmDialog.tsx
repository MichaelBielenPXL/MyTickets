import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message?: string
  confirmLabel: string
  /** Shows the confirm button in red, for things that can't be undone. */
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Asks before doing something that can't be undone, in the style of an iOS alert, instead of the
 * browser's confirm box. Cancel is focused first, so a stray Enter never deletes anything; Escape or a
 * tap outside cancels. Focus goes back to where it was afterwards.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  destructive,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()
  const messageId = useId()
  const cancel = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const latestCancel = useRef(onCancel)

  useEffect(() => {
    latestCancel.current = onCancel
  })

  useEffect(() => {
    if (!open) return
    const before = document.activeElement as HTMLElement | null
    cancel.current?.focus()
    const scroll = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') latestCancel.current()
      // Keep Tab inside the dialog.
      if (event.key === 'Tab' && dialog.current) {
        const buttons = dialog.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
        const first = buttons[0]
        const last = buttons[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = scroll
      before?.focus?.()
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="confirm-backdrop" onClick={() => !busy && onCancel()}>
      <div
        ref={dialog}
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-dialog-text">
          <h2 id={titleId}>{title}</h2>
          {message && <p id={messageId}>{message}</p>}
        </div>
        <div className="confirm-dialog-actions">
          <button ref={cancel} type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'One moment…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
