import { HOUSE_COLOR, brandStyle, isLight } from './brand'

describe('brandStyle', () => {
  it('uses the house colour when the organisation has none', () => {
    expect(brandStyle(null)).toMatchObject({ '--brand': HOUSE_COLOR, '--brand-ink': '#ffffff' })
  })

  it('ignores anything that is not a #rrggbb colour', () => {
    expect(brandStyle('red')).toMatchObject({ '--brand': HOUSE_COLOR })
  })

  it('puts dark ink on light colours and white on dark ones', () => {
    expect(brandStyle('#C9B8A0')).toMatchObject({ '--brand': '#c9b8a0', '--brand-ink': '#16130f' })
    expect(brandStyle('#3d6b56')).toMatchObject({ '--brand-ink': '#ffffff' })
  })

  it('picks whichever ink contrasts more', () => {
    // Terracotta: white 4.4:1 against dark 4.2:1.
    expect(isLight('#c8553d')).toBe(false)
    expect(isLight('#767676')).toBe(false)
    expect(isLight('#8a8a8a')).toBe(true)
  })
})
