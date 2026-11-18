import { useState } from 'react'

import { ErrorNote, QueryResult } from '@/components'
import type { Role } from '@/types'
import { lastValidDay, money } from '@/utils/format'

import { useAdminTiers, useMembers, useUpdateMember } from '../api/admin'
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
        Barmen work the bar, doormen the door, and both can check a card&apos;s tokens. Staff do all of that
        and take cash top-ups. Admins can also change everything here.
      </p>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email"
        aria-label="Search members"
      />
      <ErrorNote error={update.error} />
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
                        Tokens {money(member.balanceCents)}
                        {member.expiresAt && ` · until ${lastValidDay(member.expiresAt)}`}
                      </p>
                      <MemberDetailsList details={member} />
                    </div>
                    <div className="row wrap">
                      <select
                        value={member.tierId}
                        onChange={(e) => change(member, { tierId: e.target.value })}
                        aria-label={`Membership of ${member.displayName}`}
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
                        aria-label={`Role of ${member.displayName}`}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              {shown.length === 0 && <p className="muted">Nobody found.</p>}
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
