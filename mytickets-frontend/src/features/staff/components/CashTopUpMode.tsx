import { useRef, useState } from 'react'

import { CardReader, Field } from '@/components'
import { errorText, money, parseEuro } from '@/utils/format'

import { useCashTopUp } from '../api/staff'
import type { Outcome } from '../types'
import { OutcomeBanner } from './OutcomeBanner'

type CashTopUpModeProps = {
  slug: string
}

const QUICK_AMOUNTS = [5, 10, 20, 50]
const MIN_CENTS = 100

/** A guest hands over cash and gets that amount as credit on their card. */
export function CashTopUpMode({ slug }: CashTopUpModeProps) {
  const [amount, setAmount] = useState('10')
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  // Reused if the same top-up has to be sent again, so the credit is added once.
  const requestId = useRef(crypto.randomUUID())
  const topUp = useCashTopUp(slug)

  const cents = parseEuro(amount)

  function handleCard(cardUid: string) {
    if (topUp.isPending) return
    if (cents === null || cents < MIN_CENTS)
      return setOutcome({ ok: false, title: 'Enter the amount first.' })

    topUp.mutate(
      { cardUid, amountCents: cents, requestId: requestId.current },
      {
        onSuccess: (result) => {
          setOutcome({
            ok: true,
            title: `Added ${money(cents)}`,
            detail: `${result.displayName} · ${money(result.balanceCents)} on the card`,
          })
          requestId.current = crypto.randomUUID()
        },
        onError: (error) => setOutcome({ ok: false, title: errorText(error) }),
      },
    )
  }

  function choose(euros: number) {
    setAmount(String(euros))
    setOutcome(null)
  }

  return (
    <div className="stack">
      <p className="muted">Take the cash first, then tap the guest's card.</p>
      <OutcomeBanner outcome={outcome} />
      <div className="row wrap">
        {QUICK_AMOUNTS.map((euros) => (
          <button
            key={euros}
            className={amount === String(euros) ? 'btn chosen' : 'btn'}
            aria-pressed={amount === String(euros)}
            onClick={() => choose(euros)}
          >
            €{euros}
          </button>
        ))}
      </div>
      <Field label="Amount in euro">
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <CardReader
        disabled={topUp.isPending}
        prompt={cents ? `Tap card to add ${money(cents)}` : 'Enter an amount'}
        onCard={handleCard}
      />
    </div>
  )
}
