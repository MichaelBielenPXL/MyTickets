import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { Loading } from '@/components'
import { useMe } from '@/features/auth'
import { useCurrentOrganisation } from '@/features/organisations'

import { AppHeader } from './AppHeader'

/**
 * Frame around the pages that need an account. Inside an organisation that means an account at that
 * organisation: being signed in somewhere else does not count, and the visitor is sent to sign in there.
 */
export function AppShell() {
  const location = useLocation()
  const me = useMe()
  const { slugInAddress, membership: account } = useCurrentOrganisation()

  if (me.isPending) {
    return (
      <main>
        <Loading />
      </main>
    )
  }
  const comeBackTo = encodeURIComponent(location.pathname + location.search)
  if (slugInAddress && !account) return <Navigate to={`/${slugInAddress}/login?next=${comeBackTo}`} replace />
  if (!me.data) return <Navigate to={`/login?next=${comeBackTo}`} replace />

  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  )
}
