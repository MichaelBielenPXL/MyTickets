import { t } from '@/lib/i18n'
import { money } from '@/utils/format'

import type { MenuProduct } from '../types'

/** One line of the order: an item and how many. */
export type TicketLine = { product: MenuProduct; count: number }

/**
 * One deposit (a cup) in the order: how many the drinks bring, how many the bartender added (positive)
 * or took back (negative), and the sum, which is what gets charged or given back.
 */
export type CupLine = { deposit: MenuProduct; withDrinks: number; adjusted: number; net: number }

/** What the Charge button says: the amount to charge, or to give back when more cups came back. */
export function chargeLabel(empty: boolean, totalCents: number) {
  if (empty) return t('Charge')
  if (totalCents < 0) return t('Give back {amount}', { amount: money(-totalCents) })
  return t('Charge {amount}', { amount: money(totalCents) })
}
