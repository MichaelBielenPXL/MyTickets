import type { ReactNode } from 'react'

import { t } from '@/lib/i18n'

import type { MemberDetails } from '../types'

/** The details a member gave, as a compact list; nothing shown for what wasn't asked or given. */
export function MemberDetailsList({ details, empty = null }: { details: MemberDetails; empty?: ReactNode }) {
  const address = [details.street, [details.postalCode, details.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')
  const rows: [string, string | null][] = [
    ['Phone', details.phone],
    ['Address', address || null],
    ['School', details.school],
    ['Faculty', details.faculty],
    ['Year', details.studyYear],
  ]
  const given = rows.filter(([, value]) => value)
  if (given.length === 0) return empty
  return (
    <dl className="member-details">
      {given.map(([label, value]) => (
        <div key={label}>
          <dt>{t(label)}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
