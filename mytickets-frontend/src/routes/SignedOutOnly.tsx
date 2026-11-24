import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom'

import { Loading } from '@/components'
import { useMe } from '@/features/auth'
import { useCurrentOrganisation } from '@/features/organisations'

import { AppHeader } from './AppHeader'

/**
 * Frame around the sign-in pages. Whoever already has what the page would give them is sent on to
 * where they were heading: on an organisation's sign-in page that is an account at that organisation,
 * on the front-page ones an organiser's login. Being signed in somewhere else changes nothing here.
 */
export function SignedOutOnly() {
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  const me = useMe()
  const { slugInAddress } = useCurrentOrganisation()

  if (me.isPending) {
    return (
      <main>
        <Loading />
      </main>
    )
  }
  // One MyTickets account: signed in anywhere is signed in here too.
  const alreadyIn = Boolean(me.data)
  if (alreadyIn) {
    // Someone who just signed up at an organisation goes on to choose a membership.
    const justSignedUp = Boolean(slugInAddress) && pathname.endsWith('/register') && !params.get('next')
    return (
      <Navigate
        to={justSignedUp ? `/${slugInAddress}/join` : safeNext(params.get('next'), slugInAddress)}
        replace
      />
    )
  }

  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  )
}

/** Only ever continue to a page of this site, never to an address someone put in the link. */
function safeNext(next: string | null, slug: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : slug ? `/${slug}` : '/'
}
