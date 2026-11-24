import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { ErrorNote, Loading } from '@/components'
import { t } from '@/lib/i18n'

import { useMyProfile, useSaveProfile } from '../api/organisations'
import { CopyDetails } from '../components/CopyDetails'
import { MembershipHistory } from '../components/MembershipHistory'
import { ProfileFormFields } from '../components/ProfileFormFields'
import type { ProfileValues } from '../types'
import { withCopied } from '../utils/copied-profile'

/** "My details": what the person told this organisation, to keep up to date. */
export function ProfilePage() {
  const { slug = '' } = useParams()
  const profile = useMyProfile(slug)
  const save = useSaveProfile(slug)
  const [copied, setCopied] = useState<{ values: ProfileValues; from: string } | null>(null)

  return (
    <main className="customer-page join-page">
      <header className="join-heading">
        <h1>{t('My details')}</h1>
        {profile.data && <p className="lead">Signed in as {profile.data.email}.</p>}
      </header>
      <div className="panel stack">
        <CopyDetails slug={slug} onCopied={(values, from) => setCopied({ values, from })} />
        {copied && (
          <p className="note" role="status">
            {t('Filled in from {org}. Check them, then save.', { org: copied.from })}
          </p>
        )}
        {profile.data ? (
          <ProfileFormFields
            // Starts over from what was saved (or just copied in).
            key={JSON.stringify([profile.data.profile, copied?.values])}
            form={withCopied(profile.data, copied?.values ?? null)}
            submitLabel={t('Save details')}
            busy={save.isPending}
            error={save.error}
            onSubmit={(values) => save.mutate(values, { onSuccess: () => setCopied(null) })}
          />
        ) : profile.error ? (
          <ErrorNote error={profile.error} />
        ) : (
          <Loading />
        )}
        {save.isSuccess && (
          <p className="muted" role="status">
            {t('Saved.')}
          </p>
        )}
      </div>
      <MembershipHistory slug={slug} />
    </main>
  )
}
