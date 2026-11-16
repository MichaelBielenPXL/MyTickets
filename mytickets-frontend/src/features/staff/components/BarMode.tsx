import { useRef, useState } from 'react'

import { CardReader } from '@/components'
import { ApiError } from '@/lib/api-client'
import { errorText, money } from '@/utils/format'

import { useChargeCard, useLookUpCard } from '../api/staff'
import type { ChargeResult, MenuProduct, Outcome } from '../types'
import { OutcomeBanner } from './OutcomeBanner'

type BarModeProps = {
  slug: string
  products: MenuProduct[]
  /** Called when the server says the menu is out of date. */
  onMenuChanged: () => void
}

type Counts = Record<string, number>

const HTTP_CONFLICT = 409

/**
 * Tap products to build an order, then tap the guest's card to charge it. Deposits (cups) can also
 * be taken back: what comes back is taken off the total, and anything left over goes onto the card.
 */
export function BarMode({ slug, products, onMenuChanged }: BarModeProps) {
  const [order, setOrder] = useState<Counts>({})
  const [returns, setReturns] = useState<Counts>({})
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  // One id per order: if the phone loses signal and the sale is sent again, the card is still charged once.
  const requestId = useRef(crypto.randomUUID())
  const charge = useChargeCard(slug)
  const lookUp = useLookUpCard(slug)

  const returnable = products.filter((product) => product.returnable)
  const bought = products.filter((product) => order[product.id] > 0)
  const returned = returnable.filter((product) => returns[product.id] > 0)
  const totalCents =
    bought.reduce((sum, product) => sum + product.priceCents * order[product.id], 0) -
    returned.reduce((sum, product) => sum + product.priceCents * returns[product.id], 0)
  const empty = bought.length === 0 && returned.length === 0
  const busy = charge.isPending || lookUp.isPending

  function change(setCounts: typeof setOrder, productId: string, by: number) {
    setCounts((current) => ({ ...current, [productId]: Math.max(0, (current[productId] ?? 0) + by) }))
    setOutcome(null)
  }

  function clear() {
    setOrder({})
    setReturns({})
  }

  function handleCard(cardUid: string) {
    if (busy) return
    if (empty) return showCredit(cardUid)

    // Something handed back travels as a negative quantity.
    const items = [
      ...bought.map((product) => ({ productId: product.id, quantity: order[product.id] })),
      ...returned.map((product) => ({ productId: product.id, quantity: -returns[product.id] })),
    ]
    charge.mutate(
      { cardUid, items, requestId: requestId.current },
      {
        onSuccess: (result) => {
          setOutcome(settled(result))
          clear()
          requestId.current = crypto.randomUUID()
          navigator.vibrate?.(80)
        },
        onError: (error) => {
          setOutcome({ ok: false, title: errorText(error) })
          navigator.vibrate?.([120, 80, 120])
          if (error instanceof ApiError && error.status === HTTP_CONFLICT) onMenuChanged()
        },
      },
    )
  }

  function showCredit(cardUid: string) {
    lookUp.mutate(cardUid, {
      onSuccess: (holder) =>
        setOutcome({
          ok: true,
          title: `${holder.name}: ${money(holder.balanceCents)}`,
          detail: 'Add products, then tap the card again to charge.',
        }),
      onError: (error) => setOutcome({ ok: false, title: errorText(error) }),
    })
  }

  if (products.length === 0) {
    return <p className="muted">No products yet. An admin can add them under Manage › Bar menu.</p>
  }
  return (
    <div className="stack">
      <OutcomeBanner outcome={outcome} />
      <div className="product-grid">
        {products.map((product) => (
          <button key={product.id} className="product" onClick={() => change(setOrder, product.id, 1)}>
            <strong>{product.name}</strong>
            <span>{money(product.priceCents)}</span>
            {order[product.id] > 0 && (
              <em aria-label={`${order[product.id]} in order`}>{order[product.id]}</em>
            )}
          </button>
        ))}
      </div>

      {returnable.length > 0 && (
        <section className="returns" aria-label="Returns">
          <h2>Handed back</h2>
          <div className="row wrap">
            {returnable.map((product) => (
              <button
                key={product.id}
                className="btn"
                onClick={() => change(setReturns, product.id, 1)}
                aria-label={`${product.name} back`}
              >
                {product.name} back · +{money(product.priceCents)}
              </button>
            ))}
          </div>
        </section>
      )}

      {!empty && (
        <div className="panel stack">
          {bought.map((product) => (
            <OrderLine
              key={product.id}
              text={`${order[product.id]}× ${product.name}`}
              amountCents={product.priceCents * order[product.id]}
              lessLabel={`One less ${product.name}`}
              onLess={() => change(setOrder, product.id, -1)}
            />
          ))}
          {returned.map((product) => (
            <OrderLine
              key={product.id}
              text={`${returns[product.id]}× ${product.name} back`}
              amountCents={-product.priceCents * returns[product.id]}
              lessLabel={`One less ${product.name} back`}
              onLess={() => change(setReturns, product.id, -1)}
            />
          ))}
          <div className="spread total">
            <strong>{totalCents < 0 ? 'Back onto the card' : 'Total'}</strong>
            <strong>{money(Math.abs(totalCents))}</strong>
          </div>
          <small className="muted">Member discounts are applied when the card is charged.</small>
          <button className="btn link" onClick={clear}>
            Clear order
          </button>
        </div>
      )}
      <CardReader disabled={busy} prompt={promptFor(empty, totalCents)} onCard={handleCard} />
    </div>
  )
}

type OrderLineProps = {
  text: string
  /** Negative for something handed back. */
  amountCents: number
  lessLabel: string
  onLess: () => void
}

function OrderLine({ text, amountCents, lessLabel, onLess }: OrderLineProps) {
  return (
    <div className="spread">
      <span>{text}</span>
      <span className="row">
        <span className={amountCents < 0 ? 'good amount' : 'amount'}>
          {amountCents < 0 && '−'}
          {money(Math.abs(amountCents))}
        </span>
        <button className="btn small" onClick={onLess} aria-label={lessLabel}>
          −
        </button>
      </span>
    </div>
  )
}

function promptFor(empty: boolean, totalCents: number) {
  if (empty) return 'Tap a card to see its credit'
  if (totalCents < 0) return `Tap card to give back ${money(-totalCents)}`
  return `Tap card to charge ${money(totalCents)}`
}

/** The server's answer is the truth: it knows the member's discount and the real prices. */
function settled(result: ChargeResult): Outcome {
  const balance = `${result.displayName} · ${money(result.balanceCents)}`
  if (result.totalCents < 0) {
    return { ok: true, title: `Gave back ${money(-result.totalCents)}`, detail: `${balance} on the card` }
  }
  return { ok: true, title: `Paid ${money(result.totalCents)}`, detail: `${balance} left` }
}
