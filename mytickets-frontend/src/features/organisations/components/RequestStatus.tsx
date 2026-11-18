import { Link } from 'react-router-dom'

import type { Organisation } from '../types'

/** Where someone's request for a membership that needs approval stands, on the organisation's page. */
export function RequestStatus({ org }: { org: Organisation }) {
  const request = org.request
  if (!request) return null

  if (request.status === 'Pending') {
    return (
      <section className="panel request-status" role="status">
        <strong>Waiting for approval</strong>
        <p className="muted">
          You asked for <strong>{request.tier}</strong>. {org.name} will look at it soon.
        </p>
      </section>
    )
  }
  if (request.status === 'Approved') {
    return (
      <section className="panel request-status approved" role="status">
        <strong>You&apos;ve been approved</strong>
        <p className="muted">
          {org.name} approved your request for <strong>{request.tier}</strong>. Pay to start your membership.
        </p>
        <Link className="btn primary" to={`/${org.slug}/join?tier=${request.tierId}`}>
          Continue to payment
        </Link>
      </section>
    )
  }
  return (
    <section className="panel request-status" role="status">
      <strong>Request not approved</strong>
      <p className="muted">
        {org.name} didn&apos;t approve your request for <strong>{request.tier}</strong>. You can choose
        another membership.
      </p>
    </section>
  )
}
