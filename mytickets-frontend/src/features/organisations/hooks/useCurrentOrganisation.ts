import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { type Membership, useMe } from '@/features/auth'

// First parts of an address that are pages of the site itself, never an organisation.
const SITE_PAGES = new Set([
  '',
  'login',
  'register',
  'forgot-password',
  'reset-password',
  'terms',
  'privacy',
  'discover',
  'platform',
  'o',
])
const STORAGE_KEY = 'mytickets:last-organisation'

type CurrentOrganisation = {
  /** The organisation the person is working in: the one in the address, else the one they used last. */
  slug: string | null
  /** Only set when the address itself is inside an organisation. */
  slugInAddress: string | null
  /** The person's record there, or null when they haven't joined it (or aren't signed in). */
  membership: Membership | null
}

/**
 * Which organisation the app is "in". It follows the address; on the few pages that belong to no
 * organisation it stays on the one used last on this device.
 */
export function useCurrentOrganisation(): CurrentOrganisation {
  const { pathname } = useLocation()
  const memberships = useMe().data?.memberships

  const firstPart = pathname.split('/')[1] ?? ''
  const slugInAddress = SITE_PAGES.has(firstPart) ? null : firstPart
  const visitedMembership = memberships?.find((m) => m.slug === slugInAddress)

  useEffect(() => {
    if (visitedMembership) remember(visitedMembership.slug)
  }, [visitedMembership])

  if (slugInAddress) return { slug: slugInAddress, slugInAddress, membership: visitedMembership ?? null }

  const lastUsed = recall()
  const fallback = memberships?.find((m) => m.slug === lastUsed) ?? memberships?.[0] ?? null
  return { slug: fallback?.slug ?? null, slugInAddress: null, membership: fallback }
}

// Storage can be switched off (private windows); the app then simply starts in the first organisation.
function remember(slug: string) {
  try {
    localStorage.setItem(STORAGE_KEY, slug)
  } catch {
    /* nothing to do */
  }
}

function recall(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}
