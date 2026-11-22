import type { Period } from '../types'

/** The periods the overview offers. */
export type PeriodChoice = 'month' | 'lastMonth' | 'year' | 'all'

/** "2026-11-22" on this device's clock. */
const day = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** The days a period covers, on this device's clock: this month runs until today. */
export function periodOf(choice: PeriodChoice, today = new Date()): Period {
  const y = today.getFullYear()
  const m = today.getMonth()
  switch (choice) {
    case 'month':
      return { from: day(new Date(y, m, 1)), to: day(today) }
    case 'lastMonth':
      return { from: day(new Date(y, m - 1, 1)), to: day(new Date(y, m, 0)) }
    case 'year':
      return { from: day(new Date(y, 0, 1)), to: day(today) }
    case 'all':
      return {}
  }
}
