import { type FormEvent, useEffect, useId, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { ErrorNote, Field } from '@/components'
import {
  OrganisationAvatar,
  useOrganisationSlugAvailability,
  usePublicOrganisation,
} from '@/features/organisations'
import { t } from '@/lib/i18n'

import { useSignIn } from '../api/auth'
import { ContinueWithEmail } from '../components/ContinueWithEmail'

type AuthPageProps = {
  mode: 'login' | 'register'
}

export function AuthPage({ mode }: AuthPageProps) {
  const location = useLocation()
  // At an organisation the first step is always just the email address (see below); this is what it handed over.
  const arrival = (location.state ?? {}) as { email?: string; fromEmailStep?: boolean }
  const [typedEmail, setTypedEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [organisationName, setOrganisationName] = useState('')
  const [checkedOrganisationName, setCheckedOrganisationName] = useState('')
  const { slug = '' } = useParams()
  // At an organisation the address comes from the email step and is fixed here; on the front page it is typed.
  const email = slug ? (arrival.email ?? '') : typedEmail
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const signIn = useSignIn(mode)

  const registering = mode === 'register'
  const checkingName = registering && !slug
  const organisation = usePublicOrganisation(slug, Boolean(slug))
  const emailId = useId()
  const isCurrentNameChecked = checkedOrganisationName === organisationName.trim()
  const availability = useOrganisationSlugAvailability(
    checkedOrganisationName,
    checkingName && isCurrentNameChecked,
  )
  const availableSlug = availability.data?.available ? availability.data.slug : null
  const nameIsAvailable = Boolean(
    organisationName.trim().length >= 2 && isCurrentNameChecked && availableSlug,
  )
  const next = params.get('next') || '/'
  const otherPage = slug
    ? `/${slug}/${registering ? 'login' : 'register'}`
    : `${registering ? '/login' : '/register'}?next=${encodeURIComponent(next)}`
  const orgName = organisation.data?.name ?? slug

  useEffect(() => {
    const timer = window.setTimeout(() => setCheckedOrganisationName(organisationName.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [organisationName])

  function submit(event: FormEvent) {
    event.preventDefault()
    signIn.mutate(
      {
        email,
        password,
        // Members give their name with their other details, after choosing a membership.
        ...(registering && !slug ? { displayName } : {}),
        // Signing in on an organisation's page means the account at that organisation.
        ...(!registering && slug ? { organisationSlug: slug } : {}),
        ...(registering && slug
          ? { joinOrganisationSlug: slug }
          : registering
            ? { organisationName: organisationName.trim() }
            : {}),
      },
      {
        onSuccess: (result) => {
          if (registering && slug) return navigate(`/${slug}/join`)
          // At an organisation, go on to where they were heading there (a tapped card, say), or its page.
          const onwards = params.get('next')
          const safe = onwards?.startsWith('/') && !onwards.startsWith('//') ? onwards : null
          navigate(registering ? `/${result.organisationSlug ?? slug}` : slug ? (safe ?? `/${slug}`) : next)
        },
      },
    )
  }

  // Signing in at an organisation starts with only an email address. Whether it has an account here
  // decides what comes next: the password, or creating an account.
  if (slug && !arrival.email) {
    return (
      <main className="narrow auth-page">
        <OrganisationBadge name={orgName} logoUrl={organisation.data?.logoUrl ?? null} />
        <ContinueWithEmail slug={slug} organisationName={orgName} search={location.search} />
      </main>
    )
  }

  return (
    <main className="narrow auth-page">
      {slug && <OrganisationBadge name={orgName} logoUrl={organisation.data?.logoUrl ?? null} />}
      <div className="auth-intro">
        {!slug && (
          <Link to="/" className="brand auth-brand">
            {t('MyTickets')}
          </Link>
        )}
        <h1>
          {/* At an organisation its logo and name are already above, so the heading only says what to do. */}
          {registering
            ? slug
              ? t('Create your account')
              : t('Start your organisation')
            : slug
              ? t('Log in')
              : t('Welcome back')}
        </h1>
        <p className="muted">
          {registering
            ? slug
              ? arrival.fromEmailStep
                ? t('There is no account with this email address yet. Choose a password to create one.')
                : t('Choose a password to create your account. You pick a membership next.')
              : t('Choose your organisation page, then create your account.')
            : slug
              ? arrival.fromEmailStep
                ? t('Welcome back. Enter your password.')
                : t('Sign in to see your {org} tickets and tokens.', { org: orgName })
              : t('Sign in to see your tickets, organisations and tokens.')}
        </p>
      </div>
      <form onSubmit={submit} className="stack panel auth-form">
        {checkingName && (
          <Field
            label={t('Organisation name')}
            hint={t('This will be the name of your public page. You can add a photo and description later.')}
          >
            <input
              value={organisationName}
              onChange={(e) => setOrganisationName(e.target.value)}
              autoComplete="organization"
              minLength={2}
              maxLength={80}
              required
            />
            {organisationName.trim().length >= 2 && (
              <small aria-live="polite">
                {!isCurrentNameChecked || availability.isPending
                  ? t('Checking page address…')
                  : availableSlug
                    ? t('Available: {address}', { address: `mytickets.be/${availableSlug}` })
                    : (availability.data?.reason ?? t('Could not check this page address.'))}
              </small>
            )}
          </Field>
        )}
        {registering && !slug && (
          <Field label={t('Your name')} hint={t('Staff see this when you tap your card.')}>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              required
            />
          </Field>
        )}
        {slug ? (
          // A real, filled-in field rather than plain text, so password managers pair it with the password.
          <div className="field">
            <label htmlFor={emailId}>{t('Email')}</label>
            <div className="known-email-field">
              <input id={emailId} type="email" name="email" value={email} readOnly autoComplete="username" />
              {/* Back to the email step: without the handed-over address this page asks for it again. */}
              <Link to={`/${slug}/login${location.search}`} replace aria-label={t('Change email address')}>
                {t('Change')}
              </Link>
            </div>
          </div>
        ) : (
          <Field label={t('Email')}>
            <input
              type="email"
              value={typedEmail}
              onChange={(e) => setTypedEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </Field>
        )}
        <Field label={t('Password')} hint={registering ? t('At least 8 characters.') : undefined}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={registering ? 'new-password' : 'current-password'}
            minLength={registering ? 8 : undefined}
            required
          />
        </Field>
        <ErrorNote error={signIn.error} />
        <button className="btn primary" disabled={signIn.isPending || (checkingName && !nameIsAvailable)}>
          {registering ? t('Create account') : t('Sign in')}
        </button>
      </form>
      <p className="muted auth-switch">
        {registering ? t('Already have an account? ') : t('New here? ')}
        {/* Keeps the address already given, so switching does not start over. */}
        <Link to={otherPage} state={slug ? { email } : undefined}>
          {registering ? t('Sign in') : t('Create an account')}
        </Link>
      </p>
    </main>
  )
}

/** Signing in at an organisation: its logo, big, with its name, so people know where they are. */
function OrganisationBadge({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return (
    <div className="auth-org">
      <OrganisationAvatar name={name} logoUrl={logoUrl} size={112} />
      <p className="auth-org-name">{name}</p>
    </div>
  )
}
