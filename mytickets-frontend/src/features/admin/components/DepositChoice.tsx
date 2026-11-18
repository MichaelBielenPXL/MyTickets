import type { Product } from '../types'

type DepositChoiceProps = {
  deposits: Product[]
  value: string | null
  onChange: (depositId: string | null) => void
  label?: string
}

/**
 * Which deposit (a cup) a drink comes with, or none. The till charges that cup with every one sold.
 * With no deposits yet, it says where to make one.
 */
export function DepositChoice({ deposits, value, onChange, label }: DepositChoiceProps) {
  return (
    <>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label={label}
        disabled={deposits.length === 0}
      >
        <option value="">No deposit</option>
        {deposits.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
            {d.active ? '' : ' (hidden)'}
          </option>
        ))}
      </select>
      {deposits.length === 0 && <small>Add a cup under Deposits below to choose it here.</small>}
    </>
  )
}
