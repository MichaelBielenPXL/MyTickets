import { ErrorNote, QueryResult } from '@/components'
import { t } from '@/lib/i18n'
import { money } from '@/utils/format'

import { usePayoutSetup, useStripeLink } from '../api/admin'
import type { PayoutSetup } from '../types'

type PayoutsTabProps = {
  slug: string
}

/**
 * Online payments go through Stripe. The organisation signs up once on Stripe's own pages (name,
 * address, ID and the bank account to be paid on); after that Stripe pays out by itself.
 */
export function PayoutsTab({ slug }: PayoutsTabProps) {
  const setup = usePayoutSetup(slug)
  const link = useStripeLink(slug)

  function goTo(to: 'onboarding' | 'dashboard') {
    // Stripe's pages are another site, so this leaves the app; Stripe sends the admin back here afterwards.
    link.mutate(to, { onSuccess: ({ url }) => window.location.assign(url) })
  }

  return (
    <QueryResult query={setup}>
      {(s) => (
        <section className="panel stack payouts">
          <Status setup={s} />
          {s.status !== 'unavailable' && <p className="muted fee-note">{feeTerms(s)}</p>}
          <ErrorNote error={link.error} />
          {(s.status === 'not-started' || s.status === 'incomplete') && (
            <button className="btn primary" disabled={link.isPending} onClick={() => goTo('onboarding')}>
              {link.isPending
                ? t('Opening Stripe…')
                : s.status === 'not-started'
                  ? t('Set up payouts')
                  : t('Continue setting up')}
            </button>
          )}
          {(s.status === 'active' || s.status === 'pending') && (
            <button className="btn" disabled={link.isPending} onClick={() => goTo('dashboard')}>
              {link.isPending ? t('Opening Stripe…') : t('Open your Stripe dashboard')}
            </button>
          )}
        </section>
      )}
    </QueryResult>
  )
}

function Status({ setup }: { setup: PayoutSetup }) {
  switch (setup.status) {
    case 'unavailable':
      return <p className="muted">{t('Online payments are not switched on for this platform yet.')}</p>
    case 'not-started':
      return (
        <div className="stack">
          <h3 className="panel-title">{t('Get paid for online sales')}</h3>
          <p className="muted">
            {t(
              "Buyers pay by Bancontact or card on Stripe's secure page, and Stripe transfers the money to your bank account. Setting up takes about five minutes: Stripe asks for your details, an ID and the bank account to be paid on.",
            )}
          </p>
          <p className="note warn-note" role="status">
            {t('Until this is done, members can only pay with tokens bought in cash.')}
          </p>
        </div>
      )
    case 'incomplete':
      return (
        <div className="stack">
          <h3 className="panel-title">{t('Almost there')}</h3>
          <p className="muted">
            {setup.requirementsDue === 1
              ? t('Stripe still needs one more detail before you can take online payments.')
              : t('Stripe still needs {count} more details before you can take online payments.', {
                  count: setup.requirementsDue,
                })}
          </p>
        </div>
      )
    case 'pending':
      return (
        <div className="stack">
          <h3 className="panel-title">{t('Stripe is checking your details')}</h3>
          <p className="muted">
            {t(
              "This usually takes a few minutes, sometimes a day. You'll be able to sell online as soon as it's done.",
            )}
          </p>
        </div>
      )
    case 'active':
      return (
        <div className="stack">
          <h3 className="panel-title">
            <span className="good">●</span> {t('Payouts are active')}
          </h3>
          <p className="muted">
            {t(
              'Online payments go straight to your Stripe account and are paid out to your bank automatically. Your Stripe dashboard shows every payment, payout and your bank account.',
            )}
          </p>
        </div>
      )
  }
}

/**
 * "MyTickets keeps 5% of each ticket or top-up, at most €1.50 each. On very small or unusual payments it
 * keeps just enough to cover Stripe's cost. You get the rest, straight after each payment."
 */
function feeTerms({ feePercent, feeMaxCentsPerItem }: PayoutSetup) {
  return (
    t('MyTickets keeps {percent}% of each ticket or top-up, at most {max} each.', {
      percent: feePercent,
      max: money(feeMaxCentsPerItem),
    }) +
    ' ' +
    t(
      "On very small payments it keeps just enough to cover Stripe's cost. You get the rest, straight after each payment.",
    )
  )
}
