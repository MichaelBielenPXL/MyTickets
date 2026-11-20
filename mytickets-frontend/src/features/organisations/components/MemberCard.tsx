import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { t } from '@/lib/i18n'
import { lastValidDay, tokenBalance } from '@/utils/format'

import { OrganisationAvatar } from './OrganisationAvatar'

type MemberCardProps = {
  organisationName: string
  logoUrl: string | null
  memberName: string
  tier: string
  expiresAt: string | null
  active: boolean
  /** The token balance, shown in a pill at the bottom. Left out on the home page. */
  balanceCents?: number
  /** The member's QR code and wallet buttons, shown in the middle of the card. */
  pass?: ReactNode
  /** Where the balance takes you to top up. Without it the balance is just shown. */
  topUpHref?: string
}

/**
 * The member's pass in the organisation's colour, the way a door person wants to see it: who, which
 * membership, until when, the QR code to scan, and the balance at the bottom.
 */
export function MemberCard(props: MemberCardProps) {
  const { organisationName, logoUrl, memberName, tier, expiresAt, active, balanceCents, pass, topUpHref } =
    props
  const balance =
    balanceCents === undefined ? null : t('Balance: {balance}', { balance: tokenBalance(balanceCents) })

  return (
    <div
      className={active ? 'member-card' : 'member-card expired'}
      role="group"
      aria-label={t('{org} membership card', { org: organisationName })}
    >
      <div className="member-card-top">
        <span className="member-card-logo">
          <OrganisationAvatar name={organisationName} logoUrl={logoUrl} size={44} />
        </span>
        <span className="member-card-org">
          <strong>{organisationName}</strong>
          <span>{/member/i.test(tier) ? tier : t('{tier} membership', { tier })}</span>
        </span>
      </div>

      <dl className="member-card-facts">
        <div>
          <dt>{t('Member')}</dt>
          <dd>{memberName}</dd>
        </div>
        <div>
          <dt>{t('Membership')}</dt>
          <dd>{tier}</dd>
        </div>
        <div>
          <dt>{active ? t('Valid until') : t('Expired')}</dt>
          <dd className="member-card-date">{expiresAt ? lastValidDay(expiresAt) : t('No end date')}</dd>
        </div>
      </dl>

      {pass}

      {balance && (
        <div className="member-card-foot">
          {topUpHref ? (
            <Link
              className="member-card-balance"
              to={topUpHref}
              aria-label={t('{balance}. Top up tokens', { balance })}
            >
              {balance}
              <PlusMark />
            </Link>
          ) : (
            <p className="member-card-balance">{balance}</p>
          )}
        </div>
      )}
    </div>
  )
}

function PlusMark() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="9" />
      <path d="M10 6v8M6 10h8" />
    </svg>
  )
}
