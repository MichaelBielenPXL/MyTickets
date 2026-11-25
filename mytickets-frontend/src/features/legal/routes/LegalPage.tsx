import { Link } from 'react-router-dom'

import { t, useLanguage } from '@/lib/i18n'
import { dateOnly } from '@/utils/format'

import { privacy } from '../content/privacy'
import { terms } from '../content/terms'
import { TERMS_VERSION } from '../content/types'

const DOCUMENTS = { terms, privacy }

type LegalPageProps = {
  document: keyof typeof DOCUMENTS
}

/** The terms of service or the privacy policy, in the chosen language. */
export function LegalPage({ document }: LegalPageProps) {
  const { language } = useLanguage()
  const doc = DOCUMENTS[document][language]
  const other = document === 'terms' ? 'privacy' : 'terms'

  return (
    <main className="customer-page legal-page">
      <header className="join-heading">
        <h1>{doc.title}</h1>
        <p className="muted">{t('Last updated {date}', { date: dateOnly(TERMS_VERSION) })}</p>
      </header>
      <p className="lead">{doc.intro}</p>
      {doc.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.body.map((part, i) =>
            Array.isArray(part) ? (
              <ul key={i}>
                {part.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p key={i}>{part}</p>
            ),
          )}
        </section>
      ))}
      <p>
        <Link to={`/${other}`}>{other === 'terms' ? t('Terms of service') : t('Privacy policy')}</Link>
      </p>
    </main>
  )
}
