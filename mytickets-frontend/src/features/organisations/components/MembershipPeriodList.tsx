import { t } from '@/lib/i18n'
import { dateOnly, lastValidDay } from '@/utils/format'

import type { MembershipPeriod } from '../types'

/** Memberships over the years, newest first, the running one marked. Shown to the member, admins and staff. */
export function MembershipPeriodList({ periods }: { periods: MembershipPeriod[] }) {
  if (periods.length === 0) return <p className="muted">{t('No memberships yet.')}</p>
  return (
    <ul className="membership-periods">
      {periods.map((period) => (
        <li key={period.id}>
          <span className="membership-periods-name">
            {period.tierName}
            {period.current && <span className="tag good">{t('Current')}</span>}
          </span>
          <span className="muted">{periodText(period)}</span>
        </li>
      ))}
    </ul>
  )
}

function periodText({ startedAt, endsAt }: MembershipPeriod) {
  const from = dateOnly(startedAt)
  return endsAt
    ? t('{from} to {until}', { from, until: lastValidDay(endsAt) })
    : t('since {date}', { date: from })
}
