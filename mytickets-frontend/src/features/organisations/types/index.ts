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
  /** The organisation's own colour as "#rrggbb", or null for the house colour. */
  brandColor: string | null
  /** Null when the signed-in person has not joined. */
  membership: MyMembership | null
  balanceCents: number | null
  tiers: Tier[]
  hasInviteOnlyTiers: boolean
  events: UpcomingEvent[]
  /** An open request for a membership that needs approval, if any. */
  request: MembershipRequest | null
  /** Whether the details this organisation asks for are filled in. */
  profileComplete: boolean
}

export interface MembershipRequest {
  id: string
  tierId: string
  tier: string
  /** Pending: waiting for an admin. Approved: ready to start (after paying, if paid). Rejected: not this time. */
  status: 'Pending' | 'Approved' | 'Rejected'
  createdAt: string
}

/** Whether a detail is asked: not at all, if people want to give it, or always. */
export type FieldMode = 'Off' | 'Optional' | 'Required'

/** The details an organisation can ask for besides first and last name. */
export type ProfileFieldName = 'phone' | 'address' | 'school' | 'faculty' | 'studyYear'

export interface ProfileValues {
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

/** One stretch on one membership type, from the person's membership history. */
export interface MembershipPeriod {
  id: string
  tierName: string
  startedAt: string
  /** When it stopped or will stop; null when it never ends. */
  endsAt: string | null
  current: boolean
}

export interface ProfileForm {
  fields: Record<ProfileFieldName, FieldMode>
  profile: ProfileValues
  complete: boolean
  email: string
}

/** You are in; or you have to pay first at this address; or an admin has to approve you first. */
export interface JoinResult {
  joined: boolean
  pending: boolean
  checkoutUrl: string | null
}

/** What the member's QR code holds; staff scan it like a tap of their card. */
export interface MemberPass {
  code: string
  /** The code split into groups, for reading out or typing. */
  display: string
  appleWallet: boolean
  googleWallet: boolean
}
