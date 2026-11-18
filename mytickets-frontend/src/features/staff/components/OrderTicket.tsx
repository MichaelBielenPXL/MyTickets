import { money } from '@/utils/format'

import { type CupLine, type TicketLine, chargeLabel } from '../utils/till'

type OrderTicketProps = {
  bought: TicketLine[]
  /** One line per cup type in the order, adding up drinks' cups, extra cups and returns. */
  cupLines: CupLine[]
  totalCents: number
  onAdd: (productId: string) => void
  onLess: (productId: string) => void
  /** + buys one more cup, − takes one back. */
  onCups: (depositId: string, by: number) => void
  onClear: () => void
  onCharge: () => void
  onCheckCredit: () => void
  /** The card reader's switch, shown in the ticket's header. */
  reader: React.ReactNode
  /** On a phone, folds the ticket away again. */
  onClose?: () => void
}

/** The order on the right of the till (or in a sheet on a phone): its lines, cups, total and Charge. */
export function OrderTicket(props: OrderTicketProps) {
  const { bought, cupLines, totalCents } = props
  const empty = bought.length === 0 && cupLines.every((l) => l.adjusted === 0)

  return (
    <div className="till-ticket">
      <header className="till-ticket-head">
        <h2>Order</h2>
        <div className="row">
          <button className="till-ghost" onClick={props.onCheckCredit}>
            Check tokens
          </button>
          {props.onClose && (
            <button className="till-ghost till-sheet-close" onClick={props.onClose}>
              Done
            </button>
          )}
        </div>
      </header>
      {props.reader}

      <div className="till-lines">
        {empty && <p className="till-empty">Tap items to start an order.</p>}
        {bought.map(({ product, count }) => (
          <div key={product.id} className="till-line">
            <span className="till-line-name">{product.name}</span>
            <span className="till-stepper">
              <button onClick={() => props.onLess(product.id)} aria-label={`One less ${product.name}`}>
                −
              </button>
              <b>{count}</b>
              <button onClick={() => props.onAdd(product.id)} aria-label={`One more ${product.name}`}>
                +
              </button>
            </span>
            <span className="till-amount">{money(product.priceCents * count)}</span>
          </div>
        ))}
        {cupLines.map((line) => (
          <div key={line.deposit.id} className={line.net < 0 ? 'till-line cup returned' : 'till-line cup'}>
            <span className="till-line-name">
              {cupTitle(line)}
              <small>{cupDetail(line)}</small>
            </span>
            <span className="till-stepper">
              <button
                onClick={() => props.onCups(line.deposit.id, -1)}
                aria-label={`Return a ${line.deposit.name}`}
              >
                −
              </button>
              <button
                onClick={() => props.onCups(line.deposit.id, 1)}
                aria-label={`One more ${line.deposit.name}`}
              >
                +
              </button>
            </span>
            <span className="till-amount">
              {line.net < 0 && '−'}
              {money(Math.abs(line.net) * line.deposit.priceCents)}
            </span>
          </div>
        ))}
      </div>

      <div className="till-total">
        <span>{totalCents < 0 ? 'Back onto the card' : 'Total'}</span>
        <strong>{money(Math.abs(totalCents))}</strong>
      </div>
      <small className="till-note">Member discounts are applied when the card is charged.</small>
      <button className="till-charge" disabled={empty} onClick={props.onCharge}>
        {chargeLabel(empty, totalCents)}
      </button>
      {!empty && (
        <button className="till-ghost till-clear" onClick={props.onClear}>
          Clear order
        </button>
      )}
    </div>
  )
}

function cupTitle({ deposit, net }: CupLine) {
  if (net > 0) return `${net}× ${deposit.name}`
  if (net < 0) return `${-net}× ${deposit.name} returned`
  return `${deposit.name} swapped`
}

/** Where the number comes from: "2 with drinks · 1 returned". */
function cupDetail({ withDrinks, adjusted }: CupLine) {
  const parts = []
  if (withDrinks > 0) parts.push(`${withDrinks} with drinks`)
  if (adjusted > 0) parts.push(`${adjusted} extra`)
  if (adjusted < 0) parts.push(`${-adjusted} returned`)
  return parts.join(' · ')
}
