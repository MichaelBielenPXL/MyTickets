import { ErrorNote } from '@/components'
import { MemberDetailsList } from '@/features/organisations'
import { Trans, t } from '@/lib/i18n'
import { dateTime, money } from '@/utils/format'

import { useDecideRequest, useJoinRequests } from '../api/admin'

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
                {request.email} · {t('asked {when}', { when: dateTime(request.createdAt) })}
              </p>
              <p>
                <Trans text="Wants {tier}" values={{ tier: <strong>{request.tier}</strong> }} />
                {request.priceCents > 0 &&
                  ` (${t('{price}, paid after approval', { price: money(request.priceCents) })})`}
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
              {t('Approve')}
            </button>
            <button
              className="btn small"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: request.id, decision: 'reject' })}
            >
              {t('Reject')}
            </button>
          </div>
        </div>
      ))}
      {approved.length > 0 && (
        <p className="muted">
          {t('Approved, waiting for payment: {names}', {
            names: approved.map((r) => `${r.displayName} (${r.tier})`).join(', '),
          })}
        </p>
      )}
    </section>
  )
}
