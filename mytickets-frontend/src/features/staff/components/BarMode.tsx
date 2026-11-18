import { useCallback, useRef, useState } from 'react'

import { useCardTaps } from '@/components'
import { ApiError } from '@/lib/api-client'
import { errorText, money } from '@/utils/format'

import { useChargeCard, useLookUpCard } from '../api/staff'
import type { ChargeResult, MenuCategory, MenuProduct, Outcome } from '../types'
import { type CupLine, type TicketLine, chargeLabel } from '../utils/till'
import { ChargeScreen, type ChargeStep } from './ChargeScreen'
import { OrderTicket } from './OrderTicket'
import { TillTiles } from './TillTiles'

type BarModeProps = {
  slug: string
  products: MenuProduct[]
  categories: MenuCategory[]
  /** Called when the server says the menu is out of date. */
  onMenuChanged: () => void
}

type Counts = Record<string, number>

const HTTP_CONFLICT = 409

/**
 * The bar till, after Square and Lightspeed: coloured tiles under category tabs, the order ticket
 * beside them (a sheet on a phone), and a full-screen step to take the card.
 *
 * Cups: a drink that comes in a cup adds one by itself. The cup tiles buy a cup on its own or take an
 * empty one back, so an empty cup swapped for a new drink balances out to just the drink.
 *
 * With the card reader on, a card can also be tapped straight away: on an order it charges it, on an
 * empty order it shows the card's credit.
 */
export function BarMode({ slug, products, categories, onMenuChanged }: BarModeProps) {
  const [order, setOrder] = useState<Counts>({})
  // Cups on top of the ones the drinks bring: positive is a cup bought on its own, negative a cup handed back.
  const [cups, setCups] = useState<Counts>({})
  const [step, setStep] = useState<ChargeStep | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  // One id per order: if the phone loses signal and the sale is sent again, the card is still charged once.
  const requestId = useRef(crypto.randomUUID())
  const charge = useChargeCard(slug)
  const lookUp = useLookUpCard(slug)

  const deposits = products.filter((p) => p.isDeposit)
  const items = products.filter((p) => !p.isDeposit)
  const bought: TicketLine[] = items
    .filter((p) => order[p.id] > 0)
    .map((p) => ({ product: p, count: order[p.id] }))
  // Per deposit: the cups the drinks bring (the server adds the same, so nobody can leave them off),
  // plus or minus what the bartender tapped. Buying one and returning one cancels out.
  const cupLines: CupLine[] = deposits
    .map((d) => {
      const withDrinks = bought
        .filter((l) => l.product.depositProductId === d.id)
        .reduce((n, l) => n + l.count, 0)
      const adjusted = cups[d.id] ?? 0
      return { deposit: d, withDrinks, adjusted, net: withDrinks + adjusted }
    })
    .filter((l) => l.withDrinks > 0 || l.adjusted !== 0)
  const totalCents =
    bought.reduce((sum, l) => sum + l.product.priceCents * l.count, 0) +
    cupLines.reduce((sum, l) => sum + l.deposit.priceCents * l.net, 0)
  const empty = bought.length === 0 && cupLines.every((l) => l.adjusted === 0)
  const itemCount =
    bought.reduce((n, l) => n + l.count, 0) + cupLines.reduce((n, l) => n + Math.abs(l.adjusted), 0)
  const busy = charge.isPending || lookUp.isPending

  function changeItem(productId: string, by: number) {
    setOrder((current) => ({ ...current, [productId]: Math.max(0, (current[productId] ?? 0) + by) }))
  }

  function changeCups(depositId: string, by: number) {
    setCups((current) => ({ ...current, [depositId]: (current[depositId] ?? 0) + by }))
  }

  function clear() {
    setOrder({})
    setCups({})
  }

  function handleCard(cardUid: string) {
    if (busy) return
    const wantsCredit = step?.kind === 'waiting' ? step.purpose === 'credit' : empty
    if (wantsCredit) return showCredit(cardUid)

    // What the bartender entered: the drinks, and cups bought or returned on their own.
    // The server adds the cups the drinks come in.
    const lines = [
      ...bought.map((l) => ({ productId: l.product.id, quantity: l.count })),
      ...cupLines
        .filter((l) => l.adjusted !== 0)
        .map((l) => ({ productId: l.deposit.id, quantity: l.adjusted })),
    ]
    setStep({ kind: 'busy' })
    charge.mutate(
      { cardUid, items: lines, requestId: requestId.current },
      {
        onSuccess: (result) => {
          setStep({ kind: 'done', outcome: settled(result) })
          clear()
          setSheetOpen(false)
          requestId.current = crypto.randomUUID()
          navigator.vibrate?.(80)
        },
        onError: (error) => {
          setStep({ kind: 'done', outcome: { ok: false, title: errorText(error) } })
          navigator.vibrate?.([120, 80, 120])
          if (error instanceof ApiError && error.status === HTTP_CONFLICT) onMenuChanged()
        },
      },
    )
  }

  function showCredit(cardUid: string) {
    setStep({ kind: 'busy' })
    lookUp.mutate(cardUid, {
      onSuccess: (holder) =>
        setStep({
          kind: 'done',
          outcome: {
            ok: true,
            title: money(holder.balanceCents),
            detail: `${holder.name}${holder.membershipActive ? ` · ${holder.tier}` : ' · membership ended'}`,
          },
        }),
      onError: (error) => setStep({ kind: 'done', outcome: { ok: false, title: errorText(error) } }),
    })
  }

  const reader = useCardTaps(handleCard, busy)
  const close = useCallback(() => setStep(null), [])

  if (items.length === 0 && deposits.length === 0) {
    return <p className="muted">No products yet. An admin can add them under Manage › Bar menu.</p>
  }

  const readerSwitch = reader.supported ? (
    <div className="till-reader">
      {reader.listening ? (
        <span className="till-reader-on">
          <span className="pulse" /> Card reader on
        </span>
      ) : (
        <button className="till-ghost" onClick={reader.start}>
          Turn on card reader
        </button>
      )}
      {reader.problem && <small className="till-problem">{reader.problem}</small>}
    </div>
  ) : null

  return (
    <div className="till">
      <TillTiles
        items={items}
        deposits={deposits}
        categories={categories}
        counts={order}
        cups={cups}
        onAdd={(id) => changeItem(id, 1)}
        onRemove={(id) => changeItem(id, -1)}
        onCups={changeCups}
      />

      <aside className={sheetOpen ? 'till-side open' : 'till-side'} aria-label="Order">
        <OrderTicket
          bought={bought}
          cupLines={cupLines}
          totalCents={totalCents}
          onAdd={(id) => changeItem(id, 1)}
          onLess={(id) => changeItem(id, -1)}
          onCups={changeCups}
          onClear={clear}
          onCharge={() => setStep({ kind: 'waiting', purpose: 'charge', totalCents })}
          onCheckCredit={() => setStep({ kind: 'waiting', purpose: 'credit', totalCents: 0 })}
          reader={readerSwitch}
          onClose={() => setSheetOpen(false)}
        />
      </aside>

      {/* On a phone the ticket folds away into this bar. */}
      <div className="till-bar">
        <button className="till-bar-summary" onClick={() => setSheetOpen(true)}>
          {empty
            ? 'Order'
            : `${itemCount} item${itemCount === 1 ? '' : 's'} · ${money(Math.abs(totalCents))}`}
          <span aria-hidden="true">⌃</span>
        </button>
        <button
          className="till-charge"
          disabled={empty}
          onClick={() => setStep({ kind: 'waiting', purpose: 'charge', totalCents })}
        >
          {chargeLabel(empty, totalCents)}
        </button>
      </div>

      {step && (
        <ChargeScreen
          step={step}
          listening={reader.listening}
          onCard={handleCard}
          onClose={close}
          onRetry={() => setStep({ kind: 'waiting', purpose: 'charge', totalCents })}
        />
      )}
    </div>
  )
}

/** The server's answer is the truth: it knows the member's discount and the real prices. */
function settled(result: ChargeResult): Outcome {
  if (result.totalCents < 0) {
    return {
      ok: true,
      title: `Gave back ${money(-result.totalCents)}`,
      detail: `${result.displayName} · ${money(result.balanceCents)} on the card`,
    }
  }
  return {
    ok: true,
    title: `Paid ${money(result.totalCents)}`,
    detail: `${result.displayName} · ${money(result.balanceCents)} left`,
  }
}
