import { type FormEvent, useState } from 'react'

import { ErrorNote, Field } from '@/components'
import { useGoToCheckout } from '@/hooks/useGoToCheckout'
import { t } from '@/lib/i18n'
import { money, parseEuro, tokenAmount, tokens } from '@/utils/format'

import { useStartTopUp } from '../api/wallet'
import type { TopUpDeal } from '../types'

type TopUpFormProps = {
  slug: string
  minCents: number
  maxCents: number
  /** The organisation's own top-ups, and then the only ones. Without them, any amount at one token per euro. */
  deals?: TopUpDeal[]
}

const QUICK_AMOUNTS = [10, 20, 40, 60]

export function TopUpForm({ slug, minCents, maxCents, deals = [] }: TopUpFormProps) {
  // One of the organisation's deals when it has them; otherwise an amount typed (or a quick amount).
  const hasDeals = deals.length > 0
  const [dealId, setDealId] = useState<string | null>(deals[0]?.id ?? null)
  const [amount, setAmount] = useState('20')
  const [problem, setProblem] = useState('')
  const goToCheckout = useGoToCheckout()
  const startTopUp = useStartTopUp(slug)
  const deal = deals.find((d) => d.id === dealId) ?? null
  const chosenCents = parseEuro(amount)

  function submit(event: FormEvent) {
    event.preventDefault()
    const onSuccess = ({ checkoutUrl }: { checkoutUrl: string }) => goToCheckout(checkoutUrl)
    if (hasDeals) {
      if (!deal) return
      setProblem('')
      return startTopUp.mutate({ dealId: deal.id }, { onSuccess })
    }
    const cents = parseEuro(amount)
    if (cents === null || cents < minCents || cents > maxCents) {
      return setProblem(
        t('Enter an amount between {min} and {max}.', { min: money(minCents), max: money(maxCents) }),
      )
    }
    setProblem('')
    startTopUp.mutate({ amountCents: cents }, { onSuccess })
  }

  return (
    <form onSubmit={submit} className="stack panel topup-form">
      <h2>{t('Buy tokens')}</h2>
      <div className="amount-choices">
        {hasDeals
          ? deals.map((d) => (
              <button
                type="button"
                key={d.id}
                className={d.id === dealId ? 'btn deal chosen' : 'btn deal'}
                aria-pressed={d.id === dealId}
                aria-label={t('{tokens} for {price}', {
                  tokens: tokens(d.tokensCents),
                  price: money(d.priceCents),
                })}
                onClick={() => setDealId(d.id)}
              >
                <strong>{tokenAmount(d.tokensCents)} Tokens</strong>
                <span>{money(d.priceCents)}</span>
                {d.tokensCents > d.priceCents && (
                  <em className="deal-bonus">
                    {t('+{tokens} free', { tokens: tokens(d.tokensCents - d.priceCents) })}
                  </em>
                )}
              </button>
            ))
          : QUICK_AMOUNTS.map((euros) => (
              <button
                type="button"
                key={euros}
                className={amount === String(euros) ? 'btn chosen' : 'btn'}
                aria-pressed={amount === String(euros)}
                onClick={() => setAmount(String(euros))}
              >
                {euros} Tokens
              </button>
            ))}
      </div>
      {!hasDeals && (
        <Field label={t('Amount in euro')}>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      )}
      <ErrorNote>{problem}</ErrorNote>
      <ErrorNote error={startTopUp.error} />
      <button
        className="btn primary"
        disabled={startTopUp.isPending || (hasDeals ? !deal : amount.trim() === '')}
      >
        {hasDeals && deal
          ? t('Pay {price} for {tokens}', { price: money(deal.priceCents), tokens: tokens(deal.tokensCents) })
          : chosenCents === null
            ? t('Buy tokens')
            : t('Pay {price} for {tokens}', { price: money(chosenCents), tokens: tokens(chosenCents) })}
      </button>
    </form>
  )
}
