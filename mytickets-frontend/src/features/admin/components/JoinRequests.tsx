import { ErrorNote } from '@/components'
import { dateTime, money } from '@/utils/format'

import { useDecideRequest, useJoinRequests } from '../api/admin'
import { MemberDetailsList } from './MemberDetailsList'

/** People asking for a membership that needs approval, with what they told the organisation. */
export function JoinRequests({ slug }: { slug: string }) {
  const requests = useJoinRequests(slug)
  const decide = useDecideRequest(slug)
  const list = requests.data ?? []
  if (list.length === 0) return null

  const waiting = list.filter((r) => r.status === 'Pending')
  const approved = list.filter((r) => r.status === 'Approved')

  return (
    <section className="stack join-requests">
      <h3 className="panel-title">
        Requests{waiting.length > 0 && <span className="count">{waiting.length}</span>}
      </h3>
      <ErrorNote error={decide.error} />
      {waiting.map((request) => (
        <div key={request.id} className="panel stack request-card">
          <div className="spread">
            <div>
              <strong>{request.displayName}</strong>
              <p className="muted">
                {request.email} · asked {dateTime(request.createdAt)}
              </p>
              <p>
                Wants <strong>{request.tier}</strong>
                {request.priceCents > 0 && ` (${money(request.priceCents)}, paid after approval)`}
              </p>
            </div>
          </div>
          <MemberDetailsList details={request} />
          <div className="row">
            <button
              className="btn primary small"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: request.id, decision: 'approve' })}
            >
              Approve
            </button>
            <button
              className="btn small"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: request.id, decision: 'reject' })}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
      {approved.length > 0 && (
        <p className="muted">
          Approved, waiting for payment: {approved.map((r) => `${r.displayName} (${r.tier})`).join(', ')}
        </p>
      )}
    </section>
  )
}
