import type { ReactNode } from 'react'

type FieldProps = {
  label: string
  hint?: string
  /** The input, select or textarea this label belongs to. */
  children: ReactNode
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}
