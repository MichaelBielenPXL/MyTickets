/** Types shared by more than one feature. */

export type Role = 'Member' | 'Staff' | 'Admin'

/** A way of belonging to an organisation, as members see it. */
export interface Tier {
  id: string
  name: string
  description: string
  priceCents: number
  durationDays: number | null
  isPublic: boolean
  ticketDiscountPercent: number
  drinkDiscountPercent: number
}
