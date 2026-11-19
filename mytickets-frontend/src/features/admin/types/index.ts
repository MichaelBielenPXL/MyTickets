import type { EventStatus } from '@/features/staff'
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
  /** "#rrggbb", or null for the house colour. */
  brandColor: string | null
}

export type OrganisationSettingsInput = Pick<
  OrganisationSettings,
  'name' | 'description' | 'logoKey' | 'brandColor'
>

export interface Summary {
  members: number
  /** Money guests have paid that they can still spend. */
  creditOutstandingCents: number
  /** Bar takings, without deposits. */
  barRevenueCents: number
  /** Deposit money for cups that haven't come back yet: the guests' until they do. */
  depositsHeldCents: number
  onlineTopUpsCents: number
  cashTopUpsCents: number
  ticketRevenueCents: number
  /** What MyTickets kept on tickets paid online (card costs included). Wallet payments carry no fee. */
  ticketFeesCents: number
  /** What MyTickets kept on online top-ups. Cash top-ups carry no fee. */
  topUpFeesCents: number
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
  status: EventStatus
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

export interface Member extends MemberDetails {
  id: string
  displayName: string
  email: string
  role: Role
  tierId: string
  tier: string
  joinedAt: string
  expiresAt: string | null
  balanceCents: number
  /** An admin let them link one more card within the year (a lost one). */
  extraCardAllowed: boolean
}

/** What a member told the organisation when choosing a membership. Missing when not asked or not given. */
export interface MemberDetails {
  firstName: string | null
  lastName: string | null
  phone: string | null
  street: string | null
  postalCode: string | null
  city: string | null
  school: string | null
  faculty: string | null
  studyYear: string | null
}

/** Someone asking for a membership that needs approval. */
export interface JoinRequest extends MemberDetails {
  id: string
  status: 'Pending' | 'Approved'
  createdAt: string
  tierId: string
  tier: string
  priceCents: number
  displayName: string
  email: string
}

export interface Product {
  id: string
  name: string
  priceCents: number
  /** Inactive products stay in the list but are off the bar menu. */
  active: boolean
  sortOrder: number
  /** A deposit, such as a reusable cup: staff can take it back and the price returns to the wallet. */
  isDeposit: boolean
  /** For a drink: the deposit charged with every one sold. */
  depositProductId: string | null
  /** The tab it shows under at the till; null is "Other". */
  categoryId: string | null
  /** One of the till's tile colours (see TILE_COLORS); null is grey. */
  color: string | null
}

export type ProductInput = Omit<Product, 'id'>

/** A tab at the bar till: Beer, Soft drinks, Food... */
export interface Category {
  id: string
  name: string
}

/**
 * Where the organisation stands with Stripe, which takes its online payments and pays them out:
 * unavailable (the platform has no Stripe key), not-started, incomplete (Stripe still needs details),
 * pending (Stripe is checking them), active.
 */
export type PayoutStatus = 'unavailable' | 'not-started' | 'incomplete' | 'pending' | 'active'

export interface PayoutSetup {
  status: PayoutStatus
  /** How many things Stripe still asks for. */
  requirementsDue: number
  /** The platform's share: this percentage of every ticket (or top-up), at most feeMaxCentsPerItem each. */
  feePercent: number
  feeMaxCentsPerItem: number
}

/** A card the organisation issued, as Manage lists it. */
export interface AdminCard {
  id: string
  /** The number printed on it, e.g. "0042". */
  number: string
  /** The code in its link; null for cards linked before cards were issued. */
  code: string | null
  /** The link written to the chip and printed as its QR. */
  url: string | null
  /** The chip's serial number, once written. */
  uid: string | null
  locked: boolean
  blocked: boolean
  linkedTo: { name: string } | null
  createdAt: string
  writtenAt: string | null
  linkedAt: string | null
}

/** Whether cards can be written here: not before the site's real address is set, as it is locked onto each chip. */
export interface CardWriting {
  ready: boolean
  reason: string | null
}
