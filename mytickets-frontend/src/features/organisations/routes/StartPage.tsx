import { Navigate } from 'react-router-dom'

import { useCurrentOrganisation } from '../hooks/useCurrentOrganisation'
import { HomePage } from './HomePage'

/**
 * The front door for someone who is signed in: straight into the organisation they used last.
 * People who have not joined any organisation yet get the list to pick from instead.
 */
export function StartPage() {
  const { slug } = useCurrentOrganisation()
  if (slug) return <Navigate to={`/${slug}`} replace />
  return <HomePage />
}
