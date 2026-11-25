import { t } from '@/lib/i18n'
import { dateOnly, money, tokenPrice } from '@/utils/format'

import type { Summary } from '../../types'
import { DataRow } from './DataRow'

export function BarCard({ s }: { s: Summary }) {
  const { bar } = s
  return (
    <section className="admin-card" aria-labelledby="bar-title">
      <h3 id="bar-title" className="admin-card-title">
        {t('Bar')}
      </h3>
      <DataRow label={t('Sales')} value={String(bar.sales)} />
      <DataRow label={t('Takings')} value={tokenPrice(bar.takingsCents)} />
      <DataRow
        label={t('Average per sale')}
        value={bar.sales > 0 ? tokenPrice(Math.round(bar.takingsCents / bar.sales)) : '–'}
      />
      <DataRow label={t('Deposits taken')} value={tokenPrice(bar.depositsOutCents)} />
      <DataRow label={t('Deposits given back')} value={tokenPrice(bar.depositsBackCents)} />
      <p className="admin-card-note">
        {t('Guests pay the bar in tokens they bought earlier, so this money is already counted above.')}
      </p>
    </section>
  )
}
export function TokensCard({ s }: { s: Summary }) {
  const { tokens } = s
  return (
    <section className="admin-card" aria-labelledby="tokens-title">
      <h3 id="tokens-title" className="admin-card-title">
        {t('Tokens')}
      </h3>
      <DataRow label={t('Bought')} value={tokenPrice(tokens.boughtCents)} />
      <DataRow label={t('Paid for them')} value={money(tokens.paidCents)} />
      {tokens.bonusCents > 0 && (
        <DataRow label={t('Extra from top-up deals')} value={tokenPrice(tokens.bonusCents)} />
      )}
      <DataRow label={t('Spent at the bar')} value={tokenPrice(tokens.spentAtBarCents)} />
      <DataRow label={t('Spent on tickets')} value={tokenPrice(tokens.spentOnTicketsCents)} />
      <h4 className="overview-now">{t('Right now')}</h4>
      <DataRow label={t('Not yet spent')} value={tokenPrice(tokens.outstandingCents)} />
      <DataRow label={t('Deposits held')} value={tokenPrice(tokens.depositsHeldCents)} />
      <p className="admin-card-note">
        {t('Tokens not yet spent were paid for, but guests can still use them.')}
      </p>
    </section>
  )
}
export function MembershipsCard({ s }: { s: Summary }) {
  const { memberships } = s
  return (
    <section className="admin-card" aria-labelledby="memberships-title">
      <h3 id="memberships-title" className="admin-card-title">
        {t('Memberships')}
      </h3>
      <DataRow label={t('Active now')} value={String(memberships.active)} />
      <DataRow label={t('Joined or renewed')} value={String(memberships.joined)} />
      {memberships.byType.map((type) => (
        <DataRow key={type.name} label={type.name} value={String(type.active)} indent />
      ))}
    </section>
  )
}
export function TicketsCard({ s }: { s: Summary }) {
  const { tickets } = s
  return (
    <section className="admin-card" aria-labelledby="tickets-title">
      <h3 id="tickets-title" className="admin-card-title">
        {t('Tickets')}
      </h3>
      <DataRow label={t('Sold')} value={String(tickets.sold)} />
      <DataRow label={t('Worth')} value={money(tickets.revenueCents)} />
      <DataRow label={t('Checked in')} value={String(tickets.checkedIn)} />
      <p className="admin-card-note">
        {t('Tickets paid with tokens bring in no new money: the tokens were paid for when bought.')}
      </p>
    </section>
  )
}
/** Stripe's payouts to the bank in the period, each with the fee Stripe charged for it. */
export function BankPayoutsCard({ s }: { s: Summary }) {
  const { bankPayouts } = s
  return (
    <section className="admin-card" aria-labelledby="bank-payouts-title">
      <h3 id="bank-payouts-title" className="admin-card-title">
        {t('Payouts to your bank')}
      </h3>
      {bankPayouts.payouts.length === 0 ? (
        <p className="muted">{t('No payouts in this period.')}</p>
      ) : (
        <>
          {bankPayouts.payouts.map((p) => (
            <DataRow
              key={p.id}
              label={dateOnly(p.paidAt)}
              value={`${money(p.amountCents)} · ${t('fee {fee}', { fee: money(p.feeCents + p.accountFeeCents) })}`}
            />
          ))}
          <DataRow label={t('Paid out')} value={money(bankPayouts.amountCents)} />
          <DataRow label={t('Payout fees')} value={money(bankPayouts.feeCents)} />
        </>
      )}
      {bankPayouts.payouts.some((p) => p.accountFeeCents > 0) && (
        <p className="admin-card-note">
          {t(
            "The first payout of each month also carries Stripe's {fee} monthly fee for your payout account.",
            {
              fee: money(s.payout.monthlyAccountFeeCents),
            },
          )}
        </p>
      )}
      <DataRow label={t('Buffer for your next payouts')} value={money(bankPayouts.bufferCents)} />
      {bankPayouts.owedCents > 0 && (
        <p className="admin-card-note">
          {t('{amount} in payout costs comes off your next money.', { amount: money(bankPayouts.owedCents) })}
        </p>
      )}
    </section>
  )
}
