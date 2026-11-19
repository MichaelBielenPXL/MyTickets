import { Link } from 'react-router-dom'

import { Trans, t } from '@/lib/i18n'

import type { Organisation } from '../types'

/** Where someone's request for a membership that needs approval stands, on the organisation's page. */
export function RequestStatus({ org }: { org: Organisation }) {
  const request = org.request
  if (!request) return null

  if (request.status === 'Pending') {
    return (
      <section className="panel request-status" role="status">
        <strong>{t('Waiting for approval')}</strong>
        <p className="muted">
          <Trans
            text="You asked for {tier}. {org} will look at it soon."
            values={{ tier: <strong>{request.tier}</strong>, org: org.name }}
          />
        </p>
      </section>
    )
  }
  if (request.status === 'Approved') {
    return (
      <section className="panel request-status approved" role="status">
        <strong>{t("You've been approved")}</strong>
        <p className="muted">
          <Trans
            text="{org} approved your request for {tier}. Pay to start your membership."
            values={{ org: org.name, tier: <strong>{request.tier}</strong> }}
          />
        </p>
        <Link className="btn primary" to={`/${org.slug}/join?tier=${request.tierId}`}>
          {t('Continue to payment')}
        </Link>
      </section>
    )
  }
  return (
    <section className="panel request-status" role="status">
      <strong>{t('Request not approved')}</strong>
      <p className="muted">
        <Trans
          text="{org} didn't approve your request for {tier}. You can choose another membership."
          values={{ org: org.name, tier: <strong>{request.tier}</strong> }}
        />
      </p>
    </section>
  )
}
