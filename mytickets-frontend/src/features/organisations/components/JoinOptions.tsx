import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { t } from '@/lib/i18n'
import type { Tier } from '@/types'

import type { Organisation } from '../types'
import { TierChoice } from './TierChoice'

type JoinOptionsProps = {
  organisation: Organisation
}

/**
 * The membership types someone can pick, plus the invite-code box for the hidden ones. Picking one goes
 * to the details form (the organisation's questions), which then starts, charges or requests it.
 */
export function JoinOptions({ organisation }: JoinOptionsProps) {
  const [inviteCode, setInviteCode] = useState('')
  const navigate = useNavigate()
  const { membership } = organisation
  const heading = !membership
    ? t('Join to buy tickets')
    : membership.active
      ? t('Change membership')
      : t('Renew your membership')

  function choose(query: string) {
    navigate(`/${organisation.slug}/join?${query}`)
  }

  function submitInviteCode(event: FormEvent) {
    event.preventDefault()
    choose(`code=${encodeURIComponent(inviteCode.trim())}`)
  }

  function buttonLabel(tier: Tier) {
    if (!membership) return t('Join')
    if (membership.tierId !== tier.id) return t('Switch')
    // Ran out, and the organisation set a new end date: buying it again makes sense.
    return membership.active ? t('Current') : t('Renew')
  }

  return (
    <section className="tier-picker">
      <h2>{heading}</h2>
      <div className="list">
        {organisation.tiers.map((tier) => (
          <TierChoice
            key={tier.id}
            tier={tier}
            action={tier.isPublic ? buttonLabel(tier) : null}
            disabled={buttonLabel(tier) === 'Current'}
            onChoose={() => choose(`tier=${tier.id}`)}
          />
        ))}
      </div>
      {organisation.hasInviteOnlyTiers && (
        <form onSubmit={submitInviteCode} className="row invite">
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder={t('Have an invite code?')}
            aria-label={t('Invite code')}
          />
          <button className="btn" disabled={!inviteCode.trim()}>
            {t('Use code')}
          </button>
        </form>
      )}
    </section>
  )
}
