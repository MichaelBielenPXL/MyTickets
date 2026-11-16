import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ErrorNote, Field } from '@/components'

import { useCreateOrganisation } from '../api/organisations'

type CreateOrganisationFormProps = {
  onCancel: () => void
}

export function CreateOrganisationForm({ onCancel }: CreateOrganisationFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const navigate = useNavigate()
  const create = useCreateOrganisation()

  function submit(event: FormEvent) {
    event.preventDefault()
    create.mutate({ name, description }, { onSuccess: ({ slug }) => navigate(`/${slug}/admin`) })
  }

  return (
    <form onSubmit={submit} className="stack panel">
      <h2>New organisation</h2>
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
      </Field>
      <Field label="Description">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </Field>
      <ErrorNote error={create.error} />
      <div className="row">
        <button className="btn primary" disabled={create.isPending}>
          Create
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
