import { Link } from 'react-router-dom'

import { useAccount } from '@/features/auth'
import { useCards } from '@/features/cards'
import { t } from '@/lib/i18n'
import { lastValidDay } from '@/utils/format'

import type { Organisation } from '../types'
import { MemberCard } from './MemberCard'
import { MemberPassPanel } from './MemberPassPanel'

type MembershipPanelProps = {
  organisation: Organisation
}

/**
 * A member's home at the organisation: their card in the organisation's colour, with what they will
 * most likely do next beside it: top up tokens, open their tickets.
 */
export function MembershipPanel({ organisation }: MembershipPanelProps) {
  const { slug, membership } = organisation
  const account = useAccount(slug).data
  const cards = useCards(slug).data
  if (!membership) return null

  const payingCard = cards?.find((card) => !card.blocked) ?? null
  const perks = [
    membership.ticketDiscountPercent > 0 &&
      t('{percent}% off tickets', { percent: membership.ticketDiscountPercent }),
    membership.drinkDiscountPercent > 0 &&
      t('{percent}% off at the bar', { percent: membership.drinkDiscountPercent }),
  ].filter((perk): perk is string => Boolean(perk))

  return (
    <section className="member-home" aria-label={t('Your membership')}>
      <MemberCard
        organisationName={organisation.name}
        logoUrl={organisation.logoUrl}
        memberName={account?.displayName ?? ''}
        tier={membership.tier}
        expiresAt={membership.expiresAt}
        active={membership.active}
        pass={<MemberPassPanel slug={slug} organisationName={organisation.name} />}
      />

      <div className="member-side">
        <h1>{organisation.name}</h1>
        {organisation.description && <p className="lead">{organisation.description}</p>}
        {!membership.active && membership.expiresAt && (
          <p className="member-status bad">Expired on {lastValidDay(membership.expiresAt)}</p>
        )}

        <div className="member-actions">
          <Link className="btn brand" to={`/${slug}/wallet`}>
            {t('Top up tokens')}
          </Link>
          <Link className="btn" to={`/${slug}/tickets`}>
            {t('My tickets')}
          </Link>
        </div>

        {perks.length > 0 && (
          <ul className="member-perks" aria-label={`${membership.tier} perks`}>
            {perks.map((perk) => (
              <li key={perk}>
                <CheckMark />
                {perk}
              </li>
            ))}
          </ul>
        )}

        {payingCard && (
          <p className="member-paying-card">
            <span>{t('Paying card')}</span>
            <strong>{t('Card {number}', { number: payingCard.number })}</strong>
          </p>
        )}

        <p className="member-links">
          {cards && !payingCard && (
            <Link to={`/${slug}/wallet/cards`}>{t('Link a card to pay with a tap')}</Link>
          )}
          {membership.active && <Link to={`/${slug}/join`}>{t('Change membership')}</Link>}
        </p>
      </div>
    </section>
  )
}

function CheckMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  )
}
