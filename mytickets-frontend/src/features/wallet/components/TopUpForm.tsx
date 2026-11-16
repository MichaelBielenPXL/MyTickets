import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ErrorNote, Field } from '@/components'
import { money, parseEuro } from '@/utils/format'

import { useStartTopUp } from '../api/wallet'

type TopUpFormProps = {
  slug: string
  minCents: number
  maxCents: number
}

const QUICK_AMOUNTS = [10, 20, 40, 60]

export function TopUpForm({ slug, minCents, maxCents }: TopUpFormProps) {
  const [amount, setAmount] = useState('20')
  const [problem, setProblem] = useState('')
  const navigate = useNavigate()
  const startTopUp = useStartTopUp(slug)

  function submit(event: FormEvent) {
    event.preventDefault()
    const cents = parseEuro(amount)
    if (cents === null || cents < minCents || cents > maxCents) {
      return setProblem(`Enter an amount between ${money(minCents)} and ${money(maxCents)}.`)
    }
    setProblem('')
    startTopUp.mutate(cents, { onSuccess: ({ checkoutUrl }) => navigate(checkoutUrl) })
  }

  return (
    <form onSubmit={submit} className="stack panel topup-form">
      <h2>Top up</h2>
      <div className="amount-choices">
        {QUICK_AMOUNTS.map((euros) => (
          <button
            type="button"
            key={euros}
            className={amount === String(euros) ? 'btn chosen' : 'btn'}
            aria-pressed={amount === String(euros)}
            onClick={() => setAmount(String(euros))}
          >
            €{euros}
          </button>
        ))}
      </div>
      <Field label="Amount in euro">
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <ErrorNote>{problem}</ErrorNote>
      <ErrorNote error={startTopUp.error} />
      <button className="btn primary" disabled={startTopUp.isPending}>
        Top up
      </button>
    </form>
  )
}
