import type {
  FieldMode,
  MemberDetails,
  MembershipPeriod,
  ProfileFieldName,
  ProfileValues,
} from '@/features/organisations'
import type { Role } from '@/types'

/** Upcoming until it starts or is opened early, open until it ends or is closed. Only open events let people in. */
export type EventStatus = 'Upcoming' | 'Open' | 'Closed'

export interface StaffEvent {
  id: string
  name: string
  startsAt: string
  status: EventStatus
}

export interface MenuProduct {
  id: string
  name: string
  priceCents: number
  /** A deposit, such as a reusable cup, that staff can take back for credit. */
  isDeposit: boolean
  /** For a drink: the deposit the server adds with every one sold. */
  depositProductId: string | null
  categoryId: string | null
  color: string | null
}

export interface MenuCategory {
  id: string
  name: string
}

/** What the door and bar screens need to start: tonight's events and the bar menu. */
/** The jobs at an event; each person only gets the ones their role does. */
export type StaffTask = 'Bar' | 'Door' | 'CashTopUp' | 'CheckCard' | 'MemberInfo'

export interface StaffContext {
  name: string
  tasks: StaffTask[]
  events: StaffEvent[]
  products: MenuProduct[]
  /** The tabs at the till, in order. Empty when the organisation uses none. */
  categories: MenuCategory[]
}

export interface CardHolder {
  name: string
  tier: string
  membershipActive: boolean
  expiresAt: string | null
  balanceCents: number
  drinkDiscountPercent: number
  /** Their membership, to look them up further under Members. */
  memberId: string
}

/** A member in the search results of the Members screen. */
export interface MemberSummary {
  id: string
  displayName: string
  email: string
  tier: string
  membershipActive: boolean
}

/** Everything staff and admins see about one member under Members. */
export interface MemberInfo extends MemberDetails {
  id: string
  displayName: string
  email: string
  role: Role
  tierId: string
  tier: string
  joinedAt: string
  expiresAt: string | null
  membershipActive: boolean
  balanceCents: number
  /** An admin let them link one more card within the year (a lost one). */
  extraCardAllowed: boolean
  /** Which details the organisation asks, and what they gave: for an admin's edit form. */
  fields: Record<ProfileFieldName, FieldMode>
  profile: ProfileValues
  cards: { number: string; label: string; blocked: boolean; linkedAt: string | null }[]
  /** Their memberships over the years, newest first. */
  history: MembershipPeriod[]
}

export interface CheckInRequest {
  eventId: string
  /** The ticket's QR code, or... */
  code?: string
  /** ...the card of the person who bought it. */
  cardUid?: string
}

export interface CheckInResult {
  name: string
  ticketType: string
  /** Other unused tickets on the same account, for friends arriving together. */
  remaining: number
}

export interface ChargeRequest {
  cardUid: string
  /** A negative quantity is something handed back. */
  items: { productId: string; quantity: number }[]
  /** Stays the same when a sale is sent again, so the card is charged once. */
  requestId: string
}

export interface ChargeResult {
  /** Negative when more was handed back than bought: that amount went onto the card. */
  totalCents: number
  /** The deposit part of the total: negative when more cups came back than went out. */
  depositCents: number
  balanceCents: number
  displayName: string
}

export interface CashTopUpRequest {
  cardUid: string
  amountCents: number
  requestId: string
}

/** What a staff screen shows after a tap: a green or a red banner. */
export interface Outcome {
  ok: boolean
  title: string
  detail?: string
}
