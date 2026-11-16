import { money, parseEuro, requireEuro, requireWholeNumber } from './format'

describe('parseEuro', () => {
  it.each([
    ['12,50', 1250],
    ['12.5', 1250],
    ['€ 7', 700],
    ['0', 0],
    [' 2,05 ', 205],
    // 0.1 + 0.2 style rounding must not lose a cent
    ['19,99', 1999],
  ])('reads %j as %i cents', (text, cents) => {
    expect(parseEuro(text)).toBe(cents)
  })

  it.each(['', 'abc', '12,345', '-5', '1e3', '12,50,00'])('refuses %j', (text) => {
    expect(parseEuro(text)).toBeNull()
  })
})

describe('form helpers', () => {
  it('explains how to write a price', () => {
    expect(() => requireEuro('cheap')).toThrow('Enter prices like 12,50.')
  })

  it('names the field a whole number is needed for', () => {
    expect(requireWholeNumber('100', 'the number of tickets')).toBe(100)
    expect(() => requireWholeNumber('1.5', 'the number of tickets')).toThrow('the number of tickets')
  })
})

describe('money', () => {
  it('writes cents the Belgian way', () => {
    // Intl puts a non-breaking space after the euro sign.
    expect(money(1250).replace(/\s/g, ' ')).toBe('€ 12,50')
    expect(money(-300).replace(/\s/g, ' ')).toContain('3,00')
  })
})
