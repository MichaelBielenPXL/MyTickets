import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ErrorNote, Field, QueryResult } from '@/components'

import { useOrganisationSettings, useUpdateOrganisation } from '../api/admin'
import type { OrganisationSettings, StoredImage } from '../types'
import { ImageField } from './ImageField'

type SettingsTabProps = {
  slug: string
}

export function SettingsTab({ slug }: SettingsTabProps) {
  const settings = useOrganisationSettings(slug)
  // Lives here, not in the form, so "Saved." survives the form starting over with the new values.
  const update = useUpdateOrganisation(slug)

  return (
    <QueryResult query={settings}>
      {/* Keyed on the saved values so the form starts over from what the server has after a save. */}
      {(saved) => <SettingsForm key={JSON.stringify(saved)} slug={slug} saved={saved} update={update} />}
    </QueryResult>
  )
}

type SettingsFormProps = {
  slug: string
  saved: OrganisationSettings
  update: ReturnType<typeof useUpdateOrganisation>
}

function SettingsForm({ slug, saved, update }: SettingsFormProps) {
  const [name, setName] = useState(saved.name)
  const [description, setDescription] = useState(saved.description)
  const [logo, setLogo] = useState<StoredImage | null>(
    saved.logoKey && saved.logoUrl ? { key: saved.logoKey, url: saved.logoUrl } : null,
  )
  const navigate = useNavigate()

  const changed =
    name !== saved.name || description !== saved.description || (logo?.key ?? null) !== saved.logoKey

  function submit(event: FormEvent) {
    event.preventDefault()
    update.mutate(
      { name, description, logoKey: logo?.key ?? null },
      {
        // The page lives at the organisation's name, so after a rename carry on at the new address.
        onSuccess: (result) => {
          if (result.slug !== slug) navigate(`/${result.slug}/admin`, { replace: true })
        },
      },
    )
  }

  return (
    <form onSubmit={submit} className="panel stack settings-form">
      <ImageField
        slug={slug}
        label="Logo"
        hint="Shown next to your organisation's name. Square, PNG, JPEG or WebP, up to 4 MB."
        shape="square"
        value={logo}
        onChange={setLogo}
      />
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} />
      </Field>
      <Field label="Description" hint="A line or two about who you are. Shown on your public page.">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={500}
        />
      </Field>
      <ErrorNote error={update.error} />
      <div className="row">
        <button className="btn primary" disabled={update.isPending || !changed}>
          {update.isPending ? 'Saving…' : 'Save changes'}
        </button>
        {update.isSuccess && !changed && (
          <span className="muted" role="status">
            Saved.
          </span>
        )}
      </div>
    </form>
  )
}
