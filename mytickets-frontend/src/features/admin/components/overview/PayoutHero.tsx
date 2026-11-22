import { t } from '@/lib/i18n'
import { money, tokenPrice } from '@/utils/format'

import type { Summary } from '../../types'
import { Metric } from './Metric'

/** The headline: what is the organisation's, from online payments and from top-ups at the cashier. */
export function PayoutHero({ s }: { s: Summary }) {
  const { payout, cash } = s
  return (
    <div className="overview-hero">
      <Metric
        label={t('You get from online payments')}
        value={money(payout.youGetCents)}
        note={t('Stripe pays it out to your bank account.')}
      />
      <Metric
        label={t('Top-ups at the cashier')}
        value={money(cash.cents)}
        note={t('{count} top-ups, cash or card', { count: cash.count })}
      />
      <Metric
        label={t('Bar takings')}
        value={tokenPrice(s.bar.takingsCents)}
        note={t('{count} sales, paid in tokens', { count: s.bar.sales })}
      />
      <Metric
        label={t('Active members')}
        value={String(s.memberships.active)}
        note={t('{count} joined or renewed in this period', { count: s.memberships.joined })}
      />
    </div>
  )
}
