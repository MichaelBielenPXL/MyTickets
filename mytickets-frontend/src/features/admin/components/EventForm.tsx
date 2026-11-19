import { type FormEvent, useState } from 'react'

import { ErrorNote, Field } from '@/components'
import { t } from '@/lib/i18n'
import { fromLocalInput, toLocalInput } from '@/utils/format'

import { useSaveEvent } from '../api/admin'
import type { AdminEvent, StoredImage } from '../types'
import { ImageField } from './ImageField'

type EventFormProps = {
  slug: string
  /** The event to edit, or null to create one. */
  event: AdminEvent | null
  onDone: () => void
}

export function EventForm({ slug, event, onDone }: EventFormProps) {
  const [name, setName] = useState(event?.name ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [startsAt, setStartsAt] = useState(toLocalInput(event?.startsAt ?? null))
  const [endsAt, setEndsAt] = useState(toLocalInput(event?.endsAt ?? null))
  const [published, setPublished] = useState(event?.published ?? false)
  const [image, setImage] = useState<StoredImage | null>(
    event?.imageKey && event.imageUrl ? { key: event.imageKey, url: event.imageUrl } : null,
  )
  const save = useSaveEvent(slug)

  function submit(submitEvent: FormEvent) {
    submitEvent.preventDefault()
    const input = {
      name,
      description,
      location,
      startsAt: fromLocalInput(startsAt),
      endsAt: fromLocalInput(endsAt),
      published,
      imageKey: image?.key ?? null,
    }
    save.mutate({ id: event?.id, event: input }, { onSuccess: onDone })
  }

  return (
    <form onSubmit={submit} className="panel stack">
      <h2>{event ? t('Edit event') : t('New event')}</h2>
      <Field label={t('Name')}>
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
      </Field>
      <Field label={t('Description')}>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </Field>
      <ImageField
        slug={slug}
        label={t('Picture')}
        hint={t('Shown at the top of the event page. A wide picture works best.')}
        shape="wide"
        value={image}
        onChange={setImage}
      />
      <Field label={t('Location')}>
        <input value={location} onChange={(e) => setLocation(e.target.value)} />
      </Field>
      <div className="grid-2">
        <Field label={t('Starts')}>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
        </Field>
        <Field label={t('Ends (optional)')}>
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </Field>
      </div>
      <label className="check">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        {t('Published: members can see it and buy tickets')}
      </label>
      <ErrorNote error={save.error} />
      <div className="row">
        <button className="btn primary" disabled={save.isPending}>
          {t('Save')}
        </button>
        <button type="button" className="btn" onClick={onDone}>
          {t('Cancel')}
        </button>
      </div>
    </form>
  )
}
