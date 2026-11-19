import { type ChangeEvent, useId, useState } from 'react'

import { ErrorNote } from '@/components'
import { t } from '@/lib/i18n'

import { useUploadImage } from '../api/admin'
import type { StoredImage } from '../types'

type ImageFieldProps = {
  slug: string
  label: string
  hint?: string
  /** A logo is shown square, an event picture wide. */
  shape: 'square' | 'wide'
  value: StoredImage | null
  /** Called with the stored picture after an upload, or null when it is removed. */
  onChange: (image: StoredImage | null) => void
}

const MAX_BYTES = 4 * 1024 * 1024
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']

/** Picks a picture, uploads it straight away and shows it. The form it sits in saves which picture is used. */
export function ImageField({ slug, label, hint, shape, value, onChange }: ImageFieldProps) {
  const [problem, setProblem] = useState('')
  const inputId = useId()
  const upload = useUploadImage(slug)

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Let the same file be chosen again after a failed attempt.
    event.target.value = ''
    if (!file) return
    if (!ACCEPTED.includes(file.type)) return setProblem(t('Choose a PNG, JPEG or WebP picture.'))
    if (file.size > MAX_BYTES) return setProblem(t('That picture is larger than 4 MB. Choose a smaller one.'))
    setProblem('')
    upload.mutate(file, { onSuccess: onChange })
  }

  return (
    <div className="field">
      <span id={`${inputId}-label`}>{label}</span>
      <div className={`image-field ${shape}`}>
        {value ? (
          <img src={value.url} alt={t('Current {thing}', { thing: label.toLowerCase() })} />
        ) : (
          <div className="image-empty">{t('No picture')}</div>
        )}
        <div className="row wrap">
          <label className={upload.isPending ? 'btn small disabled' : 'btn small'} htmlFor={inputId}>
            {upload.isPending ? t('Uploading…') : value ? t('Replace') : t('Upload picture')}
          </label>
          <input
            id={inputId}
            className="visually-hidden"
            type="file"
            accept={ACCEPTED.join(',')}
            aria-labelledby={`${inputId}-label`}
            disabled={upload.isPending}
            onChange={choose}
          />
          {value && (
            <button type="button" className="btn small ghost" onClick={() => onChange(null)}>
              {t('Remove')}
            </button>
          )}
        </div>
      </div>
      {hint && <small>{hint}</small>}
      <ErrorNote>{problem}</ErrorNote>
      <ErrorNote error={upload.error} />
    </div>
  )
}
