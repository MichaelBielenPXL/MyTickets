import { endDate, tierBenefits, tierTerms } from './tier-terms'

const plain = (text: string) => text.replace(/\s/g, ' ')

describe('tierTerms', () => {
  it.each([
    [{ priceCents: 0, endsOn: null }, 'Free'],
    [{ priceCents: 2500, endsOn: null }, '€ 25,00'],
    [{ priceCents: 2500, endsOn: '2027-06-30' }, `€ 25,00 until ${endDate('2027-06-30')}`],
    [{ priceCents: 0, endsOn: '2027-06-30' }, `Free until ${endDate('2027-06-30')}`],
  ])('%j reads as %j', (tier, text) => {
    expect(plain(tierTerms(tier))).toBe(plain(text))
  })
})

describe('endDate', () => {
  it('writes the calendar day the European way, whatever the time zone', () => {
    expect(endDate('2027-06-30')).toBe('30/06/2027')
    expect(endDate('2027-01-01')).toBe('01/01/2027')
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
