import { Navigate, useLocation, useParams } from 'react-router-dom'

/** Sends old organisation links to the public one-segment URL without dropping query/hash state. */
export function LegacyOrganisationRedirect() {
  const { slug = '' } = useParams()
  const location = useLocation()
  const suffix = location.pathname.slice(`/o/${slug}`.length)
  return <Navigate to={`/${slug}${suffix}${location.search}${location.hash}`} replace />
}
