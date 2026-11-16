import type { Role, Tier } from '@/types'

/** A picture that was uploaded: `key` is what gets saved, `url` is where to show it from. */
export interface StoredImage {
  key: string
  url: string
}

/** The organisation as its admins edit it. */
export interface OrganisationSettings {
  slug: string
  name: string
  description: string
  logoKey: string | null
  logoUrl: string | null
}

export type OrganisationSettingsInput = Pick<OrganisationSettings, 'name' | 'description' | 'logoKey'>

export interface Summary {
  members: number
  /** Money guests have paid that they can still spend. */
  creditOutstandingCents: number
  barRevenueCents: number
  onlineTopUpsCents: number
  cashTopUpsCents: number
  ticketRevenueCents: number
}

export interface AdminTier extends Tier {
  inviteCode: string | null
  /** Closed to new members; existing members keep it. */
  archived: boolean
  members: number
}

export type TierInput = Omit<AdminTier, 'id' | 'members'>

export interface AdminTicketType {
  id: string
  name: string
  priceCents: number
  capacity: number
  sold: number
  maxPerUser: number
  salesStartAt: string | null
  salesEndAt: string | null
  /** Empty means every member may buy. */
  allowedTierIds: string[]
  checkedIn: number
}

export type TicketTypeInput = Omit<AdminTicketType, 'id' | 'sold' | 'checkedIn'>

export interface AdminEvent {
  id: string
  name: string
  description: string
  location: string
  startsAt: string
  endsAt: string | null
  published: boolean
  imageKey: string | null
  imageUrl: string | null
  ticketTypes: AdminTicketType[]
}

export interface EventInput {
  name: string
  description: string
  location: string
  startsAt: string | null
  endsAt: string | null
  published: boolean
  imageKey: string | null
}

export interface Member {
  id: string
  displayName: string
  email: string
  role: Role
  tierId: string
  tier: string
  joinedAt: string
  expiresAt: string | null
  balanceCents: number
}

export interface Product {
  id: string
  name: string
  priceCents: number
  /** Inactive products stay in the list but are off the bar menu. */
  active: boolean
  sortOrder: number
  /** A deposit, such as a reusable cup: staff can take it back and the price returns to the wallet. */
  returnable: boolean
}

export type ProductInput = Omit<Product, 'id'>
