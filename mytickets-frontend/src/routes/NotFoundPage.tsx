import { Link } from 'react-router-dom'

import { t } from '@/lib/i18n'

export function NotFoundPage() {
  return (
    <main>
      <h1>{t('Page not found')}</h1>
      <Link to="/">{t('Go home')}</Link>
    </main>
  )
}
