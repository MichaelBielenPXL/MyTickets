import { TILE_COLORS } from '@/utils/tileColors'

type ColourPickerProps = {
  value: string | null
  onChange: (color: string) => void
}

/** The tile colour at the till, as a row of swatches. */
export function ColourPicker({ value, onChange }: ColourPickerProps) {
  const chosen = value ?? 'grey'
  return (
    <fieldset className="colour-picker">
      <legend>Tile colour</legend>
      <div className="swatches">
        {TILE_COLORS.map((c) => (
          <label key={c.key} className="swatch" style={{ background: c.fill }} title={c.label}>
            <input
              type="radio"
              name="tile-colour"
              value={c.key}
              checked={chosen === c.key}
              onChange={() => onChange(c.key)}
              aria-label={c.label}
            />
          </label>
        ))}
      </div>
    </fieldset>
  )
}
