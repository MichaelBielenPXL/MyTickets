import { t } from '@/lib/i18n'
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
        <h2>{t('Order')}</h2>
        <div className="row">
          <button className="till-ghost" onClick={props.onCheckCredit}>
            {t('Check tokens')}
          </button>
          {props.onClose && (
            <button className="till-ghost till-sheet-close" onClick={props.onClose}>
              {t('Done')}
            </button>
          )}
        </div>
      </header>
      {props.reader}

      <div className="till-lines">
        {empty && <p className="till-empty">{t('Tap items to start an order.')}</p>}
        {bought.map(({ product, count }) => (
          <div key={product.id} className="till-line">
            <span className="till-line-name">{product.name}</span>
            <span className="till-stepper">
              <button
                onClick={() => props.onLess(product.id)}
                aria-label={t('One less {name}', { name: product.name })}
              >
                −
              </button>
              <b>{count}</b>
              <button
                onClick={() => props.onAdd(product.id)}
                aria-label={t('One more {name}', { name: product.name })}
              >
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
                aria-label={t('Return a {name}', { name: line.deposit.name })}
              >
                −
              </button>
              <button
                onClick={() => props.onCups(line.deposit.id, 1)}
                aria-label={t('One more {name}', { name: line.deposit.name })}
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
        <span>{totalCents < 0 ? t('Back onto the card') : t('Total')}</span>
        <strong>{money(Math.abs(totalCents))}</strong>
      </div>
      <small className="till-note">{t('Member discounts are applied when the card is charged.')}</small>
      <button className="till-charge" disabled={empty} onClick={props.onCharge}>
        {chargeLabel(empty, totalCents)}
      </button>
      {!empty && (
        <button className="till-ghost till-clear" onClick={props.onClear}>
          {t('Clear order')}
        </button>
      )}
    </div>
  )
}

function cupTitle({ deposit, net }: CupLine) {
  if (net > 0) return `${net}× ${deposit.name}`
  if (net < 0) return t('{count}× {name} returned', { count: -net, name: deposit.name })
  return t('{name} swapped', { name: deposit.name })
}

/** Where the number comes from: "2 with drinks · 1 returned". */
function cupDetail({ withDrinks, adjusted }: CupLine) {
  const parts = []
  if (withDrinks > 0) parts.push(t('{count} with drinks', { count: withDrinks }))
  if (adjusted > 0) parts.push(t('{count} extra', { count: adjusted }))
  if (adjusted < 0) parts.push(t('{count} returned', { count: -adjusted }))
  return parts.join(' · ')
}
