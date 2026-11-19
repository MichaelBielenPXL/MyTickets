import { BRAND_PRESETS, HOUSE_COLOR, brandStyle, isReadable, readableShade, whiteContrast } from './brand'

describe('brandStyle', () => {
  it('uses the house colour when the organisation has none', () => {
    expect(brandStyle(null)).toMatchObject({ '--brand': HOUSE_COLOR, '--brand-ink': '#ffffff' })
  })

  it('ignores anything that is not a #rrggbb colour', () => {
    expect(brandStyle('red')).toMatchObject({ '--brand': HOUSE_COLOR })
  })

  it('keeps a colour white text reads on, and darkens one it does not', () => {
    expect(brandStyle('#3D6B56')).toMatchObject({ '--brand': '#3d6b56', '--brand-ink': '#ffffff' })
    const sand = brandStyle('#c9b8a0')['--brand' as keyof object] as string
    expect(sand).not.toBe('#c9b8a0')
    expect(isReadable(sand)).toBe(true)
  })
})

describe('readableShade', () => {
  it('turns even white into a colour white text reads on', () => {
    expect(whiteContrast(readableShade('#ffffff'))).toBeGreaterThanOrEqual(4.5)
    expect(whiteContrast(readableShade('#ffff00'))).toBeGreaterThanOrEqual(4.5)
  })

  it('offers only ready-made colours that need no darkening', () => {
    for (const color of BRAND_PRESETS) expect(readableShade(color)).toBe(color)
  })
})
