/** Types shared by more than one feature. */

/** Barmen work the bar, doormen the door; staff do both and take cash; admins also manage everything. */
export type Role = 'Member' | 'Barman' | 'Doorman' | 'Staff' | 'Admin'

/** A way of belonging to an organisation, as members see it. */
export interface Tier {
  id: string
  name: string
  description: string
  priceCents: number
  /** The last day memberships of this type are valid ("2027-06-30"), whenever people joined. Null: never ends. */
  endsOn: string | null
  isPublic: boolean
  /** An admin approves each person before the membership starts (and before paying for it). */
  requiresApproval: boolean
  ticketDiscountPercent: number
  drinkDiscountPercent: number
}
