export interface TicketType {
  id: string
  name: string
  priceCents: number
  /** The price after this member's discount. */
  yourPriceCents: number
  available: number
  maxPerUser: number
  salesStartAt: string | null
  salesEndAt: string | null
  onSale: boolean
  /** Only included by the authenticated member endpoint. */
  allowedForYou?: boolean
  membersOnly: boolean
  /** How many of these the signed-in person already has. */
  /** Only included by the authenticated member endpoint. */
  owned?: number
}

export interface EventDetail {
  id: string
  name: string
  description: string
  location: string
  startsAt: string
  endsAt: string | null
  imageUrl: string | null
  ticketTypes: TicketType[]
}

export interface OrderRequest {
  items: { ticketTypeId: string; quantity: number }[]
  payWith: 'online' | 'wallet'
}

export interface OrderResult {
  /** Where to pay, or null when the tickets are already yours (free, or paid with credit). */
  checkoutUrl: string | null
}
