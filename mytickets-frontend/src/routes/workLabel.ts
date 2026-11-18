import type { Role } from '@/types'

/** What the event-work link is called: a barman only sees the bar, a doorman only the door. */
export function workLabel(role: Role) {
  if (role === 'Barman') return 'Bar'
  if (role === 'Doorman') return 'Door'
  return 'Door & bar'
}
