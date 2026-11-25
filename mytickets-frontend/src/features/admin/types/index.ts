import type { MemberDetails } from '@/features/organisations'
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

export type PaymentPurpose = 'TopUp' | 'Tickets' | 'Membership'

/** One online payment, and what the organisation gets from it. Every paid payment counts as passed on. */
export interface PaymentLine {
  id: string
  paidAt: string
  purpose: PaymentPurpose
  description: string
  amountCents: number
  /** MyTickets' fee, Stripe's card costs included. */
  feeCents: number
  /** Only on payments from before payouts were tracked: their share of Stripe's monthly payout-account fee. */
  accountFeeCents: number
  /** Set aside for Stripe's payout costs. */
  payoutFeeCents: number
  /** What the organisation gets. */
  netCents: number
  /** Paid with the test checkout on a test server: no real money, and not in the totals. */
  test: boolean
}

/** Manage › Overview for one period: money in, what came off, what the organisation actually gets. */
export interface Summary {
  payout: {
    paidCents: number
    feeCents: number
    accountFeeCents: number
    payoutFeeCents: number
    /** What the organisation gets from online payments: paid minus every fee. */
    youGetCents: number
    testCents: number
    monthlyAccountFeeCents: number
  }
  /** Online payments per kind. */
  sources: {
    purpose: PaymentPurpose
    count: number
    paidCents: number
    feeCents: number
    accountFeeCents: number
    payoutFeeCents: number
    netCents: number
  }[]
  /** Stripe's payouts from the organisation's Stripe account to its bank, with Stripe's fee on each. */
  bankPayouts: {
    /** feeCents is Stripe's fee on the payout; accountFeeCents the month's account fee, on the month's first payout. */
    payouts: { id: string; paidAt: string; amountCents: number; feeCents: number; accountFeeCents: number }[]
    amountCents: number
    feeCents: number
    /** Right now: set aside for payout costs and not used yet. */
    bufferCents: number
    /** Right now: payout costs the next money still has to cover (after an unusually expensive month). */
    owedCents: number
    /** The buffer kept topped up for the next payouts. */
    targetBufferCents: number
  }
  /** Top-ups at the cashier (cash, or the organisation's own card terminal): no MyTickets fees. */
  cash: { count: number; cents: number }
  /** In tokens. Takings leave deposits out: those are the guests' until their cups come back. */
  bar: { sales: number; takingsCents: number; depositsOutCents: number; depositsBackCents: number }
  tokens: {
    boughtCents: number
    paidCents: number
    bonusCents: number
    spentAtBarCents: number
    spentOnTicketsCents: number
    /** Right now, whatever the period. */
    outstandingCents: number
    depositsHeldCents: number
  }
  memberships: { active: number; joined: number; byType: { name: string; active: number }[] }
  tickets: { sold: number; revenueCents: number; checkedIn: number }
  byPeriod: {
    unit: 'day' | 'month'
    points: { key: string; barCents: number; barSales: number; moneyInCents: number }[]
  }
  /** The newest payments (at most 200); paymentsCount says how many there were in all. */
  payments: PaymentLine[]
  paymentsCount: number
}

/** A period for the overview, as days on the local clock (both included). No dates: from the start until now. */
export interface Period {
  from?: string
  to?: string
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
  /** Stripe's monthly fee for the payout account, in months with payouts; paid by the organisation from its next money. */
  monthlyAccountFeeCents: number
  /** Stripe's fee on each payout to the bank (this percentage plus a fixed part), paid from the next money. */
  payoutFeePercent: number
  payoutFeeFixedCents: number
  /** Kept back from the organisation's money so payout costs are always paid in advance; stays theirs. */
  payoutBufferCents: number
}

/** A card the organisation issued, as Manage lists it. */
export interface AdminCard {
  id: string
  /** Its number, counting up from 1, e.g. "42". */
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

/** One side of a printed card: its background, the logo, and a line of the organisation's own. */
export interface CardSide {
  background: 'brand' | 'colour' | 'image'
  /** "#rrggbb" when the background is a colour of its own. */
  colour: string | null
  imageKey: string | null
  imageUrl?: string | null
  showLogo: boolean
  /** A short line, like "Lidkaart 2026–2027". */
  tagline: string
}

/** How the organisation's printed cards look. The back always carries the QR code and the name. */
export interface CardDesign {
  front: CardSide
  back: CardSide
}

export type { MemberDetails }
