import { useState } from 'react'

import { QueryResult } from '@/components'
import { t } from '@/lib/i18n'

import { useSummary } from '../api/admin'
import { type PeriodChoice, periodOf } from '../utils/period'
import { Segmented } from './Segmented'
import { MoneyTable } from './overview/MoneyTable'
import { BankPayoutsCard, BarCard, MembershipsCard, TicketsCard, TokensCard } from './overview/OverviewCards'
import { PaymentsTable } from './overview/PaymentsTable'
import { PayoutHero } from './overview/PayoutHero'
import { TakingsChart } from './overview/TakingsChart'

type OverviewTabProps = {
  slug: string
}

const PERIODS: { value: PeriodChoice; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
]

/**
 * What the organisation took in over a period, and what it actually gets paid: online payments with every
 * fee taken off, top-ups at the cashier, what the bar sold, tokens, memberships and tickets, and every payment.
 */
export function OverviewTab({ slug }: OverviewTabProps) {
  const [choice, setChoice] = useState<PeriodChoice>('month')
  const summary = useSummary(slug, periodOf(choice))

  return (
    <div className="overview stack">
      <Segmented label={t('Period')} options={PERIODS} value={choice} onChange={setChoice} />
      <QueryResult query={summary}>
        {(s) => (
          <>
            <PayoutHero s={s} />
            <MoneyTable s={s} />
            <TakingsChart byPeriod={s.byPeriod} />
            <div className="overview-grid">
              <BarCard s={s} />
              <TokensCard s={s} />
              <MembershipsCard s={s} />
              <TicketsCard s={s} />
              <BankPayoutsCard s={s} />
            </div>
            <PaymentsTable payments={s.payments} total={s.paymentsCount} />
          </>
        )}
      </QueryResult>
    </div>
  )
}
