import { type FormEvent, useState } from 'react'

import { ErrorNote, QueryResult } from '@/components'
import type { FieldMode, ProfileFieldName } from '@/features/organisations'

import { useMemberFields, useSaveMemberFields } from '../api/admin'

const FIELDS: [ProfileFieldName, string][] = [
  ['phone', 'Phone'],
  ['address', 'Address'],
  ['school', 'School'],
  ['faculty', 'Faculty'],
  ['studyYear', 'Year'],
]

const MODES: [FieldMode, string][] = [
  ['Off', 'Not asked'],
  ['Optional', 'Optional'],
  ['Required', 'Required'],
]

/** Which details people are asked when they choose a membership. First and last name are always asked. */
export function MemberFieldsPanel({ slug }: { slug: string }) {
  const fields = useMemberFields(slug)
  // Lives here, not in the form, so "Saved." survives the form starting over with the new values.
  const save = useSaveMemberFields(slug)
  return (
    <QueryResult query={fields}>
      {(saved) => <MemberFieldsForm key={JSON.stringify(saved)} saved={saved} save={save} />}
    </QueryResult>
  )
}

type MemberFieldsFormProps = {
  saved: Record<ProfileFieldName, FieldMode>
  save: ReturnType<typeof useSaveMemberFields>
}

function MemberFieldsForm({ saved, save }: MemberFieldsFormProps) {
  const [modes, setModes] = useState(saved)
  const changed = JSON.stringify(modes) !== JSON.stringify(saved)

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate(modes)
  }

  return (
    <form onSubmit={submit} className="panel stack settings-form">
      <div>
        <h3 className="panel-title">Information asked from members</h3>
        <p className="muted">
          Asked when someone chooses a membership. First and last name are always asked.
        </p>
      </div>
      <div className="field-modes">
        {FIELDS.map(([field, label]) => (
          <label key={field} className="field-mode">
            <span>{label}</span>
            <select
              value={modes[field]}
              onChange={(e) => setModes({ ...modes, [field]: e.target.value as FieldMode })}
            >
              {MODES.map(([mode, text]) => (
                <option key={mode} value={mode}>
                  {text}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <ErrorNote error={save.error} />
      <div className="row">
        <button className="btn primary" disabled={save.isPending || !changed}>
          Save
        </button>
        {save.isSuccess && !changed && (
          <span className="muted" role="status">
            Saved.
          </span>
        )}
      </div>
    </form>
  )
}
