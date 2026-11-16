import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { ErrorNote, Loading, QueryResult } from '@/components'
import { ContinueWithEmail, useAccount } from '@/features/auth'

import { useOrganisation, usePublicOrganisation } from '../api/organisations'
import { JoinOptions } from '../components/JoinOptions'
import { MembershipPanel } from '../components/MembershipPanel'
import { OrganisationHero } from '../components/OrganisationHero'
import { UpcomingEvents } from '../components/UpcomingEvents'

export function OrganisationPage() {
  const { slug = '' } = useParams()
  const [changing, setChanging] = useState(false)
  // The account this browser has here, if any. Being signed in at another organisation does not count.
  const me = useAccount(slug)
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
      <>
        <main className="customer-page organisation-page">
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
      </>
    )
  }

  const org = organisation.data
  if (!org) return <main>{organisation.error ? <ErrorNote error={organisation.error} /> : <Loading />}</main>
  const hasWorkingMembership = org.membership?.active === true
  const choosing = !hasWorkingMembership || changing

  return (
    <>
      <main className="customer-page organisation-page">
        <OrganisationHero name={org.name} description={org.description} logoUrl={org.logoUrl} />
        <MembershipPanel
          organisation={org}
          onChangeMembership={choosing ? undefined : () => setChanging(true)}
        />
        {choosing && (
          <JoinOptions
            organisation={org}
            onJoined={() => setChanging(false)}
            onCancel={hasWorkingMembership ? () => setChanging(false) : undefined}
          />
        )}
        <UpcomingEvents slug={slug} events={org.events} />
      </main>
    </>
  )
}
