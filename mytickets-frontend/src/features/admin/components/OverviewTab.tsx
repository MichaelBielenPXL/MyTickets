import { QueryResult } from '@/components'
import { money } from '@/utils/format'

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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Metric label="Ticket sales" value={money(s.ticketRevenueCents)} />
            <Metric label="Bar sales" value={money(s.barRevenueCents)} />
            <Metric label="Members" value={String(s.members)} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <section className="rounded-2xl border border-zinc-200 bg-white px-5 py-4">
              <h3 className="mb-1 text-base font-semibold text-zinc-900">Wallet activity</h3>
              <p className="mb-3 text-sm text-zinc-600">Tokens bought by members</p>
              <div>
                <DataRow label="Online top-ups" value={money(s.onlineTopUpsCents)} />
                <DataRow label="Cash top-ups" value={money(s.cashTopUpsCents)} />
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white px-5 py-4">
              <p className="text-sm font-medium text-zinc-600">Tokens not yet spent</p>
              <p className="admin-kpi-number">{money(s.creditOutstandingCents)}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Money guests have paid you that they can still use.
              </p>
              <p className="mt-5 border-t border-zinc-200 pt-4 text-sm font-medium text-zinc-600">
                Deposits held
              </p>
              <p className="admin-kpi-number">{money(s.depositsHeldCents)}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                For cups that haven&apos;t come back yet. Not counted in bar sales.
              </p>
            </section>
          </div>
        </>
      )}
    </QueryResult>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <dl className="rounded-2xl border border-zinc-200 bg-white px-5 py-4">
      <dt className="text-sm font-medium text-zinc-600">{label}</dt>
      <dd className="admin-kpi-number">{value}</dd>
    </dl>
  )
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-data-row">
      <span className="text-zinc-600">{label}</span>
      <strong className="font-semibold tabular-nums text-zinc-900">{value}</strong>
    </div>
  )
}
