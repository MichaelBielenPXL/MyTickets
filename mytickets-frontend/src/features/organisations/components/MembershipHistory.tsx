import { ErrorNote, Loading } from '@/components'
import { t } from '@/lib/i18n'

import { useMyMemberships } from '../api/organisations'
import { MembershipPeriodList } from './MembershipPeriodList'

/** "My memberships": every membership the person has had here over the years, newest first. */
export function MembershipHistory({ slug }: { slug: string }) {
  const history = useMyMemberships(slug)

  return (
    <section className="panel stack membership-history" aria-labelledby="membership-history-heading">
      <h2 id="membership-history-heading">{t('My memberships')}</h2>
      {history.data ? (
        <MembershipPeriodList periods={history.data} />
      ) : history.error ? (
        <ErrorNote error={history.error} />
      ) : (
        <Loading />
      )}
    </section>
  )
}
