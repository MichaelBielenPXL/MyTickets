import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ErrorNote, Field } from '@/components'
import { t } from '@/lib/i18n'

import { useCheckAccount } from '../api/auth'

type ContinueWithEmailProps = {
  slug: string
  organisationName: string
  /** Kept on the address of the next step, e.g. "?next=/night-owls/wallet", so the visitor ends up where they were heading. */
  search?: string
}

/**
 * The way in on an organisation's page: one email field. Whoever already has an account here goes on
 * to enter their password; everyone else goes on to create an account. Either way the address they
 * typed comes along, so they never enter it twice.
 */
export function ContinueWithEmail({ slug, organisationName, search = '' }: ContinueWithEmailProps) {
  const [email, setEmail] = useState('')
  const navigate = useNavigate()
  const check = useCheckAccount(slug)

  function submit(event: FormEvent) {
    event.preventDefault()
    const address = email.trim()
    check.mutate(address, {
      onSuccess: ({ exists }) =>
        // Passed along out of sight rather than in the address bar, where it would end up in the history.
        navigate(`/${slug}/${exists ? 'login' : 'register'}${search}`, {
          state: { email: address, fromEmailStep: true },
        }),
    })
  }

  return (
    // The organisation's logo and name sit above this; the form is just the address.
    <form
      onSubmit={submit}
      className="panel stack continue-form"
      aria-label={t('Sign in at {org}', { org: organisationName })}
    >
      <Field label={t('Email')}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          placeholder={t('you@example.com')}
          required
        />
      </Field>
      <ErrorNote error={check.error} />
      <button className="btn primary" disabled={check.isPending}>
        {check.isPending ? t('Checking…') : t('Continue')}
      </button>
    </form>
  )
}
