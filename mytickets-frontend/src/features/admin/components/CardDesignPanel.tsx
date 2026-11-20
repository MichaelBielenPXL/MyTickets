import { type FormEvent, useState } from 'react'

import { ErrorNote, Field } from '@/components'
import { t } from '@/lib/i18n'

import { useCardDesign, useOrganisationSettings, useSaveCardDesign } from '../api/admin'
import type { CardDesign, CardSide, OrganisationSettings } from '../types'
import { CardFace } from './CardFace'
import { ImageField } from './ImageField'
import { Segmented } from './Segmented'

type Side = 'front' | 'back'

const MAX_TAGLINE = 40
const HEX = /^#[0-9a-f]{6}$/i
/** What the preview's QR holds: the shape of a real card link. */
const SAMPLE_URL = 'https://mytickets.be/c/ABCDEFGHJK'

const SIDES: { value: Side; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
]
const BACKGROUNDS: { value: CardSide['background']; label: string }[] = [
  { value: 'brand', label: 'Brand colour' },
  { value: 'colour', label: 'Another colour' },
  { value: 'image', label: 'Picture' },
]

/**
 * Manage › Cards › Card design: how the front and the back of printed cards look, with a live preview at real
 * proportions. The back always carries the QR code, the card number and the name, in a fixed place.
 */
export function CardDesignPanel({ slug }: { slug: string }) {
  const design = useCardDesign(slug).data
  const settings = useOrganisationSettings(slug).data
  if (!design || !settings) return null
  return <DesignForm slug={slug} saved={design} settings={settings} />
}

function DesignForm({
  slug,
  saved,
  settings,
}: {
  slug: string
  saved: CardDesign
  settings: OrganisationSettings
}) {
  const [design, setDesign] = useState<CardDesign>(saved)
  const [editing, setEditing] = useState<Side>('front')
  const [problem, setProblem] = useState('')
  const save = useSaveCardDesign(slug)
  const side = design[editing]
  const change = (part: Partial<CardSide>) =>
    setDesign((now) => ({ ...now, [editing]: { ...now[editing], ...part } }))

  function submit(event: FormEvent) {
    event.preventDefault()
    for (const which of ['front', 'back'] as const) {
      const checked = design[which]
      const where = which === 'front' ? t('Front') : t('Back')
      if (checked.background === 'colour' && !HEX.test(checked.colour ?? '')) {
        setEditing(which)
        return setProblem(t('{side}: give the colour as a code like #0b3d2e.', { side: where }))
      }
      if (checked.background === 'image' && !checked.imageKey) {
        setEditing(which)
        return setProblem(t('{side}: upload a picture first.', { side: where }))
      }
    }
    setProblem('')
    save.mutate({ front: stored(design.front), back: stored(design.back) })
  }

  return (
    <form onSubmit={submit} className="panel stack card-design">
      <div>
        <h3>{t('Card design')}</h3>
        <p className="muted">
          {t(
            'Design the front and the back. The back always has the QR code, the card number and your name, in the same place, so it always scans.',
          )}
        </p>
      </div>

      <Segmented label={t('Side of the card')} options={SIDES} value={editing} onChange={setEditing} />
      <figure className="card-design-preview" aria-label={t('Card preview')}>
        <CardFace
          side={editing}
          design={side}
          organisationName={settings.name}
          logoUrl={settings.logoUrl}
          brandColor={settings.brandColor}
          number="0001"
          url={SAMPLE_URL}
        />
      </figure>

      <Segmented
        label={t('Background')}
        options={BACKGROUNDS}
        value={side.background}
        onChange={(background) =>
          change({
            background,
            colour: background === 'colour' ? (side.colour ?? settings.brandColor ?? '#1c1c1e') : side.colour,
          })
        }
      />
      {side.background === 'colour' && (
        <div className="row card-design-colour">
          <input
            type="color"
            value={HEX.test(side.colour ?? '') ? side.colour! : '#1c1c1e'}
            onChange={(e) => change({ colour: e.target.value })}
            aria-label={t('Pick a colour')}
          />
          <Field label={t('Colour code')}>
            <input
              value={side.colour ?? ''}
              onChange={(e) => change({ colour: e.target.value })}
              maxLength={7}
            />
          </Field>
        </div>
      )}
      {side.background === 'image' && (
        <ImageField
          key={editing}
          slug={slug}
          label={t('Picture')}
          hint={t(
            'Landscape, at least 1012 × 638 pixels. Text on it gets a soft shade so it stays readable.',
          )}
          shape="wide"
          value={side.imageKey && side.imageUrl ? { key: side.imageKey, url: side.imageUrl } : null}
          onChange={(picture) => change({ imageKey: picture?.key ?? null, imageUrl: picture?.url ?? null })}
        />
      )}

      <label className="check">
        <input
          type="checkbox"
          checked={side.showLogo}
          disabled={!settings.logoUrl}
          onChange={(e) => change({ showLogo: e.target.checked })}
        />
        {settings.logoUrl ? t('Show our logo') : t('Show our logo (add one under Settings first)')}
      </label>
      <Field
        label={t('Line on the card (optional)')}
        hint={t('Up to 40 characters, like "Member card 2026–2027".')}
      >
        <input
          value={side.tagline}
          maxLength={MAX_TAGLINE}
          onChange={(e) => change({ tagline: e.target.value })}
        />
      </Field>

      <ErrorNote>{problem}</ErrorNote>
      <ErrorNote error={save.error} />
      {save.isSuccess && !save.isPending && (
        <p className="note ok" role="status">
          {t('Saved.')}
        </p>
      )}
      <button className="btn primary" disabled={save.isPending}>
        {t('Save card design')}
      </button>
    </form>
  )
}

/** A side as the server keeps it: only what its background uses, and no picture address. */
function stored(side: CardSide): CardSide {
  return {
    background: side.background,
    colour: side.background === 'colour' ? side.colour : null,
    imageKey: side.background === 'image' ? side.imageKey : null,
    showLogo: side.showLogo,
    tagline: side.tagline.trim(),
  }
}
