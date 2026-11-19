import { type FormEvent, useState } from 'react'

import { ErrorNote, Field } from '@/components'
import { t } from '@/lib/i18n'
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
  const [endsOn, setEndsOn] = useState(tier?.endsOn ?? '')
  const [isPublic, setIsPublic] = useState(tier?.isPublic ?? true)
  const [inviteCode, setInviteCode] = useState(tier?.inviteCode ?? '')
  const [ticketDiscount, setTicketDiscount] = useState(String(tier?.ticketDiscountPercent ?? 0))
  const [drinkDiscount, setDrinkDiscount] = useState(String(tier?.drinkDiscountPercent ?? 0))
  const [archived, setArchived] = useState(tier?.archived ?? false)
  const [requiresApproval, setRequiresApproval] = useState(tier?.requiresApproval ?? false)
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
        endsOn: endsOn || null,
        isPublic,
        inviteCode: isPublic ? null : inviteCode,
        ticketDiscountPercent: requireWholeNumber(ticketDiscount, t('the ticket discount')),
        drinkDiscountPercent: requireWholeNumber(drinkDiscount, t('the bar discount')),
        archived,
        requiresApproval,
      }
      save.mutate({ id: tier?.id, tier: input }, { onSuccess: onDone })
    } catch (error) {
      setProblem(error instanceof Error ? error.message : t('Check the form.'))
    }
  }

  return (
    <form onSubmit={submit} className="panel stack">
      <h2>{tier ? t('Edit membership type') : t('New membership type')}</h2>
      <Field label={t('Name')}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('Student')}
          required
          maxLength={80}
        />
      </Field>
      <Field label={t('Description')}>
        <input value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="grid-2">
        <Field label={t('Price in euro')} hint={t('0 for free')}>
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field
          label={t('Ends on')}
          hint={t("The last day it's valid, for everyone on it. Leave empty for no end date.")}
        >
          <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
        </Field>
        <Field label={t('Discount on tickets (%)')}>
          <input
            inputMode="numeric"
            value={ticketDiscount}
            onChange={(e) => setTicketDiscount(e.target.value)}
          />
        </Field>
        <Field label={t('Discount at the bar (%)')}>
          <input
            inputMode="numeric"
            value={drinkDiscount}
            onChange={(e) => setDrinkDiscount(e.target.value)}
          />
        </Field>
      </div>
      <label className="check">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        {t('Anyone can join this')}
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={requiresApproval}
          onChange={(e) => setRequiresApproval(e.target.checked)}
        />
        {t('Needs approval: an admin checks each request first (paid ones are paid after approval)')}
      </label>
      {!isPublic && (
        <Field
          label={t('Invite code')}
          hint={t('People enter this to join. Leave empty and one is made for you.')}
        >
          <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} maxLength={40} />
        </Field>
      )}
      {tier && (
        <label className="check">
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
          {t('Closed: nobody new can join (current members keep it)')}
        </label>
      )}
      <ErrorNote>{problem}</ErrorNote>
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
