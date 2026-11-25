import { type FormEvent, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { ErrorNote, Field } from '@/components'
import { t } from '@/lib/i18n'

import { useResetPassword } from '../api/auth'

/** Where the emailed link leads: choose a new password, then sign in with it. */
export function ResetPasswordPage() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const reset = useResetPassword()
  const loginPage = slug ? `/${slug}/login` : '/login'

  function submit(event: FormEvent) {
    event.preventDefault()
    reset.mutate({ token, password })
  }

  if (reset.isSuccess) {
    return (
      <main className="narrow auth-page">
        <div className="auth-intro">
          <h1>{t('Your new password is set')}</h1>
          <p className="muted">{t('Sign in with it from now on.')}</p>
        </div>
        <Link to={loginPage} className="btn primary">
          {t('Sign in')}
        </Link>
      </main>
    )
  }

  return (
    <main className="narrow auth-page">
      <div className="auth-intro">
        <h1>{t('Choose a new password')}</h1>
      </div>
      <form onSubmit={submit} className="stack panel auth-form">
        <Field label={t('New password')} hint={t('At least 8 characters.')}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        <ErrorNote error={reset.error} />
        <button className="btn primary" disabled={reset.isPending || !token}>
          {reset.isPending ? t('One moment…') : t('Set new password')}
        </button>
      </form>
      <p className="muted auth-switch">
        <Link to={slug ? `/${slug}/forgot-password` : '/forgot-password'}>{t('Ask for a new link')}</Link>
      </p>
    </main>
  )
}
