import type { AdminCard } from '../types'

export type CardFilter = 'all' | 'unwritten' | 'ready' | 'linked' | 'blocked'

/** The filters above the card list, and the status names on each card. */
export const CARD_FILTERS: Record<CardFilter, string> = {
  all: 'All',
  unwritten: 'Not written',
  ready: 'Ready',
  linked: 'Linked',
  blocked: 'Blocked',
}

/** Blocked and nobody has it: lost and given up on. Out of the way until it turns up and is reused. */
export const isRetired = (card: AdminCard) => card.blocked && !card.linkedTo

/** Where a card is: made, written to a chip and waiting for a member, linked to someone, or blocked. */
export function statusOf(card: AdminCard): Exclude<CardFilter, 'all'> {
  if (card.blocked) return 'blocked'
  if (card.linkedTo) return 'linked'
  return card.uid ? 'ready' : 'unwritten'
}
