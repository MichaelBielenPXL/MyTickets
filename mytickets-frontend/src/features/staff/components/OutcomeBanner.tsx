import type { Outcome } from '../types'

type OutcomeBannerProps = {
  outcome: Outcome | null
}

/** Big green or red answer, readable at arm's length in a dark room. */
export function OutcomeBanner({ outcome }: OutcomeBannerProps) {
  if (!outcome) return null
  return (
    <div className={outcome.ok ? 'result ok' : 'result fail'} role="status" aria-live="assertive">
      <strong>{outcome.title}</strong>
      {outcome.detail && <span>{outcome.detail}</span>}
    </div>
  )
}
