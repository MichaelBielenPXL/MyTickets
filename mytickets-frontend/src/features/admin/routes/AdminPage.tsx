import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { EventsTab } from '../components/EventsTab'
import { MembersTab } from '../components/MembersTab'
import { MembershipsTab } from '../components/MembershipsTab'
import { OverviewTab } from '../components/OverviewTab'
import { ProductsTab } from '../components/ProductsTab'
import { SettingsTab } from '../components/SettingsTab'

const TABS = {
  overview: 'Overview',
  events: 'Events',
  memberships: 'Memberships',
  members: 'Members',
  bar: 'Bar menu',
  settings: 'Settings',
} as const
type Tab = keyof typeof TABS

const TAB_NOTES: Record<Tab, string> = {
  overview: 'Sales, members and wallet activity at a glance.',
  events: 'Publish events, set ticket limits and follow sales.',
  memberships: 'Set up free, paid and invite-only membership levels.',
  members: 'Manage membership levels and staff access.',
  bar: 'Keep the products and prices your team sells up to date.',
  settings: 'Change your organisation’s name, description and logo.',
}

/** Where an organisation's admins set everything up. */
export function AdminPage() {
  const { slug = '' } = useParams()
  const [tab, setTab] = useState<Tab>('overview')

  return (
    <main className="admin-shell">
      <header className="admin-page-header">
        <div>
          <Link to={`/${slug}`} className="admin-back">
            ‹ Back to organisation
          </Link>
          <h1>Manage</h1>
          <p className="admin-page-description">Your organisation’s events, memberships and sales.</p>
        </div>
        <Link to={`/${slug}`} className="admin-org-link">
          View organisation
        </Link>
      </header>

      <div className="admin-workspace mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <aside className="admin-sidebar rounded-2xl border border-zinc-200 bg-white p-3">
          <nav aria-label="Organisation management" className="flex gap-1 overflow-x-auto lg:flex-col">
            {(Object.keys(TABS) as Tab[]).map((key) => (
              <button
                key={key}
                type="button"
                className="admin-nav-button"
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
              >
                {TABS[key]}
              </button>
            ))}
          </nav>
          <div className="mt-3 hidden border-t border-zinc-200 pt-3 lg:block">
            <Link to={`/${slug}/staff`} className="admin-outline-link w-full">
              Open door &amp; bar
              <ArrowIcon />
            </Link>
          </div>
        </aside>

        <section className="min-w-0" aria-labelledby="admin-section-title">
          <header className="mb-5">
            <h2 id="admin-section-title" className="admin-section-title">
              {TABS[tab]}
            </h2>
            <p className="admin-section-note">{TAB_NOTES[tab]}</p>
          </header>
          {tab === 'overview' && <OverviewTab slug={slug} />}
          {tab === 'events' && <EventsTab slug={slug} />}
          {tab === 'memberships' && <MembershipsTab slug={slug} />}
          {tab === 'members' && <MembersTab slug={slug} />}
          {tab === 'bar' && <ProductsTab slug={slug} />}
          {tab === 'settings' && <SettingsTab slug={slug} />}
        </section>
      </div>
    </main>
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
