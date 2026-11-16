import { type FormEvent, useState } from 'react'

import { ErrorNote, Field } from '@/components'
import { euroInput, fromLocalInput, requireEuro, requireWholeNumber, toLocalInput } from '@/utils/format'

import { useSaveTicketType } from '../api/admin'
import type { AdminTicketType, AdminTier } from '../types'

type TicketTypeFormProps = {
  slug: string
  eventId: string
  /** The ticket to edit, or null to add one. */
  ticketType: AdminTicketType | null
  /** Membership types that can be ticked under "Who can buy?". */
  tiers: AdminTier[]
  onDone: () => void
}

export function TicketTypeForm({ slug, eventId, ticketType, tiers, onDone }: TicketTypeFormProps) {
  const [name, setName] = useState(ticketType?.name ?? '')
  const [price, setPrice] = useState(euroInput(ticketType?.priceCents ?? 0))
  const [capacity, setCapacity] = useState(String(ticketType?.capacity ?? 100))
  const [maxPerUser, setMaxPerUser] = useState(String(ticketType?.maxPerUser ?? 4))
  const [salesStartAt, setSalesStartAt] = useState(toLocalInput(ticketType?.salesStartAt ?? null))
  const [salesEndAt, setSalesEndAt] = useState(toLocalInput(ticketType?.salesEndAt ?? null))
  const [allowedTierIds, setAllowedTierIds] = useState<string[]>(ticketType?.allowedTierIds ?? [])
  const [problem, setProblem] = useState('')
  const save = useSaveTicketType(slug, eventId)

  const openTiers = tiers.filter((tier) => !tier.archived)

  function toggleTier(id: string) {
    setAllowedTierIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    setProblem('')
    try {
      const input = {
        name,
        priceCents: requireEuro(price),
        capacity: requireWholeNumber(capacity, 'the number of tickets'),
        maxPerUser: requireWholeNumber(maxPerUser, 'tickets per person'),
        salesStartAt: fromLocalInput(salesStartAt),
        salesEndAt: fromLocalInput(salesEndAt),
        allowedTierIds,
      }
      save.mutate({ id: ticketType?.id, ticketType: input }, { onSuccess: onDone })
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Check the form.')
    }
  }

  return (
    <form onSubmit={submit} className="stack sub-form">
      <div className="grid-2">
        <Field label="Ticket name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Regular"
            required
            maxLength={80}
          />
        </Field>
        <Field label="Price in euro" hint="0 for free">
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="How many tickets" hint={ticketType ? `${ticketType.sold} sold so far` : undefined}>
          <input inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </Field>
        <Field label="Most per person">
          <input inputMode="numeric" value={maxPerUser} onChange={(e) => setMaxPerUser(e.target.value)} />
        </Field>
        <Field label="Sales open (optional)">
          <input
            type="datetime-local"
            value={salesStartAt}
            onChange={(e) => setSalesStartAt(e.target.value)}
          />
        </Field>
        <Field label="Sales close (optional)">
          <input type="datetime-local" value={salesEndAt} onChange={(e) => setSalesEndAt(e.target.value)} />
        </Field>
      </div>
      {openTiers.length > 1 && (
        <fieldset>
          <legend>Who can buy? Leave all unticked for everyone.</legend>
          {openTiers.map((tier) => (
            <label key={tier.id} className="check">
              <input
                type="checkbox"
                checked={allowedTierIds.includes(tier.id)}
                onChange={() => toggleTier(tier.id)}
              />
              {tier.name}
            </label>
          ))}
        </fieldset>
      )}
      <ErrorNote>{problem}</ErrorNote>
      <ErrorNote error={save.error} />
      <div className="row">
        <button className="btn primary" disabled={save.isPending}>
          Save ticket
        </button>
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  )
}
