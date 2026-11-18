import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { ErrorNote, QueryResult } from '@/components'
import { dateTime, money } from '@/utils/format'

import { useFinishTestPayment, usePayment } from '../api/payments'
import type { Payment } from '../types'

/**
 * Where a payment ends up. Buyers paying through Stripe arrive here when Stripe sends them back: this
 * page finds out how it went and confirms the order. Payments to the test checkout (developer machines
 * only) are paid right here with a button.
 */
export function CheckoutPage() {
  const { slug = '', paymentId = '' } = useParams()
  const [params] = useSearchParams()
  const payment = usePayment(slug, paymentId, params.get('cancelled') === '1')

  return (
    <main className="narrow checkout-page">
      <QueryResult query={payment}>
        {(p) =>
          p.provider === 'Fake' && p.status === 'Pending' ? (
            <TestCheckout payment={p} />
          ) : (
            <Outcome payment={p} />
          )
        }
      </QueryResult>
    </main>
  )
}

function Outcome({ payment: p }: { payment: Payment }) {
  if (p.status === 'Pending') {
    return (
      <section className="panel stack outcome" aria-live="polite">
        <span className="outcome-icon waiting" aria-hidden />
        <h1>Confirming your payment…</h1>
        <p className="muted">
          Your bank is still confirming the payment of {money(p.amountCents)}. This usually takes a few
          seconds. You don&apos;t need to pay again.
        </p>
        <Summary payment={p} />
        <p className="muted small-print">
          Closed this page? Your {whatFor(p)} will appear in your account as soon as the payment is confirmed.
        </p>
      </section>
    )
  }

  if (p.status === 'Paid') {
    return (
      <section className="panel stack outcome" aria-live="polite">
        <span className="outcome-icon done" aria-hidden>
          ✓
        </span>
        <h1>Payment received</h1>
        <p className="muted">Thank you. Your {whatFor(p)} are ready.</p>
        <Summary payment={p} />
        <Link className="btn primary block" to={pageAfter(p)}>
          {nextStep(p)}
        </Link>
      </section>
    )
  }

  return (
    <section className="panel stack outcome" aria-live="polite">
      <span className="outcome-icon failed" aria-hidden>
        ×
      </span>
      <h1>Payment not completed</h1>
      <p className="muted">
        The payment was cancelled, refused by the bank, or took too long. Nothing was charged
        {p.purpose === 'Tickets' ? ', and the tickets went back on sale' : ''}.
      </p>
      <Summary payment={p} />
      <Link className="btn primary block" to={tryAgain(p)}>
        Try again
      </Link>
    </section>
  )
}

function Summary({ payment: p }: { payment: Payment }) {
  return (
    <dl className="order-summary">
      <div>
        <dt>Order</dt>
        <dd>{p.description}</dd>
      </div>
      <div>
        <dt>Amount</dt>
        <dd>{money(p.amountCents)}</dd>
      </div>
      <div>
        <dt>To</dt>
        <dd>{p.organisationName}</dd>
      </div>
      <div>
        <dt>Date</dt>
        <dd>{dateTime(p.completedAt ?? p.createdAt)}</dd>
      </div>
      <div>
        <dt>Reference</dt>
        <dd>
          <code>{reference(p)}</code>
        </dd>
      </div>
    </dl>
  )
}

function TestCheckout({ payment: p }: { payment: Payment }) {
  const navigate = useNavigate()
  const finish = useFinishTestPayment(p.organisationSlug, p.id)
  const done = () => navigate(`/${p.organisationSlug}/checkout/${p.id}`, { replace: true })

  return (
    <section className="panel stack">
      <h1>Checkout</h1>
      <div className="spread">
        <span>{p.description}</span>
        <strong>{money(p.amountCents)}</strong>
      </div>
      <p className="muted">To {p.organisationName}</p>
      <p className="note warn-note">
        Test checkout: no real money is taken. On the live site buyers pay through Stripe instead.
      </p>
      <ErrorNote error={finish.error} />
      <button
        className="btn primary block"
        disabled={finish.isPending}
        onClick={() => finish.mutate('pay', { onSuccess: done })}
      >
        Pay {money(p.amountCents)}
      </button>
      <button
        className="btn block"
        disabled={finish.isPending}
        onClick={() => finish.mutate('cancel', { onSuccess: done })}
      >
        Cancel
      </button>
    </section>
  )
}

/** A short reference people can quote when they contact the organisers. */
function reference(payment: Payment) {
  return payment.id.replaceAll('-', '').slice(0, 8).toUpperCase()
}

function whatFor(payment: Payment) {
  if (payment.purpose === 'Tickets') return 'tickets'
  if (payment.purpose === 'TopUp') return 'tokens and history'
  return 'membership benefits'
}

function nextStep(payment: Payment) {
  if (payment.purpose === 'Tickets') return 'View my tickets'
  if (payment.purpose === 'TopUp') return 'View my tokens'
  return `Go to ${payment.organisationName}`
}

/** Where the buyer goes next: to what they just paid for. */
function pageAfter(payment: Payment) {
  if (payment.purpose === 'Tickets') return `/${payment.organisationSlug}/tickets`
  if (payment.purpose === 'TopUp') return `/${payment.organisationSlug}/wallet`
  return `/${payment.organisationSlug}`
}

/** Back to where the buyer started, to try once more. */
function tryAgain(payment: Payment) {
  if (payment.purpose === 'TopUp') return `/${payment.organisationSlug}/wallet`
  return `/${payment.organisationSlug}`
}
