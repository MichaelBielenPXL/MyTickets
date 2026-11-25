import { type FormEvent, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { ErrorNote, Field } from '@/components'
import { t } from '@/lib/i18n'

import { useForgotPassword } from '../api/auth'

/**
 * "Forgot your password?": asks for the email address and sends a link to choose a new password. At an organisation
 * that is the account there; on the front page, an organiser's login. Says the same whether or not there is an
 * account, so nobody can find out who has one.
 */
export function ForgotPasswordPage() {
  const { slug } = useParams()
  const location = useLocation()
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '')
  const forgot = useForgotPassword(slug)
  const loginPage = slug ? `/${slug}/login` : '/login'

  function submit(event: FormEvent) {
    event.preventDefault()
    forgot.mutate(email.trim())
  }

  return (
    <main className="narrow auth-page">
      <div className="auth-intro">
        <h1>{t('Forgot your password?')}</h1>
        <p className="muted">
          {forgot.isSuccess
            ? t(
                'If there is an account with {email}, we have sent it a link to choose a new password. It works for an hour.',
                {
                  email: email.trim(),
                },
              )
            : t("Enter your email address and we'll send you a link to choose a new password.")}
        </p>
      </div>
      {!forgot.isSuccess && (
        <form onSubmit={submit} className="stack panel auth-form">
          <Field label={t('Email')}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </Field>
          <ErrorNote error={forgot.error} />
          <button className="btn primary" disabled={forgot.isPending}>
            {forgot.isPending ? t('One moment…') : t('Send link')}
          </button>
        </form>
      )}
      <p className="muted auth-switch">
        <Link to={loginPage} state={slug ? { email: email.trim() } : undefined}>
          {t('Back to sign in')}
        </Link>
      </p>
    </main>
  )
}
