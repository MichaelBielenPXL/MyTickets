import { useParams } from 'react-router-dom'

import { ErrorNote, Loading, QueryResult } from '@/components'
import { ContinueWithEmail, useMe } from '@/features/auth'

import { useOrganisation, usePublicOrganisation } from '../api/organisations'
import { JoinOptions } from '../components/JoinOptions'
import { MembershipPanel } from '../components/MembershipPanel'
import { OrganisationHero } from '../components/OrganisationHero'
import { RequestStatus } from '../components/RequestStatus'
import { UpcomingEvents } from '../components/UpcomingEvents'
import { brandStyle } from '../utils/brand'

export function OrganisationPage() {
  const { slug = '' } = useParams()
  // Signed in to MyTickets: the page for them (joined or not yet); otherwise the public page.
  const me = useMe()
  const organisation = useOrganisation(slug, Boolean(me.data))
  const publicOrganisation = usePublicOrganisation(slug, !me.isPending && !me.data)

  if (me.isPending)
    return (
      <main>
        <Loading />
      </main>
    )
  if (!me.data) {
    return (
      <main
        className="customer-page organisation-page"
        style={brandStyle(publicOrganisation.data?.brandColor)}
      >
        <QueryResult query={publicOrganisation}>
          {(org) => (
            <>
              <OrganisationHero name={org.name} description={org.description} logoUrl={org.logoUrl} />
              <ContinueWithEmail slug={slug} organisationName={org.name} />
              <UpcomingEvents slug={slug} events={org.events} />
            </>
          )}
        </QueryResult>
      </main>
    )
  }

  const org = organisation.data
  if (!org) return <main>{organisation.error ? <ErrorNote error={organisation.error} /> : <Loading />}</main>
  const hasWorkingMembership = org.membership?.active === true

  return (
    <>
      <main className="customer-page organisation-page" style={brandStyle(org.brandColor)}>
        {/* A member's card carries the organisation's name and logo, so the big logo is for everyone else. */}
        {org.membership ? (
          <MembershipPanel organisation={org} />
        ) : (
          <OrganisationHero name={org.name} description={org.description} logoUrl={org.logoUrl} />
        )}
        <RequestStatus org={org} />
        {!hasWorkingMembership && <JoinOptions organisation={org} />}
        <UpcomingEvents slug={slug} events={org.events} />
      </main>
    </>
  )
}
