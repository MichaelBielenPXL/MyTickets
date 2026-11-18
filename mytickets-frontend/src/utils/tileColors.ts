/**
 * The colours an organisation can give an item's tile at the bar till. The keys are what the server
 * stores; each one has a fill for the dark till and a small swatch for the bar menu.
 */
export const TILE_COLORS = [
  { key: 'grey', label: 'Grey', fill: '#3f3f46' },
  { key: 'red', label: 'Red', fill: '#b91c1c' },
  { key: 'orange', label: 'Orange', fill: '#c2410c' },
  { key: 'yellow', label: 'Yellow', fill: '#a16207' },
  { key: 'green', label: 'Green', fill: '#15803d' },
  { key: 'teal', label: 'Teal', fill: '#0f766e' },
  { key: 'blue', label: 'Blue', fill: '#1d4ed8' },
  { key: 'indigo', label: 'Indigo', fill: '#4338ca' },
  { key: 'purple', label: 'Purple', fill: '#7e22ce' },
  { key: 'pink', label: 'Pink', fill: '#be185d' },
] as const

export type TileColor = (typeof TILE_COLORS)[number]['key']

/** The fill for a tile; items without a colour are grey. */
export function tileFill(color: string | null | undefined) {
  return (TILE_COLORS.find((c) => c.key === color) ?? TILE_COLORS[0]).fill
}
