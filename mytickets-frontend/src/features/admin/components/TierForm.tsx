import { type FormEvent, useState } from 'react'

import { ErrorNote, Field } from '@/components'
import { euroInput, requireEuro, requireWholeNumber } from '@/utils/format'

import { useSaveTier } from '../api/admin'
import type { AdminTier } from '../types'

type TierFormProps = {
  slug: string
  /** The membership type to edit, or null to create one. */
  tier: AdminTier | null
  onDone: () => void
}

export function TierForm({ slug, tier, onDone }: TierFormProps) {
  const [name, setName] = useState(tier?.name ?? '')
  const [description, setDescription] = useState(tier?.description ?? '')
  const [price, setPrice] = useState(euroInput(tier?.priceCents ?? 0))
  const [durationDays, setDurationDays] = useState(tier?.durationDays ? String(tier.durationDays) : '')
  const [isPublic, setIsPublic] = useState(tier?.isPublic ?? true)
  const [inviteCode, setInviteCode] = useState(tier?.inviteCode ?? '')
  const [ticketDiscount, setTicketDiscount] = useState(String(tier?.ticketDiscountPercent ?? 0))
  const [drinkDiscount, setDrinkDiscount] = useState(String(tier?.drinkDiscountPercent ?? 0))
  const [archived, setArchived] = useState(tier?.archived ?? false)
  const [problem, setProblem] = useState('')
  const save = useSaveTier(slug)

  function submit(event: FormEvent) {
    event.preventDefault()
    setProblem('')
    try {
      const input = {
        name,
        description,
        priceCents: requireEuro(price),
        durationDays: durationDays.trim() ? requireWholeNumber(durationDays, 'the number of days') : null,
        isPublic,
        inviteCode: isPublic ? null : inviteCode,
        ticketDiscountPercent: requireWholeNumber(ticketDiscount, 'the ticket discount'),
        drinkDiscountPercent: requireWholeNumber(drinkDiscount, 'the bar discount'),
        archived,
      }
      save.mutate({ id: tier?.id, tier: input }, { onSuccess: onDone })
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Check the form.')
    }
  }

  return (
    <form onSubmit={submit} className="panel stack">
      <h2>{tier ? 'Edit membership type' : 'New membership type'}</h2>
      <Field label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Student"
          required
          maxLength={80}
        />
      </Field>
      <Field label="Description">
        <input value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="grid-2">
        <Field label="Price in euro" hint="0 for free">
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Lasts how many days" hint="Empty: never ends. 365: a year.">
          <input inputMode="numeric" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
        </Field>
        <Field label="Discount on tickets (%)">
          <input
            inputMode="numeric"
            value={ticketDiscount}
            onChange={(e) => setTicketDiscount(e.target.value)}
          />
        </Field>
        <Field label="Discount at the bar (%)">
          <input
            inputMode="numeric"
            value={drinkDiscount}
            onChange={(e) => setDrinkDiscount(e.target.value)}
          />
        </Field>
      </div>
      <label className="check">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        Anyone can join this
      </label>
      {!isPublic && (
        <Field label="Invite code" hint="People enter this to join. Leave empty and one is made for you.">
          <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} maxLength={40} />
        </Field>
      )}
      {tier && (
        <label className="check">
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
          Closed: nobody new can join (current members keep it)
        </label>
      )}
      <ErrorNote>{problem}</ErrorNote>
      <ErrorNote error={save.error} />
      <div className="row">
        <button className="btn primary" disabled={save.isPending}>
          Save
        </button>
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  )
}
