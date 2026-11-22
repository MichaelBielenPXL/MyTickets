import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { t } from '@/lib/i18n'
import { money, tokenPrice } from '@/utils/format'

import { useSummary } from '../api/admin'
import { ADMIN_SECTIONS, type AdminSection } from '../sections'
import { periodOf } from '../utils/period'

type ManageMenuProps = {
  slug: string
}

/** What each section is for, in a few words under its name. */
const SUMMARIES: Record<AdminSection, string> = {
  overview: 'Sales and members at a glance',
  events: 'Parties, tickets and sales',
  memberships: 'Ways to join, prices and discounts',
  members: 'People, roles and requests',
  cards: 'Issue, write and track cards',
  tokens: 'Top-up deals and token prices',
  bar: 'Drinks, cups and categories',
  payouts: 'Getting paid to your bank',
  settings: 'Name, logo and sign-up details',
}

/**
 * On a phone, Manage opens on the key numbers, then a list of every other section, as iOS Settings
 * does: everything in view at once, nothing hidden behind sideways scrolling. Each row opens its section.
 */
export function ManageMenu({ slug }: ManageMenuProps) {
  const summary = useSummary(slug, periodOf('month'))
  const s = summary.data

  return (
    <div className="manage-home">
      <Link
        to={`/${slug}/admin?tab=overview`}
        className="manage-glance"
        aria-label={t('Overview: see details')}
      >
        <span className="manage-glance-head">
          <strong>{t('Overview')}</strong>
          <span>{t('Details ›')}</span>
        </span>
        <span className="manage-glance-grid">
          {/* This month: what is the organisation's (online, after fees, and cash), and how the bar did. */}
          <Stat
            label={t('Paid to you this month')}
            value={s ? money(s.payout.youGetCents + s.cash.cents) : '…'}
          />
          <Stat label={t('Bar takings')} value={s ? tokenPrice(s.bar.takingsCents) : '…'} />
          <Stat label={t('Active members')} value={s ? String(s.memberships.active) : '…'} />
          <Stat label={t('Tokens not spent')} value={s ? tokenPrice(s.tokens.outstandingCents) : '…'} />
        </span>
      </Link>
      <nav className="manage-menu" aria-label={t('Manage sections')}>
        {(Object.keys(ADMIN_SECTIONS) as AdminSection[])
          .filter((key) => key !== 'overview')
          .map((key) => (
            <Link key={key} to={`/${slug}/admin?tab=${key}`} className="manage-menu-row">
              <span className={`manage-menu-icon ${key}`} aria-hidden="true">
                {ICONS[key]}
              </span>
              <span className="manage-menu-text">
                <strong>{t(ADMIN_SECTIONS[key])}</strong>
                <small>{t(SUMMARIES[key])}</small>
              </span>
              <svg
                className="manage-menu-chevron"
                width="8"
                height="14"
                viewBox="0 0 8 14"
                aria-hidden="true"
              >
                <path
                  d="m1 1 6 6-6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          ))}
      </nav>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="manage-stat">
      <small>{label}</small>
      <b>{value}</b>
    </span>
  )
}

const glyph = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.1,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const ICONS: Record<AdminSection, ReactNode> = {
  overview: (
    <svg {...glyph}>
      <path d="M5 19V11M12 19V5M19 19v-6" />
    </svg>
  ),
  events: (
    <svg {...glyph}>
      <rect x="4" y="5.5" width="16" height="14" rx="2.5" />
      <path d="M4 10h16M9 3.5v4M15 3.5v4" />
    </svg>
  ),
  memberships: (
    <svg {...glyph}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6.5 15.5c.6-1.3 1.5-2 2.5-2s1.9.7 2.5 2M14 10h3.5M14 13.5h3.5" />
    </svg>
  ),
  members: (
    <svg {...glyph}>
      <circle cx="9" cy="9" r="3" />
      <path d="M3.5 19c.8-2.9 3-4.5 5.5-4.5s4.7 1.6 5.5 4.5" />
      <circle cx="16.5" cy="8.5" r="2.3" />
      <path d="M16 13.2c2.2.1 3.9 1.5 4.5 3.8" />
    </svg>
  ),
  cards: (
    // A card with its chip, and the contactless waves of a tap.
    <svg {...glyph}>
      <rect x="2.5" y="6" width="13" height="12" rx="2.2" />
      <rect x="5.2" y="9" width="3.6" height="3" rx="0.8" />
      <path d="M18.2 9.3a3.8 3.8 0 0 1 0 5.4M20.6 7a7 7 0 0 1 0 10" />
    </svg>
  ),
  tokens: (
    // Two coins, the front one marked T for tokens.
    <svg {...glyph}>
      <path d="M8.8 14.9A5.6 5.6 0 1 1 14.9 8.8" />
      <circle cx="14.6" cy="14.6" r="5.6" />
      <path d="M12.5 12.7h4.2M14.6 12.7v4.4" />
    </svg>
  ),
  bar: (
    <svg {...glyph}>
      <path d="M7 4h10l-1.3 15a1.5 1.5 0 0 1-1.5 1.4H9.8a1.5 1.5 0 0 1-1.5-1.4Z" />
      <path d="M7.4 8.5h9.2" />
    </svg>
  ),
  payouts: (
    <svg {...glyph}>
      <path d="M16.5 6.8A6 6 0 1 0 16.5 17.2M5 10.5h8M5 13.5h8" />
    </svg>
  ),
  settings: (
    <svg {...glyph}>
      <circle cx="12" cy="12" r="2.8" />
      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z" />
    </svg>
  ),
}
