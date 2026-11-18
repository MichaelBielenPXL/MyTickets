import type { Tier } from '@/types'
import { calendarDay, money } from '@/utils/format'

/** "2027-06-30" -> "30/06/2027". */
export const endDate = calendarDay

/** What a membership type costs and how long it runs: "Free", "€ 25,00", "€ 25,00 until 30/06/2027". */
export function tierTerms(tier: Pick<Tier, 'priceCents' | 'endsOn'>): string {
  const price = tier.priceCents === 0 ? 'Free' : money(tier.priceCents)
  return tier.endsOn ? `${price} until ${endDate(tier.endsOn)}` : price
}

/** "50% off tickets · 20% off at the bar", or an empty string when there is no discount. */
export function tierBenefits(tier: Pick<Tier, 'ticketDiscountPercent' | 'drinkDiscountPercent'>): string {
  const benefits = []
  if (tier.ticketDiscountPercent > 0) benefits.push(`${tier.ticketDiscountPercent}% off tickets`)
  if (tier.drinkDiscountPercent > 0) benefits.push(`${tier.drinkDiscountPercent}% off at the bar`)
  return benefits.join(' · ')
}
