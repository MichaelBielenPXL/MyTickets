import { Link, useLocation, useParams } from 'react-router-dom'

import { ErrorNote, Field, QueryResult } from '@/components'
import { useAccount } from '@/features/auth'
import { MemberDetailsList, MembershipPeriodList, ProfileFormFields } from '@/features/organisations'
import { type MemberInfo, useStaffMember } from '@/features/staff'
import { t } from '@/lib/i18n'
import type { Role } from '@/types'
import { dateOnly, lastValidDay, tokenPrice } from '@/utils/format'

import { useAdminTiers, useAllowExtraCard, useSaveMemberProfile, useUpdateMember } from '../api/admin'

const ROLES: Role[] = ['Member', 'Barman', 'Doorman', 'Staff', 'Admin']

/**
 * One member, laid out like their own My details: who they are, their membership, details, cards and
 * memberships over the years. Staff look; admins can also change the membership and correct the details.
 */
export function MemberPage() {
  const { slug = '', memberId = '' } = useParams()
  const location = useLocation()
  const member = useStaffMember(slug, memberId)
  const isAdmin = useAccount(slug).data?.role === 'Admin'
  // Back to the list they came from: Manage › Members, or the staff screen.
  const back =
    (location.state as { from?: string } | null)?.from ??
    (isAdmin ? `/${slug}/admin?tab=members` : `/${slug}/staff?mode=members`)

  return (
    <main className="customer-page join-page member-page">
      <Link to={back} className="back">
        ‹ {t('Members')}
      </Link>
      <QueryResult query={member}>
        {(info) => (
          <>
            <header className="join-heading">
              <h1>{info.displayName}</h1>
              <p className="lead">{info.email}</p>
            </header>
            <MembershipPanel slug={slug} info={info} isAdmin={isAdmin} />
            <section className="panel stack" aria-labelledby="member-details">
              <h2 id="member-details">{t('Details')}</h2>
              {isAdmin ? (
                <DetailsForm slug={slug} info={info} />
              ) : (
                <MemberDetailsList details={info} empty={<p className="muted">{t('No details given.')}</p>} />
              )}
            </section>
            <CardsPanel info={info} />
            <section className="panel stack" aria-labelledby="member-history">
              <h2 id="member-history">{t('Membership history')}</h2>
              <MembershipPeriodList periods={info.history} />
            </section>
          </>
        )}
      </QueryResult>
    </main>
  )
}

function MembershipPanel({ slug, info, isAdmin }: { slug: string; info: MemberInfo; isAdmin: boolean }) {
  return (
    <section className="panel stack" aria-labelledby="member-membership">
      <div className="spread">
        <h2 id="member-membership">{t('Membership')}</h2>
        <strong className="big-number">{tokenPrice(info.balanceCents)}</strong>
      </div>
      <p className={info.membershipActive ? undefined : 'bad'}>
        {info.tier}
        {info.role !== 'Member' && ` · ${t(info.role)}`}
        {info.membershipActive
          ? info.expiresAt && ` · ${t('until {date}', { date: lastValidDay(info.expiresAt) })}`
          : ` · ${t('expired')}`}
      </p>
      <p className="muted">{t('Joined {date}', { date: dateOnly(info.joinedAt) })}</p>
      {isAdmin && <MembershipControls slug={slug} info={info} />}
    </section>
  )
}

/**
 * Admins only: the membership type, the role, and one extra card for someone who lost theirs. Another type
 * runs until that type's end date (the server sets it), as if they had joined it.
 */
function MembershipControls({ slug, info }: { slug: string; info: MemberInfo }) {
  const tiers = useAdminTiers(slug).data ?? []
  // "2026-11-22" on this device's clock, to compare with the types' end dates.
  const today = new Date().toLocaleDateString('sv-SE')
  const update = useUpdateMember(slug)
  const extraCard = useAllowExtraCard(slug)
  const change = (changes: { role?: Role; tierId?: string }) =>
    update.mutate({
      id: info.id,
      role: info.role,
      tierId: info.tierId,
      expiresAt: info.expiresAt,
      ...changes,
    })

  return (
    <>
      <div className="grid-2">
        <Field label={t('Membership type')}>
          <select
            value={info.tierId}
            onChange={(e) => change({ tierId: e.target.value })}
            disabled={update.isPending}
          >
            {tiers.map((tier) => {
              // A type whose end date has passed can't be given out until it gets a new one.
              const ended = tier.endsOn !== null && tier.endsOn < today && tier.id !== info.tierId
              return (
                <option key={tier.id} value={tier.id} disabled={ended}>
                  {ended ? t('{name} (ended)', { name: tier.name }) : tier.name}
                </option>
              )
            })}
          </select>
        </Field>
        <Field label={t('Role')}>
          <select
            value={info.role}
            onChange={(e) => change({ role: e.target.value as Role })}
            disabled={update.isPending}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {t(role)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {/* One new card a year; a member who lost theirs can be allowed one more. */}
      <button
        type="button"
        className="btn ghost small member-page-extra-card"
        aria-pressed={info.extraCardAllowed}
        disabled={extraCard.isPending}
        onClick={() => extraCard.mutate({ memberId: info.id, allowed: !info.extraCardAllowed })}
      >
        {info.extraCardAllowed ? t('Extra card allowed') : t('Allow one extra card')}
      </button>
      <ErrorNote error={update.error ?? extraCard.error} />
    </>
  )
}

function DetailsForm({ slug, info }: { slug: string; info: MemberInfo }) {
  const save = useSaveMemberProfile(slug, info.id)
  return (
    <>
      <ProfileFormFields
        // Starts over from what was saved, once saving is done.
        key={JSON.stringify(info.profile)}
        form={{ fields: info.fields, profile: info.profile, complete: true, email: info.email }}
        submitLabel={t('Save details')}
        busy={save.isPending}
        error={save.error}
        onSubmit={(values) => save.mutate(values)}
      />
      {save.isSuccess && (
        <p className="muted" role="status">
          {t('Saved.')}
        </p>
      )}
    </>
  )
}

function CardsPanel({ info }: { info: MemberInfo }) {
  return (
    <section className="panel stack" aria-labelledby="member-cards">
      <h2 id="member-cards">{t('Cards')}</h2>
      {info.cards.length === 0 ? (
        <p className="muted">{t('No cards linked.')}</p>
      ) : (
        <ul className="membership-periods">
          {info.cards.map((card) => (
            <li key={card.number}>
              <span className="membership-periods-name">
                {card.label || t('Card {number}', { number: card.number })}
                {card.blocked && <span className="tag bad">{t('Blocked')}</span>}
              </span>
              {card.linkedAt && (
                <span className="muted">{t('linked {date}', { date: dateOnly(card.linkedAt) })}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
