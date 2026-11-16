import { tierBenefits, tierTerms } from './tier-terms'

const plain = (text: string) => text.replace(/\s/g, ' ')

describe('tierTerms', () => {
  it.each([
    [{ priceCents: 0, durationDays: null }, 'Free'],
    [{ priceCents: 2500, durationDays: null }, '€ 25,00'],
    [{ priceCents: 2500, durationDays: 365 }, '€ 25,00 / year'],
    [{ priceCents: 500, durationDays: 30 }, '€ 5,00 / 30 days'],
    [{ priceCents: 0, durationDays: 365 }, 'Free for a year'],
    [{ priceCents: 0, durationDays: 7 }, 'Free for 7 days'],
  ])('%j reads as %j', (tier, text) => {
    expect(plain(tierTerms(tier))).toBe(text)
  })
})

describe('tierBenefits', () => {
  it('lists only the discounts a membership has', () => {
    expect(tierBenefits({ ticketDiscountPercent: 50, drinkDiscountPercent: 20 })).toBe(
      '50% off tickets · 20% off at the bar',
    )
    expect(tierBenefits({ ticketDiscountPercent: 0, drinkDiscountPercent: 20 })).toBe('20% off at the bar')
    expect(tierBenefits({ ticketDiscountPercent: 0, drinkDiscountPercent: 0 })).toBe('')
  })
})
