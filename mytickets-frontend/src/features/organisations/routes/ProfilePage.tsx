import { useParams } from 'react-router-dom'

import { ErrorNote, Loading } from '@/components'

import { useMyProfile, useSaveProfile } from '../api/organisations'
import { ProfileFormFields } from '../components/ProfileFormFields'

/** "My details": what the person told this organisation, to keep up to date. */
export function ProfilePage() {
  const { slug = '' } = useParams()
  const profile = useMyProfile(slug)
  const save = useSaveProfile(slug)

  return (
    <main className="customer-page join-page">
      <header className="join-heading">
        <h1>My details</h1>
        {profile.data && <p className="lead">Signed in as {profile.data.email}.</p>}
      </header>
      <div className="panel stack">
        {profile.data ? (
          <ProfileFormFields
            // Starts over from what was saved, once saving is done.
            key={JSON.stringify(profile.data.profile)}
            form={profile.data}
            submitLabel="Save details"
            busy={save.isPending}
            error={save.error}
            onSubmit={(values) => save.mutate(values)}
          />
        ) : profile.error ? (
          <ErrorNote error={profile.error} />
        ) : (
          <Loading />
        )}
        {save.isSuccess && (
          <p className="muted" role="status">
            Saved.
          </p>
        )}
      </div>
    </main>
  )
}
