import type { ReactNode } from 'react'
import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom'

import { ADMIN_SECTIONS, type AdminSection, sectionFrom } from '@/features/admin'
import { t } from '@/lib/i18n'
import type { Role } from '@/types'

import { DashboardIcon, GearIcon, TicketIcon, TillIcon, WalletIcon } from './navIcons'
import { workLabel } from './workLabel'

type OrganisationSidebarProps = {
  slug: string
  hasAccount: boolean
  role: Role | null
}

/**
 * On a wide screen the places within the organisation sit down the left, as on Vercel, which keeps
 * the header to the logo, the organisation and the account. Manage folds out into its sections here
 * too, so there is never a second sidebar beside this one. Phones keep the tabs under the header.
 */
export function OrganisationSidebar({ slug, hasAccount, role }: OrganisationSidebarProps) {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const inManage = pathname === `/${slug}/admin`
  const section = sectionFrom(params.get('tab'))

  return (
    <aside className="org-sidebar">
      <nav aria-label={t('Organisation sections')}>
        <SidebarLink to={`/${slug}`} end icon={<DashboardIcon />}>
          {t('Dashboard')}
        </SidebarLink>
        {hasAccount && (
          <SidebarLink to={`/${slug}/wallet`} icon={<WalletIcon />}>
            {t('Wallet')}
          </SidebarLink>
        )}
        {hasAccount && (
          <SidebarLink to={`/${slug}/tickets`} icon={<TicketIcon />}>
            {t('Tickets')}
          </SidebarLink>
        )}
        {role && role !== 'Member' && (
          <SidebarLink to={`/${slug}/staff`} icon={<TillIcon />}>
            {workLabel(role)}
          </SidebarLink>
        )}
        {role === 'Admin' && (
          <>
            <SidebarLink to={`/${slug}/admin`} icon={<GearIcon />}>
              {t('Manage')}
            </SidebarLink>
            {inManage && (
              <div className="org-sidebar-sub">
                {(Object.keys(ADMIN_SECTIONS) as AdminSection[]).map((key) => (
                  <Link
                    key={key}
                    to={`/${slug}/admin?tab=${key}`}
                    className={key === section ? 'active' : undefined}
                    aria-current={key === section ? 'page' : undefined}
                  >
                    {t(ADMIN_SECTIONS[key])}
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </nav>
    </aside>
  )
}

function SidebarLink({
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
    <NavLink to={to} end={end} className="org-sidebar-link">
      <span className="org-sidebar-icon" aria-hidden="true">
        {icon}
      </span>
      {children}
    </NavLink>
  )
}
