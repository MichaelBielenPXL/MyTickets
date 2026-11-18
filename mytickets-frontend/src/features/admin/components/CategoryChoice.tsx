import type { Category } from '../types'

type CategoryChoiceProps = {
  categories: Category[]
  value: string | null
  onChange: (categoryId: string | null) => void
}

/** The tab an item shows under at the till. */
export function CategoryChoice({ categories, value, onChange }: CategoryChoiceProps) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Other</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  )
}
