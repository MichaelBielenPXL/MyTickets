import type { CSSProperties } from 'react'

/** The colour an organisation gets until it picks its own: deep graphite, like a black card. */
export const HOUSE_COLOR = '#1c1c1e'

/** Ready-made colours for the settings form; any other #rrggbb works too. */
export const BRAND_PRESETS = [
  '#1c1c1e',
  '#0b3d2e',
  '#3d6b56',
  '#14365d',
  '#3730a3',
  '#6b21a8',
  '#9f1239',
  '#c8553d',
  '#b7791f',
  '#c9b8a0',
] as const

const HEX = /^#[0-9a-f]{6}$/i

export const isBrandColor = (value: string) => HEX.test(value)

/**
 * The CSS variables that paint an organisation's pages: its colour, and the ink that reads on it.
 * Light colours (sand, gold) get dark ink; everything else white.
 */
export function brandStyle(color: string | null | undefined): CSSProperties {
  const brand = color && isBrandColor(color) ? color.toLowerCase() : HOUSE_COLOR
  return { '--brand': brand, '--brand-ink': isLight(brand) ? '#16130f' : '#ffffff' } as CSSProperties
}

/** Whether dark text contrasts more than white on this colour (WCAG relative luminance). */
export function isLight(hex: string) {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
  // Whichever ink contrasts more wins; past this point dark ink beats white.
  return luminance > 0.195
}
