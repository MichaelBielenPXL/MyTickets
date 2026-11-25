export interface Card {
  id: string
  /** The card's number, counting up from 1, e.g. "42". */
  number: string
  label: string
  blocked: boolean
  linkedAt: string
}

/** A tapped card as the person holding it sees it. */
export interface CardState {
  number: string
  state: 'mine' | 'free' | 'taken' | 'blocked'
  /** Whether they have a membership here; only members can link a card. */
  member: boolean
}
