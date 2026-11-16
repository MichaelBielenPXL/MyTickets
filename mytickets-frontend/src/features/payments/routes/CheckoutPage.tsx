import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErrorNote, QueryResult } from '@/components'
import { money } from '@/utils/format'

import { useFinishTestPayment, usePayment } from '../api/payments'
import type { Payment } from '../types'

/** Stand-in for a real payment page until a payment company is connected. */
export function CheckoutPage() {
  const { slug = '', paymentId = '' } = useParams()
  const navigate = useNavigate()
  const payment = usePayment(slug, paymentId)
  const finish = useFinishTestPayment(slug, paymentId)

  return (
    <main className="narrow">
      <h1>Checkout</h1>
      <QueryResult query={payment}>
        {(p) => (
          <div className="panel stack">
            <div className="spread">
              <span>{p.description}</span>
              <strong>{money(p.amountCents)}</strong>
            </div>
            <p className="muted">To {p.organisationName}</p>
            {p.status === 'Pending' ? (
              <>
                <p className="note warn-note">
                  Test checkout: no real money is taken. A payment company still has to be connected.
                </p>
                <ErrorNote error={finish.error} />
                <button
                  className="btn primary block"
                  disabled={finish.isPending}
                  onClick={() =>
                    finish.mutate('pay', { onSuccess: () => navigate(pageAfter(p), { replace: true }) })
                  }
                >
                  Pay {money(p.amountCents)}
                </button>
                <button
                  className="btn block"
                  disabled={finish.isPending}
                  onClick={() =>
                    finish.mutate('cancel', { onSuccess: () => navigate(pageAfter(p), { replace: true }) })
                  }
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <p className={p.status === 'Paid' ? 'note good-note' : 'note error'}>
                  {p.status === 'Paid'
                    ? 'This payment is complete.'
                    : 'This payment was cancelled or took too long.'}
                </p>
                <Link className="btn block" to={pageAfter(p)}>
                  Continue
                </Link>
              </>
            )}
          </div>
        )}
      </QueryResult>
    </main>
  )
}

/** Where the buyer goes next: to what they just paid for. */
function pageAfter(payment: Payment) {
  if (payment.purpose === 'Tickets') return `/${payment.organisationSlug}/tickets`
  if (payment.purpose === 'TopUp') return `/${payment.organisationSlug}/wallet`
  return `/${payment.organisationSlug}`
}
