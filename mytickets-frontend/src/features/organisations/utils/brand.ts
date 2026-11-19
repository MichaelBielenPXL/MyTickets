import type { CSSProperties } from 'react'

/** The colour an organisation gets until it picks its own: deep graphite, like a black card. */
export const HOUSE_COLOR = '#1c1c1e'

/** White text on the colour must reach this contrast ratio (WCAG AA for normal text). */
export const MIN_CONTRAST = 4.5

/** Ready-made colours for the settings form, all dark enough for white text; any other such #rrggbb works too. */
export const BRAND_PRESETS = [
  '#1c1c1e',
  '#0b3d2e',
  '#3d6b56',
  '#14365d',
  '#3730a3',
  '#6b21a8',
  '#9f1239',
  '#b04c35',
  '#946a1a',
  '#7a6650',
] as const

const HEX = /^#[0-9a-f]{6}$/i

export const isBrandColor = (value: string) => HEX.test(value)

/** How well white text reads on this colour, as a WCAG contrast ratio (1 to 21). */
export function whiteContrast(hex: string) {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
  return 1.05 / (luminance + 0.05)
}

export const isReadable = (hex: string) => whiteContrast(hex) >= MIN_CONTRAST

/**
 * The colour itself when white text reads on it, else the nearest darker shade where it does. The
 * settings refuse colours that are too light; this is the safety net for anything that slips through.
 */
export function readableShade(hex: string) {
  for (let darken = 0; darken <= 100; darken += 2) {
    const shade =
      '#' +
      [1, 3, 5]
        .map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - darken / 100)))
        .map((c) => c.toString(16).padStart(2, '0'))
        .join('')
    if (isReadable(shade)) return shade
  }
  return '#000000'
}

/** The CSS variables that paint an organisation's pages: its colour, always with white text on it. */
export function brandStyle(color: string | null | undefined): CSSProperties {
  const brand = readableShade(color && isBrandColor(color) ? color.toLowerCase() : HOUSE_COLOR)
  return { '--brand': brand, '--brand-ink': '#ffffff' } as CSSProperties
}
