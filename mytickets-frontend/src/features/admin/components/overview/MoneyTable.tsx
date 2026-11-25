import { t } from '@/lib/i18n'
import { money } from '@/utils/format'

import type { PaymentPurpose, Summary } from '../../types'
import { minus } from '../../utils/money'

const PURPOSES: Record<PaymentPurpose, string> = {
  Membership: 'Memberships',
  Tickets: 'Tickets',
  TopUp: 'Token top-ups online',
}

/** Where the money came from, and what came off it on the way: down to what reaches the organisation. */
export function MoneyTable({ s }: { s: Summary }) {
  const { payout, sources, cash } = s
  return (
    <section className="admin-card" aria-labelledby="money-title">
      <h3 id="money-title" className="admin-card-title">
        {t('What you get paid')}
      </h3>
      <p className="admin-card-note">
        {t(
          "Guests pay online through MyTickets. Each payment is passed on to your Stripe account minus MyTickets' fee, which includes the card costs Stripe charges, and minus what is set aside for Stripe's costs of paying you out: a fee on each payout to your bank and {fee} for every month with payouts. Those are paid in advance from a small buffer of {buffer}, which stays yours.",
          { fee: money(payout.monthlyAccountFeeCents), buffer: money(s.bankPayouts.targetBufferCents) },
        )}
      </p>
      <div className="admin-table-scroll">
        <table className="admin-table money-table">
          <thead>
            <tr>
              <th scope="col">{t('From')}</th>
              <th scope="col">{t('Payments')}</th>
              <th scope="col">{t('Guests paid')}</th>
              <th scope="col">{t('MyTickets fee')}</th>
              <th scope="col">{t('Set aside for payouts')}</th>
              <th scope="col">{t('You get')}</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.purpose}>
                <th scope="row">{t(PURPOSES[source.purpose])}</th>
                <td>{source.count}</td>
                <td>{money(source.paidCents)}</td>
                <td>{minus(source.feeCents)}</td>
                <td>{minus(source.accountFeeCents + source.payoutFeeCents)}</td>
                <td>
                  <strong>{money(source.netCents)}</strong>
                </td>
              </tr>
            ))}
            <tr>
              <th scope="row">{t('Top-ups at the cashier')}</th>
              <td>{cash.count}</td>
              <td>{money(cash.cents)}</td>
              <td>{minus(0)}</td>
              <td>{minus(0)}</td>
              <td>
                <strong>{money(cash.cents)}</strong>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{t('Total')}</th>
              <td>{sources.reduce((n, x) => n + x.count, 0) + cash.count}</td>
              <td>{money(payout.paidCents + cash.cents)}</td>
              <td>{minus(payout.feeCents)}</td>
              <td>{minus(payout.accountFeeCents + payout.payoutFeeCents)}</td>
              <td>
                <strong>{money(payout.youGetCents + cash.cents)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {payout.testCents > 0 && (
        <p className="admin-card-note">
          {t('{amount} was paid with the test checkout on this server: no real money.', {
            amount: money(payout.testCents),
          })}
        </p>
      )}
    </section>
  )
}
