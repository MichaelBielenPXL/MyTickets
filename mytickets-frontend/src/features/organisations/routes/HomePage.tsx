import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { QueryResult } from '@/components'
import { useMe } from '@/features/auth'
import { t } from '@/lib/i18n'

import { useOrganisations } from '../api/organisations'
import { CreateOrganisationForm } from '../components/CreateOrganisationForm'
import { OrganisationList } from '../components/OrganisationList'

export function HomePage() {
  const [params] = useSearchParams()
  // The switcher's "Create organisation" links here with ?new=1.
  const [creating, setCreating] = useState(params.get('new') === '1')
  const me = useMe().data
  const organisations = useOrganisations()

  return (
    <main className="customer-page home-page">
      <header className="page-heading">
        <div>
          <h1>{t('Organisations')}</h1>
          <p className="lead">{t('Join an organisation to buy its tickets and get a token wallet there.')}</p>
        </div>
        {me?.canCreateOrganisations && !creating && (
          <button className="btn" onClick={() => setCreating(true)}>
            {t('Start an organisation')}
          </button>
        )}
      </header>

      <QueryResult query={organisations}>
        {(all) => {
          const joined = all.filter((o) => o.joined)
          const others = all.filter((o) => !o.joined)
          return (
            <>
              <section className="content-section">
                <div className="section-heading">
                  <h2>{t('Your organisations')}</h2>
                  <span className="muted">{t('{count} joined', { count: joined.length })}</span>
                </div>
                {joined.length === 0 && (
                  <p className="muted">
                    {t("You haven't joined an organisation yet. Join one below to buy tickets.")}
                  </p>
                )}
                <OrganisationList organisations={joined} />
              </section>
              {others.length > 0 && (
                <section className="content-section">
                  <div className="section-heading">
                    <h2>{t('Discover')}</h2>
                  </div>
                  <OrganisationList organisations={others} />
                </section>
              )}
            </>
          )
        }}
      </QueryResult>

      {creating && (
        <section className="create-organisation-section">
          <CreateOrganisationForm onCancel={() => setCreating(false)} />
        </section>
      )}
    </main>
  )
}
