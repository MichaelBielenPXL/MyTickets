import { Link } from 'react-router-dom'

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
              <p className="mb-3 text-sm text-zinc-600">Credit added to member wallets</p>
              <div>
                <DataRow label="Online top-ups" value={money(s.onlineTopUpsCents)} />
                <DataRow label="Cash top-ups" value={money(s.cashTopUpsCents)} />
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white px-5 py-4">
              <p className="text-sm font-medium text-zinc-600">Credit not yet spent</p>
              <p className="admin-kpi-number">{money(s.creditOutstandingCents)}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Money guests have paid you that they can still use.
              </p>
            </section>
          </div>

          <div className="mt-5 lg:hidden">
            <Link to={`/${slug}/staff`} className="admin-outline-link">
              Open door &amp; bar
              <ArrowIcon />
            </Link>
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

function ArrowIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M3.25 8h9.5m-4-4 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
