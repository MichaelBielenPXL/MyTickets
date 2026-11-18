import { type FormEvent, type ReactNode, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ErrorNote, Field, QueryResult } from '@/components'
import { useMe } from '@/features/auth'
import { BRAND_PRESETS, MemberCard, brandStyle, isBrandColor } from '@/features/organisations'

import { useOrganisationSettings, useUpdateOrganisation } from '../api/admin'
import type { OrganisationSettings, StoredImage } from '../types'
import { ImageField } from './ImageField'
import { MemberFieldsPanel } from './MemberFieldsPanel'

type SettingsTabProps = {
  slug: string
}

export function SettingsTab({ slug }: SettingsTabProps) {
  const settings = useOrganisationSettings(slug)
  // Lives here, not in the form, so "Saved." survives the form starting over with the new values.
  const update = useUpdateOrganisation(slug)

  return (
    <div className="stack">
      <QueryResult query={settings}>
        {/* Keyed on the saved values so the form starts over from what the server has after a save. */}
        {(saved) => <SettingsForm key={JSON.stringify(saved)} slug={slug} saved={saved} update={update} />}
      </QueryResult>
      <MemberFieldsPanel slug={slug} />
    </div>
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
  const [brandColor, setBrandColor] = useState(saved.brandColor ?? '')
  const navigate = useNavigate()
  const displayName = useMe().data?.displayName ?? 'Your name'

  const colorToSave = brandColor === '' ? null : brandColor.toLowerCase()
  const changed =
    name !== saved.name ||
    description !== saved.description ||
    (logo?.key ?? null) !== saved.logoKey ||
    colorToSave !== (saved.brandColor ?? null)

  function submit(event: FormEvent) {
    event.preventDefault()
    update.mutate(
      { name, description, logoKey: logo?.key ?? null, brandColor: colorToSave },
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
      <BrandColorField
        value={brandColor}
        onChange={setBrandColor}
        preview={
          <MemberCard
            organisationName={name || saved.name}
            logoUrl={logo?.url ?? null}
            memberName={displayName}
            tier="Member"
            expiresAt={null}
            active
            balanceCents={4400}
            cardUid={null}
          />
        }
      />
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

type BrandColorFieldProps = {
  /** "#rrggbb", or "" for the house colour. */
  value: string
  onChange: (color: string) => void
  preview: ReactNode
}

/** The organisation's own colour, with its member card beside it so the choice is made by eye. */
function BrandColorField({ value, onChange, preview }: BrandColorFieldProps) {
  const [typed, setTyped] = useState(value)
  const shown = isBrandColor(value) ? value.toLowerCase() : null

  function choose(color: string) {
    setTyped(color)
    onChange(color)
  }

  return (
    <fieldset className="brand-color-field">
      <legend>Colour</legend>
      <p className="muted">Fills your members&apos; cards and accents your pages. Match it to your crest.</p>
      <div className="brand-color-layout">
        <div className="stack">
          <div className="swatches" role="radiogroup" aria-label="Ready-made colours">
            {BRAND_PRESETS.map((color) => (
              <label key={color} className="swatch" style={{ background: color }} title={color}>
                <input
                  type="radio"
                  name="brand-colour"
                  value={color}
                  checked={shown === color}
                  onChange={() => choose(color)}
                  aria-label={color}
                />
              </label>
            ))}
          </div>
          <div className="brand-color-custom">
            <input
              type="color"
              aria-label="Pick any colour"
              value={shown ?? '#1c1c1e'}
              onChange={(e) => choose(e.target.value)}
            />
            <input
              aria-label="Colour code"
              placeholder="#1c1c1e"
              value={typed}
              maxLength={7}
              spellCheck={false}
              onChange={(e) => {
                const text = e.target.value.trim()
                setTyped(text)
                // Only a whole colour code changes the colour; half-typed codes wait.
                if (text === '' || isBrandColor(text)) onChange(text)
              }}
            />
            {value !== '' && (
              <button type="button" className="btn link" onClick={() => choose('')}>
                Use the default
              </button>
            )}
          </div>
        </div>
        <div className="brand-color-preview organisation-page" style={brandStyle(shown)} aria-hidden="true">
          {preview}
        </div>
      </div>
    </fieldset>
  )
}
