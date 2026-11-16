import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ErrorNote } from '@/components'
import type { Tier } from '@/types'

import { useJoinOrganisation } from '../api/organisations'
import type { JoinResult, Organisation } from '../types'
import { tierBenefits, tierTerms } from '../utils/tier-terms'

type JoinOptionsProps = {
  organisation: Organisation
  /** Called once the person is on their new membership without having to pay. */
  onJoined: () => void
  /** Present when the person already has a working membership and may back out. */
  onCancel?: () => void
}

/** The membership types someone can pick, plus the invite-code box for the hidden ones. */
export function JoinOptions({ organisation, onJoined, onCancel }: JoinOptionsProps) {
  const [inviteCode, setInviteCode] = useState('')
  const navigate = useNavigate()
  const join = useJoinOrganisation(organisation.slug)

  const { membership } = organisation
  const heading = !membership
    ? 'Join to buy tickets'
    : membership.active
      ? 'Change membership'
      : 'Renew your membership'

  function finish(result: JoinResult) {
    if (result.checkoutUrl) return navigate(result.checkoutUrl)
    setInviteCode('')
    onJoined()
  }

  function submitInviteCode(event: FormEvent) {
    event.preventDefault()
    join.mutate({ inviteCode: inviteCode.trim() }, { onSuccess: finish })
  }

  function buttonLabel(tier: Tier) {
    if (!membership) return 'Join'
    if (membership.tierId !== tier.id) return 'Switch'
    return tier.durationDays ? 'Renew' : 'Current'
  }

  return (
    <section>
      <h2>{heading}</h2>
      <div className="list">
        {organisation.tiers.map((tier) => (
          <div key={tier.id} className="list-item">
            <div>
              <strong>{tier.name}</strong> <span className="tag">{tierTerms(tier)}</span>
              {tier.description && <p className="muted">{tier.description}</p>}
              {tierBenefits(tier) && <p className="muted">{tierBenefits(tier)}</p>}
            </div>
            {tier.isPublic && (
              <button
                className="btn primary"
                disabled={join.isPending}
                onClick={() => join.mutate({ tierId: tier.id }, { onSuccess: finish })}
              >
                {buttonLabel(tier)}
              </button>
            )}
          </div>
        ))}
      </div>
      {organisation.hasInviteOnlyTiers && (
        <form onSubmit={submitInviteCode} className="row invite">
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Have an invite code?"
            aria-label="Invite code"
          />
          <button className="btn" disabled={join.isPending || !inviteCode.trim()}>
            Use code
          </button>
        </form>
      )}
      <ErrorNote error={join.error} />
      {onCancel && (
        <button className="btn link" onClick={onCancel}>
          Keep my current membership
        </button>
      )}
    </section>
  )
}
