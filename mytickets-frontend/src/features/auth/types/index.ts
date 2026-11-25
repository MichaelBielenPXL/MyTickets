import type { Role } from '@/types'

/**
 * The person's record at one organisation they joined (or run): their details, membership, tokens and cards there.
 * They sign in with their one MyTickets account; each organisation keeps its own record of them.
 */
export interface Membership {
  slug: string
  name: string
  logoUrl: string | null
  /** Null while the person has started joining but has not picked a membership yet. */
  role: Role | null
  tier: string | null
  expiresAt: string | null
  userId: string
  email: string
  displayName: string
}

/** The MyTickets account this browser is signed in with. */
export interface Me {
  id: string
  email: string
  displayName: string
  /** Runs at least one organisation. */
  isOwner: boolean
  canCreateOrganisations: boolean
  /** Their record at each organisation they joined or run. */
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
