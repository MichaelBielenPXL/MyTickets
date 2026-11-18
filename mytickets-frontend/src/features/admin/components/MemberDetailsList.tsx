import type { MemberDetails } from '../types'

/** The details a member gave, as a compact list; nothing shown for what wasn't asked or given. */
export function MemberDetailsList({ details }: { details: MemberDetails }) {
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
  if (given.length === 0) return null
  return (
    <dl className="member-details">
      {given.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
