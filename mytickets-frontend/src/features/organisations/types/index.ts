import type { Role, Tier } from '@/types'

export interface OrganisationSummary {
  slug: string
  name: string
  description: string
  logoUrl: string | null
  joined: boolean
}

export interface MyMembership {
  role: Role
  tierId: string
  tier: string
  expiresAt: string | null
  active: boolean
  ticketDiscountPercent: number
  drinkDiscountPercent: number
}

export interface UpcomingEvent {
  id: string
  name: string
  location: string
  startsAt: string
  endsAt: string | null
  imageUrl: string | null
  fromPriceCents: number | null
  soldOut: boolean
}

export interface Organisation {
  slug: string
  name: string
  description: string
  logoUrl: string | null
  /** Null when the signed-in person has not joined. */
  membership: MyMembership | null
  balanceCents: number | null
  tiers: Tier[]
  hasInviteOnlyTiers: boolean
  events: UpcomingEvent[]
}

/** Either you are in, or you have to pay first at this address. */
export interface JoinResult {
  joined: boolean
  checkoutUrl: string | null
}
