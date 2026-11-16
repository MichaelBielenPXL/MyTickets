export interface StaffEvent {
  id: string
  name: string
  startsAt: string
}

export interface MenuProduct {
  id: string
  name: string
  priceCents: number
  /** A deposit, such as a reusable cup, that staff can take back for credit. */
  returnable: boolean
}

/** What the door and bar screens need to start: tonight's events and the bar menu. */
export interface StaffContext {
  name: string
  events: StaffEvent[]
  products: MenuProduct[]
}

export interface CardHolder {
  name: string
  tier: string
  membershipActive: boolean
  expiresAt: string | null
  balanceCents: number
  drinkDiscountPercent: number
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
