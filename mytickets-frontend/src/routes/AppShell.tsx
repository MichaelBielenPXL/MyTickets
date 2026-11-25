import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { Loading } from '@/components'
import { useMe } from '@/features/auth'
import { useCurrentOrganisation } from '@/features/organisations'

import { AppHeader } from './AppHeader'

/**
 * Frame around the pages that need someone signed in to MyTickets. Inside an organisation a visitor is sent to that
 * organisation's sign-in page; someone signed in who hasn't joined it yet gets the pages, which offer to join.
 * `bare` leaves the header out, for pages that take the whole screen.
 */
export function AppShell({ bare = false }: { bare?: boolean }) {
  const location = useLocation()
  const me = useMe()
  const { slugInAddress } = useCurrentOrganisation()

  if (me.isPending) {
    return (
      <main>
        <Loading />
      </main>
    )
  }
  const comeBackTo = encodeURIComponent(location.pathname + location.search)
  if (!me.data) {
    const signIn = slugInAddress ? `/${slugInAddress}/login` : '/login'
    return <Navigate to={`${signIn}?next=${comeBackTo}`} replace />
  }

  return (
    <>
      {!bare && <AppHeader />}
      <Outlet />
    </>
  )
}
