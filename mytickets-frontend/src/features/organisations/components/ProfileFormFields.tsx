import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'

import { ErrorNote, Field } from '@/components'

import type { FieldMode, ProfileFieldName, ProfileForm, ProfileValues } from '../types'

type ProfileFormFieldsProps = {
  form: ProfileForm
  /** The button text: "Continue", "Save details". */
  submitLabel: string
  busy: boolean
  error: unknown
  onSubmit: (values: ProfileValues) => void
  /** Where "Cancel" goes, when the form is part of a step people may back out of. */
  cancelTo?: string
}

/** The details an organisation asks of its members: name always, the rest as the organisation chose. */
export function ProfileFormFields({
  form,
  submitLabel,
  busy,
  error,
  onSubmit,
  cancelTo,
}: ProfileFormFieldsProps) {
  const [values, setValues] = useState<ProfileValues>(form.profile)
  const mode = (field: ProfileFieldName): FieldMode => form.fields[field] ?? 'Optional'
  const set = (key: keyof ProfileValues) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))
  const value = (key: keyof ProfileValues) => values[key] ?? ''

  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit(values)
  }

  return (
    <form onSubmit={submit} className="stack profile-form">
      <div className="grid-2">
        <Field label="First name">
          <input
            value={value('firstName')}
            onChange={set('firstName')}
            autoComplete="given-name"
            required
            maxLength={80}
          />
        </Field>
        <Field label="Last name">
          <input
            value={value('lastName')}
            onChange={set('lastName')}
            autoComplete="family-name"
            required
            maxLength={80}
          />
        </Field>
      </div>

      {mode('phone') !== 'Off' && (
        <Field label={label('Phone', mode('phone'))}>
          <input
            type="tel"
            value={value('phone')}
            onChange={set('phone')}
            autoComplete="tel"
            placeholder="+32 470 12 34 56"
            required={mode('phone') === 'Required'}
          />
        </Field>
      )}

      {mode('address') !== 'Off' && (
        <fieldset className="stack">
          <legend>{label('Address', mode('address'))}</legend>
          <Field label="Street and number">
            <input
              value={value('street')}
              onChange={set('street')}
              autoComplete="street-address"
              required={mode('address') === 'Required'}
            />
          </Field>
          <div className="grid-2">
            <Field label="Postal code">
              <input
                value={value('postalCode')}
                onChange={set('postalCode')}
                autoComplete="postal-code"
                inputMode="numeric"
                required={mode('address') === 'Required'}
              />
            </Field>
            <Field label="City">
              <input
                value={value('city')}
                onChange={set('city')}
                autoComplete="address-level2"
                required={mode('address') === 'Required'}
              />
            </Field>
          </div>
        </fieldset>
      )}

      {(mode('school') !== 'Off' || mode('faculty') !== 'Off' || mode('studyYear') !== 'Off') && (
        <div className="grid-2">
          {mode('school') !== 'Off' && (
            <Field label={label('School', mode('school'))}>
              <input
                value={value('school')}
                onChange={set('school')}
                placeholder="UHasselt"
                required={mode('school') === 'Required'}
              />
            </Field>
          )}
          {mode('faculty') !== 'Off' && (
            <Field label={label('Faculty', mode('faculty'))}>
              <input
                value={value('faculty')}
                onChange={set('faculty')}
                placeholder="Rechten"
                required={mode('faculty') === 'Required'}
              />
            </Field>
          )}
          {mode('studyYear') !== 'Off' && (
            <Field label={label('Year', mode('studyYear'))}>
              <input
                value={value('studyYear')}
                onChange={set('studyYear')}
                placeholder="2nd bachelor"
                required={mode('studyYear') === 'Required'}
              />
            </Field>
          )}
        </div>
      )}

      <ErrorNote error={error} />
      <div className="form-actions">
        <button className="btn primary" disabled={busy}>
          {busy ? 'One moment…' : submitLabel}
        </button>
        {cancelTo && (
          <Link className="btn" to={cancelTo}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  )
}

/** Optional details say so; required ones are the norm and need no marker. */
function label(text: string, mode: FieldMode) {
  return mode === 'Optional' ? `${text} (optional)` : text
}
