import { type PointerEvent, useRef } from 'react'

import { lastValidDay, tokenAmount } from '@/utils/format'

import { OrganisationAvatar } from './OrganisationAvatar'

type MemberCardProps = {
  organisationName: string
  logoUrl: string | null
  memberName: string
  tier: string
  expiresAt: string | null
  active: boolean
  balanceCents: number
  /** The serial of the card or wristband that pays with this wallet, if one is linked. */
  cardUid: string | null
}

/**
 * The member's pass, in the organisation's colour: who they are, their membership and their tokens.
 * It leans towards the pointer and catches the light, like a card held in the hand.
 */
export function MemberCard(props: MemberCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  function lean(event: PointerEvent<HTMLDivElement>) {
    const card = ref.current
    if (!card || event.pointerType === 'touch' || prefersStillness()) return
    const box = card.getBoundingClientRect()
    const x = (event.clientX - box.left) / box.width
    const y = (event.clientY - box.top) / box.height
    card.style.setProperty('--tilt-x', `${(0.5 - y) * 7}deg`)
    card.style.setProperty('--tilt-y', `${(x - 0.5) * 9}deg`)
    card.style.setProperty('--light-x', `${x * 100}%`)
    card.style.setProperty('--light-y', `${y * 100}%`)
    card.dataset.leaning = 'true'
  }

  function settle() {
    const card = ref.current
    if (!card) return
    for (const name of ['--tilt-x', '--tilt-y', '--light-x', '--light-y']) card.style.removeProperty(name)
    delete card.dataset.leaning
  }

  const { organisationName, logoUrl, memberName, tier, expiresAt, active, balanceCents, cardUid } = props

  return (
    <div className="member-card-stage" onPointerMove={lean} onPointerLeave={settle}>
      <div
        ref={ref}
        className={active ? 'member-card' : 'member-card expired'}
        role="group"
        aria-label={`${organisationName} membership card`}
      >
        <div className="member-card-top">
          <span className="member-card-logo">
            <OrganisationAvatar name={organisationName} logoUrl={logoUrl} size={40} />
          </span>
          <span className="member-card-org">
            <strong>{organisationName}</strong>
            <span>{tier}</span>
          </span>
          <ContactlessMark />
        </div>

        <p className="member-card-name">{memberName}</p>

        <dl className="member-card-facts">
          <div className="member-card-balance">
            <dt>Tokens</dt>
            <dd>{tokenAmount(balanceCents)}</dd>
          </div>
          <div>
            <dt>{active ? 'Valid until' : 'Expired'}</dt>
            <dd>{expiresAt ? lastValidDay(expiresAt) : 'No end date'}</dd>
          </div>
          {cardUid && (
            <div>
              <dt>Card</dt>
              <dd>•••• {cardUid.slice(-4)}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}

function prefersStillness() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** The contactless waves: this pass works with a tap of the linked card at the door and the bar. */
function ContactlessMark() {
  return (
    <svg className="member-card-contactless" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.5 8.2a5.5 5.5 0 0 1 0 7.6" />
      <path d="M12 5.6a9.5 9.5 0 0 1 0 12.8" />
      <path d="M15.5 3a13.5 13.5 0 0 1 0 18" />
    </svg>
  )
}
