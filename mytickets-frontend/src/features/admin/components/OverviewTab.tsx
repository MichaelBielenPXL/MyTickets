import { useState } from 'react'

import { QueryResult } from '@/components'
import { t } from '@/lib/i18n'
import { dateOnly, dateTime, money, tokenPrice } from '@/utils/format'

import { useSummary } from '../api/admin'
import type { PaymentLine, PaymentPurpose, Summary } from '../types'
import { type PeriodChoice, periodOf } from '../utils/period'
import { Segmented } from './Segmented'
import { TakingsChart } from './TakingsChart'

type OverviewTabProps = {
  slug: string
}

const PERIODS: { value: PeriodChoice; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
]

const PURPOSES: Record<PaymentPurpose, string> = {
  Membership: 'Memberships',
  Tickets: 'Tickets',
  TopUp: 'Token top-ups online',
}

/**
 * What the organisation took in over a period, and what it actually gets paid: online payments with every
 * fee taken off, top-ups at the cashier, what the bar sold, tokens, memberships and tickets, and every payment.
 */
export function OverviewTab({ slug }: OverviewTabProps) {
  const [choice, setChoice] = useState<PeriodChoice>('month')
  const summary = useSummary(slug, periodOf(choice))

  return (
    <div className="overview stack">
      <Segmented label={t('Period')} options={PERIODS} value={choice} onChange={setChoice} />
      <QueryResult query={summary}>
        {(s) => (
          <>
            <PayoutHero s={s} />
            <MoneyTable s={s} />
            <TakingsChart byPeriod={s.byPeriod} />
            <div className="overview-grid">
              <BarCard s={s} />
              <TokensCard s={s} />
              <MembershipsCard s={s} />
              <TicketsCard s={s} />
              <BankPayoutsCard s={s} />
            </div>
            <PaymentsTable payments={s.payments} total={s.paymentsCount} />
          </>
        )}
      </QueryResult>
    </div>
  )
}

/** The headline: what is the organisation's, from online payments and from top-ups at the cashier. */
function PayoutHero({ s }: { s: Summary }) {
  const { payout, cash } = s
  return (
    <div className="overview-hero">
      <Metric
        label={t('You get from online payments')}
        value={money(payout.youGetCents)}
        note={t('Stripe pays it out to your bank account.')}
      />
      <Metric
        label={t('Top-ups at the cashier')}
        value={money(cash.cents)}
        note={t('{count} top-ups, cash or card', { count: cash.count })}
      />
      <Metric
        label={t('Bar takings')}
        value={tokenPrice(s.bar.takingsCents)}
        note={t('{count} sales, paid in tokens', { count: s.bar.sales })}
      />
      <Metric
        label={t('Active members')}
        value={String(s.memberships.active)}
        note={t('{count} joined or renewed in this period', { count: s.memberships.joined })}
      />
    </div>
  )
}

/** Where the money came from, and what came off it on the way: down to what reaches the organisation. */
function MoneyTable({ s }: { s: Summary }) {
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

function BarCard({ s }: { s: Summary }) {
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

function TokensCard({ s }: { s: Summary }) {
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

function MembershipsCard({ s }: { s: Summary }) {
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

function TicketsCard({ s }: { s: Summary }) {
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
function BankPayoutsCard({ s }: { s: Summary }) {
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

/** Every online payment in the period, newest first: what was paid, what came off, what the organisation gets. */
function PaymentsTable({ payments, total }: { payments: PaymentLine[]; total: number }) {
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

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <dl className="admin-card overview-metric">
      <dt>{label}</dt>
      <dd className="admin-kpi-number">{value}</dd>
      {note && <dd className="admin-card-note">{note}</dd>}
    </dl>
  )
}

function DataRow({ label, value, indent }: { label: string; value: string; indent?: boolean }) {
  return (
    <div className={indent ? 'admin-data-row indent' : 'admin-data-row'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

/** "− € 0,62"; a plain "€ 0,00" when nothing came off. */
const minus = (cents: number) => (cents > 0 ? `− ${money(cents)}` : money(0))
