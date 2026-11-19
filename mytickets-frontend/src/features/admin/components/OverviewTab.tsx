import { QueryResult } from '@/components'
import { t } from '@/lib/i18n'
import { money, tokenPrice } from '@/utils/format'

import { useSummary } from '../api/admin'

type OverviewTabProps = {
  slug: string
}

export function OverviewTab({ slug }: OverviewTabProps) {
  const summary = useSummary(slug)

  return (
    <QueryResult query={summary}>
      {(s) => (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label={t('Ticket sales')}
              value={money(s.ticketRevenueCents)}
              note={feeNote(s.ticketRevenueCents, s.ticketFeesCents)}
            />
            <Metric
              label={t('Token sales')}
              value={money(s.onlineTopUpsCents + s.cashTopUpsCents)}
              note={feeNote(s.onlineTopUpsCents + s.cashTopUpsCents, s.topUpFeesCents)}
            />
            <Metric label={t('Bar sales')} value={money(s.barRevenueCents)} />
            <Metric label={t('Members')} value={String(s.members)} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <section className="rounded-2xl border border-zinc-200 bg-white px-5 py-4">
              <h3 className="mb-1 text-base font-semibold text-zinc-900">{t('Wallet activity')}</h3>
              <p className="mb-3 text-sm text-zinc-600">{t('Tokens bought by members, in euros')}</p>
              <div>
                <DataRow label={t('Online top-ups')} value={money(s.onlineTopUpsCents)} />
                <DataRow label={t('Fees on online top-ups')} value={`− ${money(s.topUpFeesCents)}`} />
                <DataRow label={t('Cash top-ups')} value={money(s.cashTopUpsCents)} />
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white px-5 py-4">
              <p className="text-sm font-medium text-zinc-600">{t('Tokens not yet spent')}</p>
              <p className="admin-kpi-number">{tokenPrice(s.creditOutstandingCents)}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {t('Money guests have paid you that they can still use.')}
              </p>
              <p className="mt-5 border-t border-zinc-200 pt-4 text-sm font-medium text-zinc-600">
                {t('Deposits held')}
              </p>
              <p className="admin-kpi-number">{tokenPrice(s.depositsHeldCents)}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {t("For cups that haven't come back yet. Not counted in bar sales.")}
              </p>
            </section>
          </div>
        </>
      )}
    </QueryResult>
  )
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <dl className="rounded-2xl border border-zinc-200 bg-white px-5 py-4">
      <dt className="text-sm font-medium text-zinc-600">{label}</dt>
      <dd className="admin-kpi-number">{value}</dd>
      {note && <dd className="mt-1 text-sm text-zinc-500">{note}</dd>}
    </dl>
  )
}

/** "€ 0,62 fees · € 11,88 to you": what MyTickets kept, and what is left for the organisation. */
function feeNote(totalCents: number, feesCents: number) {
  return t('{fees} fees · {rest} to you', { fees: money(feesCents), rest: money(totalCents - feesCents) })
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-data-row">
      <span className="text-zinc-600">{label}</span>
      <strong className="font-semibold tabular-nums text-zinc-900">{value}</strong>
    </div>
  )
}
