import { Link } from 'react-router-dom'

import { dateOnly, money } from '@/utils/format'

import type { Organisation } from '../types'

type MembershipPanelProps = {
  organisation: Organisation
  /** Shown as a button unless the person is already choosing a membership. */
  onChangeMembership?: () => void
}

/** The signed-in member's card: their membership and credit here. */
export function MembershipPanel({ organisation, onChangeMembership }: MembershipPanelProps) {
  const { slug, membership } = organisation
  if (!membership) return null

  return (
    <section className="panel membership">
      <div className="spread">
        <div>
          <span className="label">Membership</span>
          <strong>{membership.tier}</strong>
          {membership.expiresAt && (
            <p className={membership.active ? 'muted' : 'bad'}>
              {membership.active ? 'Valid until' : 'Expired on'} {dateOnly(membership.expiresAt)}
            </p>
          )}
        </div>
        <Link to={`/${slug}/wallet`} className="balance">
          <span className="label">Credit</span>
          <strong>{money(organisation.balanceCents ?? 0)}</strong>
        </Link>
      </div>
      <div className="row wrap">
        <Link className="btn primary" to={`/${slug}/wallet`}>
          Top up
        </Link>
        {onChangeMembership && membership.active && (
          <button className="btn" onClick={onChangeMembership}>
            Change membership
          </button>
        )}
      </div>
    </section>
  )
}
