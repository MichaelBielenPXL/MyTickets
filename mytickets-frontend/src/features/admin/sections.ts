/** The parts of Manage, in the order they are listed (in Manage itself and in the sidebar). */
export const ADMIN_SECTIONS = {
  overview: 'Overview',
  events: 'Events',
  memberships: 'Memberships',
  members: 'Members',
  cards: 'Cards',
  tokens: 'Token prices',
  bar: 'Bar menu',
  payouts: 'Payouts',
  settings: 'Settings',
} as const

export type AdminSection = keyof typeof ADMIN_SECTIONS

/** The section in an address's ?tab=, or the overview. */
export function sectionFrom(tab: string | null): AdminSection {
  return tab && tab in ADMIN_SECTIONS ? (tab as AdminSection) : 'overview'
}
