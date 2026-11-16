import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ErrorNote, Field } from '@/components'

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
    <form onSubmit={submit} className="panel stack continue-form">
      <div>
        <h2>Tickets and credit at {organisationName}</h2>
        <p className="muted">Enter your email address to continue.</p>
      </div>
      <Field label="Email">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </Field>
      <ErrorNote error={check.error} />
      <button className="btn primary" disabled={check.isPending}>
        {check.isPending ? 'Checking…' : 'Continue'}
      </button>
    </form>
  )
}
