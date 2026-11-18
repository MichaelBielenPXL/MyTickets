import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

import type { Role } from '@/types'

import { CalendarIcon, GearIcon, TicketIcon, TillIcon, WalletIcon } from './navIcons'
import { workLabel } from './workLabel'

type OrganisationTabsProps = {
  slug: string
  /** Whether this browser has an account at this organisation. */
  hasAccount: boolean
  /** The account's role, or null when it has not picked a membership yet. */
  role: Role | null
}

/**
 * On a phone, the places within the organisation sit in a tab bar along the bottom, as in iOS apps:
 * in reach of a thumb, and the header stays small. Wide screens use the sidebar instead.
 */
export function OrganisationTabs({ slug, hasAccount, role }: OrganisationTabsProps) {
  return (
    <nav className="tab-bar" aria-label="Organisation">
      <Tab to={`/${slug}`} end icon={<CalendarIcon />}>
        Events
      </Tab>
      {hasAccount && (
        <Tab to={`/${slug}/wallet`} icon={<WalletIcon />}>
          Wallet
        </Tab>
      )}
      {hasAccount && (
        <Tab to={`/${slug}/tickets`} icon={<TicketIcon />}>
          Tickets
        </Tab>
      )}
      {role && role !== 'Member' && (
        <Tab to={`/${slug}/staff`} icon={<TillIcon />}>
          {workLabel(role)}
        </Tab>
      )}
      {role === 'Admin' && (
        <Tab to={`/${slug}/admin`} icon={<GearIcon />}>
          Manage
        </Tab>
      )}
    </nav>
  )
}

function Tab({
  to,
  end,
  icon,
  children,
}: {
  to: string
  end?: boolean
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <NavLink to={to} end={end} className="tab-bar-item">
      <span aria-hidden="true">{icon}</span>
      <span className="tab-bar-label">{children}</span>
    </NavLink>
  )
}
