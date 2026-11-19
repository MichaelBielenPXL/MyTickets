import { useRef, useState } from 'react'

import { CardReader, Field } from '@/components'
import { t } from '@/lib/i18n'
import { errorText, money, parseEuro } from '@/utils/format'
import { cardIdFromQr } from '@/utils/qr'

import { useCashTopUp } from '../api/staff'
import type { Outcome } from '../types'
import { OutcomeBanner } from './OutcomeBanner'
import { ScanQrButton } from './ScanQrButton'

type CashTopUpModeProps = {
  slug: string
}

const QUICK_AMOUNTS = [5, 10, 20, 50]
const MIN_CENTS = 100

/**
 * A guest hands over cash and gets that amount as credit on their card, found by a tap, the member QR
 * code (app or wallet), or the QR printed on the card.
 */
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
      return setOutcome({ ok: false, title: t('Enter the amount first.') })

    topUp.mutate(
      { cardUid, amountCents: cents, requestId: requestId.current },
      {
        onSuccess: (result) => {
          setOutcome({
            ok: true,
            title: t('Added {amount}', { amount: money(cents) }),
            detail: t('{name} · {amount} on the card', {
              name: result.displayName,
              amount: money(result.balanceCents),
            }),
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
      <p className="muted">{t("Take the cash first, then tap the guest's card or scan their QR code.")}</p>
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
      <Field label={t('Amount in euro')}>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <ScanQrButton
        onScan={(payload) => handleCard(cardIdFromQr(payload))}
        disabled={topUp.isPending}
        cameraProblem={t(
          'The camera could not start. Allow camera access for this site, or type the card number.',
        )}
      />
      <CardReader
        disabled={topUp.isPending}
        prompt={cents ? t('Tap card to add {amount}', { amount: money(cents) }) : t('Enter an amount')}
        onCard={handleCard}
      />
    </div>
  )
}
