import { type FormEvent, useId, useState } from 'react'

import { ErrorNote } from '@/components'
import { t } from '@/lib/i18n'

import { useCopyDetails, useCopySources } from '../api/organisations'
import type { ProfileValues } from '../types'

type CopyDetailsProps = {
  slug: string
  /** The details brought over, and where from; the form is filled with them, not saved. */
  onCopied: (values: ProfileValues, from: string) => void
}

/**
 * "Transfer my details from [Moonlight Society]": for someone who gave their details at another organisation they are
 * in. The first one they joined is chosen to start with. Nothing shows when there is none. Transferring only fills
 * the form; the person checks it and saves.
 */
export function CopyDetails({ slug, onCopied }: CopyDetailsProps) {
  const sources = useCopySources(slug)
  const copy = useCopyDetails(slug)
  const [chosenSlug, setChosenSlug] = useState<string | null>(null)
  const selectId = useId()
  if (!sources.data?.length) return null

  const chosen = sources.data.find((s) => s.slug === chosenSlug) ?? sources.data[0]

  function submit(event: FormEvent) {
    event.preventDefault()
    copy.mutate(chosen.slug, { onSuccess: (values) => onCopied(values, chosen.name) })
  }

  return (
    <form className="copy-details" onSubmit={submit} aria-label={t('Transfer my details')}>
      <p className="muted">
        {t(
          'Already a member somewhere else? Bring over your name, address, phone number and other details you gave there.',
        )}
      </p>
      <div className="copy-details-row">
        <label htmlFor={selectId}>{t('Transfer my details from')}</label>
        <select
          id={selectId}
          value={chosen.slug}
          onChange={(e) => {
            setChosenSlug(e.target.value)
            copy.reset()
          }}
        >
          {sources.data.map((source) => (
            <option key={source.slug} value={source.slug}>
              {source.name}
            </option>
          ))}
        </select>
      </div>
      <ErrorNote error={copy.error} />
      <button type="submit" className="btn small" disabled={copy.isPending}>
        {copy.isPending ? t('One moment…') : t('Transfer')}
      </button>
    </form>
  )
}
