import { Navigate, Outlet, useSearchParams } from 'react-router-dom'

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
  const me = useMe()
  const { slugInAddress, membership: account } = useCurrentOrganisation()

  if (me.isPending) {
    return (
      <main>
        <Loading />
      </main>
    )
  }
  const alreadyIn = slugInAddress ? Boolean(account) : me.data?.isOwner === true
  if (alreadyIn) return <Navigate to={safeNext(params.get('next'), slugInAddress)} replace />

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
