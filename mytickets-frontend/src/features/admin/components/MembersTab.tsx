import { useState } from 'react'
import { Link } from 'react-router-dom'

import { QueryResult } from '@/components'
import { t } from '@/lib/i18n'

import { useMembers } from '../api/admin'
import type { Member } from '../types'
import { JoinRequests } from './JoinRequests'

type MembersTabProps = {
  slug: string
}

export function MembersTab({ slug }: MembersTabProps) {
  const [search, setSearch] = useState('')
  const members = useMembers(slug)

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
      <QueryResult query={members}>
        {(all) => {
          const shown = all.filter((member) => matches(member, search))
          return (
            <>
              {/* Just who is who; everything else is on the member's own page. */}
              <ul className="list member-list">
                {shown.map((member) => (
                  <li key={member.id}>
                    <Link
                      to={`/${slug}/members/${member.id}`}
                      state={{ from: `/${slug}/admin?tab=members` }}
                      className="list-item"
                    >
                      <span>
                        <strong>{member.displayName}</strong>
                        <span className="muted member-list-email">{member.email}</span>
                      </span>
                      <span className="muted">
                        {member.tier}
                        {member.role !== 'Member' && <span className="tag">{t(member.role)}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
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
