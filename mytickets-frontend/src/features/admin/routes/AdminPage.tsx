import { Link, useParams, useSearchParams } from 'react-router-dom'

import { t } from '@/lib/i18n'

import { CardsTab } from '../components/CardsTab'
import { EventsTab } from '../components/EventsTab'
import { ManageMenu } from '../components/ManageMenu'
import { MembersTab } from '../components/MembersTab'
import { MembershipsTab } from '../components/MembershipsTab'
import { OverviewTab } from '../components/OverviewTab'
import { PayoutsTab } from '../components/PayoutsTab'
import { ProductsTab } from '../components/ProductsTab'
import { SettingsTab } from '../components/SettingsTab'
import { TopUpDealsTab } from '../components/TopUpDealsTab'
import { ADMIN_SECTIONS, type AdminSection, sectionFrom } from '../sections'

const TABS = ADMIN_SECTIONS
type Tab = AdminSection

const TAB_NOTES: Record<Tab, string> = {
  overview: 'Sales, members and wallet activity at a glance.',
  events: 'Publish events, set ticket limits and follow sales.',
  memberships: 'Set up free, paid and invite-only membership levels.',
  members: 'Manage membership levels and staff access.',
  cards: 'Issue cards, write them and see who has which.',
  tokens: 'Sell tokens at your own prices, like 6 tokens for € 5. Members then pick one of your deals.',
  bar: 'Keep the products and prices your team sells up to date.',
  payouts: 'Get paid for what you sell online: Stripe takes the payments and transfers them to your bank.',
  settings: 'Change your organisation’s name, description and logo.',
}

/** Where an organisation's admins set everything up. */
export function AdminPage() {
  const { slug = '' } = useParams()
  // The section lives in the address (?tab=), so the sidebar, the back button and Stripe's return
  // to ?tab=payouts all land in the right place.
  const [params, setParams] = useSearchParams()
  const tab = sectionFrom(params.get('tab'))
  // On a phone, Manage without a section opens on the list of sections (see ManageMenu).
  const sectionChosen = params.get('tab') !== null
  const setTab = (next: Tab) => setParams({ tab: next })

  return (
    <main className={sectionChosen ? 'admin-shell has-section' : 'admin-shell at-menu'}>
      <header className="admin-page-header">
        <div>
          <Link to={`/${slug}`} className="admin-back">
            {t('‹ Back to organisation')}
          </Link>
          <h1>{t('Manage')}</h1>
          <p className="admin-page-description">{t('Your organisation’s events, memberships and sales.')}</p>
        </div>
        <Link to={`/${slug}`} className="admin-org-link">
          {t('View organisation')}
        </Link>
      </header>

      <ManageMenu slug={slug} />

      <div className="admin-workspace mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <aside className="admin-sidebar rounded-2xl border border-zinc-200 bg-white p-3">
          <nav aria-label={t('Organisation management')} className="flex gap-1 overflow-x-auto lg:flex-col">
            {(Object.keys(TABS) as Tab[]).map((key) => (
              <button
                key={key}
                type="button"
                className="admin-nav-button"
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
              >
                {t(TABS[key])}
              </button>
            ))}
          </nav>
          <div className="mt-3 hidden border-t border-zinc-200 pt-3 lg:block">
            <Link to={`/${slug}/staff`} className="admin-outline-link w-full">
              {t('Open door & bar')}
              <ArrowIcon />
            </Link>
          </div>
        </aside>

        <section className="min-w-0" aria-labelledby="admin-section-title">
          <header className="mb-5">
            <Link to={`/${slug}/admin`} className="admin-menu-back">
              {t('‹ Manage')}
            </Link>
            <h2 id="admin-section-title" className="admin-section-title">
              {t(TABS[tab])}
            </h2>
            <p className="admin-section-note">{t(TAB_NOTES[tab])}</p>
          </header>
          {tab === 'overview' && <OverviewTab slug={slug} />}
          {tab === 'events' && <EventsTab slug={slug} />}
          {tab === 'memberships' && <MembershipsTab slug={slug} />}
          {tab === 'members' && <MembersTab slug={slug} />}
          {tab === 'cards' && <CardsTab slug={slug} />}
          {tab === 'tokens' && <TopUpDealsTab slug={slug} />}
          {tab === 'bar' && <ProductsTab slug={slug} />}
          {tab === 'payouts' && <PayoutsTab slug={slug} />}
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
