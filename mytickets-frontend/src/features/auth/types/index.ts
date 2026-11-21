import type { Role } from '@/types'

/**
 * An account at one organisation. Accounts are not shared: the same person has a separate one,
 * with its own tickets, credit and cards, at every organisation they signed up at.
 */
export interface Membership {
  slug: string
  name: string
  logoUrl: string | null
  /** Null while the person has an account there but has not picked a membership yet. */
  role: Role | null
  tier: string | null
  expiresAt: string | null
  userId: string
  email: string
  displayName: string
}

/** Everything this browser is signed in as. */
export interface Me {
  email: string
  displayName: string
  /** An organiser's login, which opens every organisation they created. */
  isOwner: boolean
  canCreateOrganisations: boolean
  /** One entry per organisation this browser is signed in to. */
  memberships: Membership[]
}

export interface Credentials {
  email: string
  password: string
  /** Only used when creating an account. */
  displayName?: string
  /** Required for a new platform-level organiser account. */
  organisationName?: string
  /** Set when registering as a member from an existing organisation page. */
  joinOrganisationSlug?: string
  /** Set when signing in on an organisation's page: the account at that organisation. */
  organisationSlug?: string
  /** Creating an account: agreed to the terms of service and privacy policy. Required by the server. */
  acceptTerms?: boolean
}

export interface AuthResult {
  id: string
  email?: string
  displayName?: string
  organisationSlug?: string
}
