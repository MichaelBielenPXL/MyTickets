import { Link } from 'react-router-dom'

import { type Membership, useMe } from '@/features/auth'
import {
  OrganisationAvatar,
  OrganisationSwitcher,
  useBrandTheme,
  useCurrentOrganisation,
  usePublicOrganisation,
} from '@/features/organisations'
import { t } from '@/lib/i18n'

import { LanguagePicker } from './LanguagePicker'
import { OrganisationSidebar } from './OrganisationSidebar'
import { OrganisationTabs } from './OrganisationTabs'
import { UserMenu } from './UserMenu'

/**
 * The header on every page. With an account at the organisation you are in, it works like a
 * dashboard: the organisation top-left (click to switch), its tabs underneath, your account
 * top-right. Without one (also when you are signed in somewhere else) it shows whose page this is
 * and the way in.
 */
export function AppHeader() {
  const me = useMe().data ?? null
  const { slug, slugInAddress, membership: account } = useCurrentOrganisation()
  // On a page of an organisation this browser has no account at, its name comes from what anyone may
  // see. The page itself already asked for it; this reads the same remembered answer.
  const visiting = Boolean(slugInAddress && !account)
  const visited = usePublicOrganisation(slugInAddress ?? '', visiting).data
  useBrandTheme(slugInAddress)

  const current =
    account ??
    (visiting && slugInAddress
      ? { name: visited?.name ?? slugInAddress, logoUrl: visited?.logoUrl ?? null }
      : null)

  return (
    <>
      <header className="app-header">
        {/* On a phone the organisation's name needs the room: the MyTickets mark steps aside there. */}
        <div className={current ? 'header-bar has-organisation' : 'header-bar'}>
          <Link to="/" className="logo" aria-label={t('MyTickets home')}>
            <LogoMark />
            {!me && !slugInAddress && <span className="logo-text">{t('MyTickets')}</span>}
          </Link>

          {me && (
            <>
              <Divider />
              <OrganisationSwitcher
                memberships={me.memberships}
                current={current && slug ? { slug, name: current.name, logoUrl: current.logoUrl } : null}
                currentLabel={labelFor(account, visiting)}
                canCreate={me.canCreateOrganisations}
              />
            </>
          )}
          {!me && slugInAddress && current && (
            <>
              <Divider />
              <Link to={`/${slugInAddress}`} className="switcher-current">
                <OrganisationAvatar name={current.name} logoUrl={current.logoUrl} size={32} />
                <span className="switcher-name">{current.name}</span>
              </Link>
            </>
          )}

          <div className="header-end">
            <LanguagePicker />
            {/* At an organisation both lead to that organisation's own sign-in, which starts with the email step. */}
            {slugInAddress && (!me || visiting) && (
              <>
                <Link className="btn ghost small" to={`/${slugInAddress}/login`}>
                  {t('Log in')}
                </Link>
                <Link className="btn primary small" to={`/${slugInAddress}/register`}>
                  {t('Register')}
                </Link>
              </>
            )}
            {!slugInAddress && !me && (
              <>
                <Link className="btn ghost small" to="/login">
                  {t('Log in')}
                </Link>
                <Link className="btn primary small" to="/register">
                  {t('Register')}
                </Link>
              </>
            )}
            {me && !visiting && <UserMenu me={me} account={account} />}
          </div>
        </div>
      </header>
      {/* Outside the header: its frosted glass would otherwise pin these inside it.
          Wide screens get the sidebar, phones the tab bar along the bottom. */}
      {me && slug && (
        <>
          <OrganisationSidebar slug={slug} hasAccount={Boolean(account)} role={account?.role ?? null} />
          <OrganisationTabs slug={slug} hasAccount={Boolean(account)} role={account?.role ?? null} />
        </>
      )}
    </>
  )
}

/** Staff and admins see their role, members which membership they have; without an account you are visiting. */
function labelFor(account: Membership | null, visiting: boolean) {
  if (visiting) return t('Visiting')
  if (!account) return undefined
  if (!account.role) return t('Not joined yet')
  return account.role === 'Member' ? (account.tier ?? undefined) : t(account.role)
}

function Divider() {
  return (
    <svg className="header-divider" width="16" height="24" viewBox="0 0 16 24" aria-hidden>
      <path d="m11 3-6 18" stroke="currentColor" strokeLinecap="round" />
    </svg>
  )
}

function LogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v3.1a3.5 3.5 0 0 0 0 6.8v3.1a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-3.1a3.5 3.5 0 0 0 0-6.8z"
      />
    </svg>
  )
}
