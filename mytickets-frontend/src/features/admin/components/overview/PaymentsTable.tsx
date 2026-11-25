import { t } from '@/lib/i18n'
import { dateTime, money } from '@/utils/format'

import type { PaymentLine } from '../../types'
import { minus } from '../../utils/money'

/** Every online payment in the period, newest first: what was paid, what came off, what the organisation gets. */
export function PaymentsTable({ payments, total }: { payments: PaymentLine[]; total: number }) {
  return (
    <section className="admin-card" aria-labelledby="payments-title">
      <h3 id="payments-title" className="admin-card-title">
        {t('Payments')}
      </h3>
      {payments.length === 0 ? (
        <p className="muted">{t('No online payments in this period.')}</p>
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-table payments-table">
            <thead>
              <tr>
                <th scope="col">{t('Paid')}</th>
                <th scope="col">{t('For')}</th>
                <th scope="col">{t('Guest paid')}</th>
                <th scope="col">{t('MyTickets fee')}</th>
                <th scope="col">{t('Set aside for payouts')}</th>
                <th scope="col">{t('You get')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{dateTime(p.paidAt)}</td>
                  <td>
                    {p.description}
                    {p.test && <span className="tag">{t('Test')}</span>}
                  </td>
                  <td>{money(p.amountCents)}</td>
                  <td>{minus(p.feeCents)}</td>
                  <td>{minus(p.accountFeeCents + p.payoutFeeCents)}</td>
                  <td>
                    <strong>{money(p.netCents)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > payments.length && (
        <p className="admin-card-note">
          {t('The newest {shown} of {total} payments. The totals above count them all.', {
            shown: payments.length,
            total,
          })}
        </p>
      )}
    </section>
  )
}
