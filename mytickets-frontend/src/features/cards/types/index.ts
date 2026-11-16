export interface Card {
  id: string
  /** The card's serial number, upper-case without separators. */
  uid: string
  label: string
  blocked: boolean
  linkedAt: string
}
