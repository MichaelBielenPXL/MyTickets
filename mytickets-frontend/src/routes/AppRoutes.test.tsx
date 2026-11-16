import { screen } from '@testing-library/react'
import { useLocation } from 'react-router-dom'

import { HttpResponse, anEvent, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { AppRoutes } from './AppRoutes'

const publicOrganisation = {
  slug: 'night-owls',
  name: 'Night Owls',
  description: 'Student parties',
  tiers: [],
  hasInviteOnlyTiers: false,
  events: [],
}

function signedOut() {
  server.use(http.get(apiUrl('/auth/me'), () => HttpResponse.json({}, { status: 401 })))
}

describe('public organisation routes', () => {
  it('shows a public organisation page and organisation-scoped auth links to visitors', async () => {
    signedOut()
    server.use(http.get(apiUrl('/public/orgs/night-owls'), () => HttpResponse.json(publicOrganisation)))
    renderApp(<AppRoutes />, { at: '/night-owls', path: '*' })

    expect(await screen.findByRole('heading', { name: 'Night Owls' })).toBeInTheDocument()
    // One way in, for this organisation only. The email step works out whether that means log in or sign up.
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/night-owls/login')
    expect(screen.queryByLabelText(/Password/)).not.toBeInTheDocument()
  })

  it('asks a visitor for their email and takes someone with an account to their password', async () => {
    signedOut()
    let asked: unknown
    server.use(
      http.get(apiUrl('/public/orgs/night-owls'), () => HttpResponse.json(publicOrganisation)),
      http.post(apiUrl('/public/orgs/night-owls/account-check'), async ({ request }) => {
        asked = await request.json()
        return HttpResponse.json({ exists: true })
      }),
    )
    const { user } = renderApp(<AppRoutes />, { at: '/night-owls', path: '*' })

    await user.type(await screen.findByLabelText('Email'), ' gijs@example.com ')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByRole('heading', { name: 'Log in to Night Owls' })).toBeInTheDocument()
    expect(screen.getByText(/Welcome back/)).toBeInTheDocument()
    // The address comes along, so it is typed once; only the password is asked now.
    expect(screen.getByText('gijs@example.com')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(asked).toEqual({ email: 'gijs@example.com' })
  })

  it('takes a visitor without an account to sign-up, with their email filled in', async () => {
    signedOut()
    server.use(
      http.get(apiUrl('/public/orgs/night-owls'), () => HttpResponse.json(publicOrganisation)),
      http.post(apiUrl('/public/orgs/night-owls/account-check'), () => HttpResponse.json({ exists: false })),
    )
    const { user } = renderApp(<AppRoutes />, { at: '/night-owls', path: '*' })

    await user.type(await screen.findByLabelText('Email'), 'new@example.com')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByRole('heading', { name: 'Register for Night Owls' })).toBeInTheDocument()
    expect(screen.getByText(/no account with this email address at Night Owls yet/)).toBeInTheDocument()
    expect(screen.getByText('new@example.com')).toBeInTheDocument()
  })

  it('shows the organisation its logo at the top of the page', async () => {
    signedOut()
    server.use(
      http.get(apiUrl('/public/orgs/night-owls'), () =>
        HttpResponse.json({ ...publicOrganisation, logoUrl: '/api/images/orgs/a/b.png' }),
      ),
    )
    const { container } = renderApp(<AppRoutes />, { at: '/night-owls', path: '*' })

    await screen.findByRole('heading', { name: 'Night Owls' })
    expect(container.querySelector('.org-hero img')).toHaveAttribute('src', '/api/images/orgs/a/b.png')
  })

  it('shows public event details without ticket purchase controls when signed out', async () => {
    signedOut()
    server.use(
      http.get(apiUrl('/public/orgs/night-owls'), () => HttpResponse.json(publicOrganisation)),
      http.get(apiUrl('/public/orgs/night-owls/events/event-1'), () => HttpResponse.json(anEvent())),
    )
    renderApp(<AppRoutes />, { at: '/night-owls/events/event-1', path: '*' })

    expect(await screen.findByRole('heading', { name: 'Halloween Bash' })).toBeInTheDocument()
    expect(screen.getByText(/12,50/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'More Regular' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Register for Night Owls' })).toHaveAttribute(
      'href',
      '/night-owls/register',
    )
  })

  it('redirects legacy event URLs and preserves the suffix, query string and hash', async () => {
    server.use(
      http.get(apiUrl('/auth/me'), () => HttpResponse.json({}, { status: 401 })),
      http.get(apiUrl('/public/orgs/night-owls'), () => HttpResponse.json(publicOrganisation)),
      http.get(apiUrl('/public/orgs/night-owls/events/event-1'), () => HttpResponse.json(anEvent())),
    )
    renderApp(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      { at: '/o/night-owls/events/event-1?source=invite#tickets', path: '*' },
    )

    expect(await screen.findByTestId('current-path')).toHaveTextContent(
      '/night-owls/events/event-1?source=invite#tickets',
    )
  })
})

function CurrentPath() {
  const location = useLocation()
  return (
    <p data-testid="current-path">
      {location.pathname}
      {location.search}
      {location.hash}
    </p>
  )
}
