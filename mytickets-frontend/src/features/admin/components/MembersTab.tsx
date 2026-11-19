import { useState } from 'react'

import { ErrorNote, QueryResult } from '@/components'
import { t } from '@/lib/i18n'
import type { Role } from '@/types'
import { lastValidDay, tokenPrice } from '@/utils/format'

import { useAdminTiers, useAllowExtraCard, useMembers, useUpdateMember } from '../api/admin'
import type { Member } from '../types'
import { JoinRequests } from './JoinRequests'
import { MemberDetailsList } from './MemberDetailsList'

type MembersTabProps = {
  slug: string
}

const ROLES: Role[] = ['Member', 'Barman', 'Doorman', 'Staff', 'Admin']

export function MembersTab({ slug }: MembersTabProps) {
  const [search, setSearch] = useState('')
  const members = useMembers(slug)
  const tiers = useAdminTiers(slug).data ?? []
  const update = useUpdateMember(slug)
  const extraCard = useAllowExtraCard(slug)

  function change(member: Member, changes: Partial<Pick<Member, 'role' | 'tierId'>>) {
    update.mutate({
      id: member.id,
      role: member.role,
      tierId: member.tierId,
      expiresAt: member.expiresAt,
      ...changes,
    })
  }

  return (
    <div className="stack">
      <JoinRequests slug={slug} />
      <p className="muted">
        {t(
          "Barmen work the bar, doormen the door, and both can check a card's tokens. Staff do all of that and take cash top-ups. Admins can also change everything here.",
        )}
      </p>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('Search by name or email')}
        aria-label={t('Search members')}
      />
      <ErrorNote error={update.error ?? extraCard.error} />
      <QueryResult query={members}>
        {(all) => {
          const shown = all.filter((member) => matches(member, search))
          return (
            <>
              <div className="list">
                {shown.map((member) => (
                  <div key={member.id} className="list-item member">
                    <div>
                      <strong>{member.displayName}</strong>
                      <p className="muted">{member.email}</p>
                      <p className="muted">
                        {t('Tokens {amount}', { amount: tokenPrice(member.balanceCents) })}
                        {member.expiresAt &&
                          ` · ${t('until {date}', { date: lastValidDay(member.expiresAt) })}`}
                      </p>
                      <MemberDetailsList details={member} />
                    </div>
                    <div className="row wrap">
                      <select
                        value={member.tierId}
                        onChange={(e) => change(member, { tierId: e.target.value })}
                        aria-label={t('Membership of {name}', { name: member.displayName })}
                      >
                        {tiers.map((tier) => (
                          <option key={tier.id} value={tier.id}>
                            {tier.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={member.role}
                        onChange={(e) => change(member, { role: e.target.value as Role })}
                        aria-label={t('Role of {name}', { name: member.displayName })}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {t(role)}
                          </option>
                        ))}
                      </select>
                      {/* One new card a year; a member who lost theirs can be allowed one more. */}
                      <button
                        type="button"
                        className="btn"
                        aria-pressed={member.extraCardAllowed}
                        disabled={extraCard.isPending}
                        onClick={() =>
                          extraCard.mutate({ memberId: member.id, allowed: !member.extraCardAllowed })
                        }
                      >
                        {member.extraCardAllowed ? t('Extra card allowed') : t('Allow one extra card')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {shown.length === 0 && <p className="muted">{t('Nobody found.')}</p>}
            </>
          )
        }}
      </QueryResult>
    </div>
  )
}

function matches(member: Member, search: string) {
  const wanted = search.trim().toLowerCase()
  if (!wanted) return true
  return member.displayName.toLowerCase().includes(wanted) || member.email.toLowerCase().includes(wanted)
}
