import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { ErrorNote, Loading } from '@/components'
import { useGoToCheckout } from '@/hooks/useGoToCheckout'

import { useJoinOrganisation, useMyProfile, useOrganisation, useSaveProfile } from '../api/organisations'
import { ProfileFormFields } from '../components/ProfileFormFields'
import { TierChoice } from '../components/TierChoice'
import type { Organisation, ProfileValues } from '../types'
import { tierTerms } from '../utils/tier-terms'

/**
 * Right after signing up (and whenever someone picks a membership): first choose a membership, or decide
 * later; then fill in the organisation's questions; then the membership starts, goes to payment, or waits
 * for an admin's approval.
 */
export function JoinPage() {
  const { slug = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const organisation = useOrganisation(slug)
  const [waitingFor, setWaitingFor] = useState<string | null>(null)

  const org = organisation.data
  if (!org) {
    return (
      <main className="customer-page join-page">
        {organisation.error ? <ErrorNote error={organisation.error} /> : <Loading />}
      </main>
    )
  }

  const tierId = params.get('tier')
  const code = params.get('code')
  const chosen = tierId ? org.tiers.find((t) => t.id === tierId) : null
  const choice = chosen ? { tierId: chosen.id } : code ? { inviteCode: code } : null

  return (
    <main className="customer-page join-page">
      {waitingFor ? (
        <Waiting org={org} tierName={waitingFor} />
      ) : choice ? (
        <Details
          org={org}
          choiceLabel={chosen ? `${chosen.name} · ${tierTerms(chosen)}` : 'Invite code'}
          // Already approved for this one: no second request, straight on to joining or paying.
          needsApproval={
            (chosen?.requiresApproval ?? false) &&
            !(org.request?.status === 'Approved' && org.request.tierId === chosen?.id)
          }
          paid={(chosen?.priceCents ?? 0) > 0}
          choice={choice}
          onBack={() => setParams({})}
          onWaiting={() => setWaitingFor(chosen?.name ?? 'your membership')}
        />
      ) : (
        <Choose org={org} onChoose={(id) => setParams({ tier: id })} onCode={(c) => setParams({ code: c })} />
      )}
    </main>
  )
}

function Choose({
  org,
  onChoose,
  onCode,
}: {
  org: Organisation
  onChoose: (tierId: string) => void
  onCode: (code: string) => void
}) {
  const [code, setCode] = useState('')
  const membership = org.membership
  const changing = membership?.active === true
  const choosable = org.tiers.filter((t) => t.isPublic)

  function submitCode(event: FormEvent) {
    event.preventDefault()
    if (code.trim()) onCode(code.trim())
  }

  return (
    <section className="stack">
      <header className="join-heading">
        {!changing && <p className="step">Step 1 of 2</p>}
        <h1>{changing ? 'Change your membership' : 'Choose your membership'}</h1>
        <p className="lead">
          {changing
            ? `You're on ${membership!.tier} now. Pick another one, or cancel to keep it.`
            : `A membership lets you buy tickets and keep tokens at ${org.name}.`}
        </p>
      </header>
      <div className="tier-picker">
        <div className="list">
          {choosable.map((tier) => {
            const current = changing && membership!.tierId === tier.id
            return (
              <TierChoice
                key={tier.id}
                tier={tier}
                action={current ? 'Current' : 'Choose'}
                disabled={current}
                onChoose={() => onChoose(tier.id)}
              />
            )
          })}
        </div>
        {choosable.length === 0 && (
          <p className="muted">There are no memberships to choose from right now.</p>
        )}
        {org.hasInviteOnlyTiers && (
          <form onSubmit={submitCode} className="row invite">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Have an invite code?"
              aria-label="Invite code"
            />
            <button className="btn" disabled={!code.trim()}>
              Use code
            </button>
          </form>
        )}
      </div>
      {changing ? (
        <div className="decide-later">
          <Link className="btn" to={`/${org.slug}`}>
            Cancel
          </Link>
          <p className="muted">Your {membership!.tier} membership stays as it is.</p>
        </div>
      ) : (
        <div className="decide-later">
          <Link className="btn ghost" to={`/${org.slug}`}>
            Decide later
          </Link>
          <p className="muted">You can choose a membership any time from {org.name}&apos;s page.</p>
        </div>
      )}
    </section>
  )
}

type DetailsProps = {
  org: Organisation
  choiceLabel: string
  needsApproval: boolean
  paid: boolean
  choice: { tierId: string } | { inviteCode: string }
  onBack: () => void
  onWaiting: () => void
}

function Details({ org, choiceLabel, needsApproval, paid, choice, onBack, onWaiting }: DetailsProps) {
  const navigate = useNavigate()
  const goToCheckout = useGoToCheckout()
  const profile = useMyProfile(org.slug)
  const save = useSaveProfile(org.slug)
  const join = useJoinOrganisation(org.slug)

  async function submit(values: ProfileValues) {
    // Details first: the organisation needs them before anything starts.
    await save.mutateAsync(values)
    const result = await join.mutateAsync(choice)
    if (result.checkoutUrl) return goToCheckout(result.checkoutUrl)
    if (result.pending) return onWaiting()
    navigate(`/${org.slug}`)
  }

  return (
    <section className="stack">
      <header className="join-heading">
        <button type="button" className="back link-button" onClick={onBack}>
          ‹ Other memberships
        </button>
        {!org.membership?.active && <p className="step">Step 2 of 2</p>}
        <h1>Your details</h1>
        <p className="lead">
          For <strong>{choiceLabel}</strong>.{' '}
          {needsApproval
            ? `${org.name} checks each request before the membership starts.`
            : `${org.name} asks this of its members.`}
        </p>
      </header>
      <div className="panel">
        {profile.data ? (
          <ProfileFormFields
            form={profile.data}
            submitLabel={needsApproval ? 'Send request' : paid ? 'Continue to payment' : 'Continue'}
            busy={save.isPending || join.isPending}
            error={save.error ?? join.error}
            onSubmit={(values) => void submit(values).catch(() => {})}
            cancelTo={`/${org.slug}`}
          />
        ) : profile.error ? (
          <ErrorNote error={profile.error} />
        ) : (
          <Loading />
        )}
      </div>
    </section>
  )
}

function Waiting({ org, tierName }: { org: Organisation; tierName: string }) {
  return (
    <section className="panel stack outcome">
      <span className="outcome-icon waiting-still" aria-hidden>
        …
      </span>
      <h1>Request sent</h1>
      <p className="muted">
        {org.name} will look at your request for <strong>{tierName}</strong>. You&apos;ll see the answer on
        their page; if it&apos;s a paid membership, you pay once it&apos;s approved.
      </p>
      <Link className="btn primary block" to={`/${org.slug}`}>
        Go to {org.name}
      </Link>
    </section>
  )
}
