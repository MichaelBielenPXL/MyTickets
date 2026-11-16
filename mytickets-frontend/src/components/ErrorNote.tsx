import type { ReactNode } from 'react'

import { errorText } from '@/utils/format'

type ErrorNoteProps = {
  /** Text to show, or an error straight from a query or mutation. Renders nothing when empty. */
  children?: ReactNode
  error?: unknown
}

export function ErrorNote({ children, error }: ErrorNoteProps) {
  const message = children || (error ? errorText(error) : null)
  if (!message) return null
  return (
    <p className="note error" role="alert">
      {message}
    </p>
  )
}
