import type { Tier } from '@/types'
import { money } from '@/utils/format'

/** What a membership type costs, in words: "Free", "€ 25,00 / year", "Free for 30 days". */
export function tierTerms(tier: Pick<Tier, 'priceCents' | 'durationDays'>): string {
  const free = tier.priceCents === 0
  if (tier.durationDays === null) return free ? 'Free' : money(tier.priceCents)

  const period = tier.durationDays === 365 ? 'year' : `${tier.durationDays} days`
  if (free) return `Free for ${period === 'year' ? 'a year' : period}`
  return `${money(tier.priceCents)} / ${period}`
}

/** "50% off tickets · 20% off at the bar", or an empty string when there is no discount. */
export function tierBenefits(tier: Pick<Tier, 'ticketDiscountPercent' | 'drinkDiscountPercent'>): string {
  const benefits = []
  if (tier.ticketDiscountPercent > 0) benefits.push(`${tier.ticketDiscountPercent}% off tickets`)
  if (tier.drinkDiscountPercent > 0) benefits.push(`${tier.drinkDiscountPercent}% off at the bar`)
  return benefits.join(' · ')
}
