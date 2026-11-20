import { useId } from 'react'

import { t } from '@/lib/i18n'

type SegmentedProps<T extends string> = {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

/** A row of options of which one is chosen, like iOS's segmented control. Real radio buttons underneath. */
export function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  const name = useId()
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label key={option.value} className={value === option.value ? 'chosen' : undefined}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          {t(option.label)}
        </label>
      ))}
    </div>
  )
}
