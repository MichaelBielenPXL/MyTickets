import { NavLink } from 'react-router-dom'

import type { Role } from '@/types'

type OrganisationTabsProps = {
  slug: string
  /** Whether this browser has an account at this organisation. */
  hasAccount: boolean
  /** The account's role, or null when it has not picked a membership yet. */
  role: Role | null
}

/** The row of tabs under the header: the places this person can go within the current organisation. */
export function OrganisationTabs({ slug, hasAccount, role }: OrganisationTabsProps) {
  return (
    <nav className="header-tabs" aria-label="Organisation">
      <NavLink to={`/${slug}`} end>
        Events
      </NavLink>
      {role && <NavLink to={`/${slug}/wallet`}>Wallet</NavLink>}
      {hasAccount && <NavLink to={`/${slug}/tickets`}>Tickets</NavLink>}
      {hasAccount && <NavLink to={`/${slug}/cards`}>Cards</NavLink>}
      {role && role !== 'Member' && <NavLink to={`/${slug}/staff`}>Door &amp; bar</NavLink>}
      {role === 'Admin' && <NavLink to={`/${slug}/admin`}>Manage</NavLink>}
    </nav>
  )
}
