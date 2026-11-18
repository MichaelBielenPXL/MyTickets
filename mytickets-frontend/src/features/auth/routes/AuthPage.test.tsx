import { screen } from '@testing-library/react'

import { HttpResponse, apiUrl, http, jsonError } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { AuthPage } from './AuthPage'

describe('AuthPage', () => {
  it('shows what the server says when the password is wrong', async () => {
    server.use(http.post(apiUrl('/auth/login'), () => jsonError(401, 'Wrong email address or password.')))
    const { user } = renderApp(<AuthPage mode="login" />)

    await user.type(screen.getByLabelText('Email'), 'gijs@example.com')
    await user.type(screen.getByLabelText('Password'), 'nope')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email address or password.')
  })

  it('creates an account with the name staff will see', async () => {
    let sent: unknown
    server.use(
      http.post(apiUrl('/auth/register'), async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({ id: 'u1', organisationSlug: 'moonlight-society' })
      }),
      http.get(apiUrl('/auth/me'), () => HttpResponse.json({ id: 'u1', displayName: 'Gijs Guest' })),
      http.get(apiUrl('/public/orgs/slug-availability'), () =>
        HttpResponse.json({ available: true, slug: 'moonlight-society', reason: null }),
      ),
    )
    const { user } = renderApp(<AuthPage mode="register" />)

    await user.type(screen.getByLabelText(/Organisation name/), 'Moonlight Society')
    expect(await screen.findByText('Available: mytickets.be/moonlight-society')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Your name/), 'Gijs Guest')
    await user.type(screen.getByLabelText('Email'), 'gijs@example.com')
    await user.type(screen.getByLabelText(/Password/), 'correct horse')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await vi.waitFor(() =>
      expect(sent).toEqual({
        email: 'gijs@example.com',
        password: 'correct horse',
        displayName: 'Gijs Guest',
        organisationName: 'Moonlight Society',
      }),
    )
    expect(await screen.findByText('Now at /moonlight-society')).toBeInTheDocument()
  })

  it('keeps organiser signup disabled when the requested organisation address is taken', async () => {
    server.use(
      http.get(apiUrl('/public/orgs/slug-availability'), () =>
        HttpResponse.json({ available: false, slug: 'moonlight-society', reason: 'That page is taken.' }),
      ),
    )
    const { user } = renderApp(<AuthPage mode="register" />)

    await user.type(screen.getByLabelText(/Organisation name/), 'Moonlight Society')

    expect(await screen.findByText('That page is taken.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
  })

  it('signs a member up with only a password, then sends them to choose a membership', async () => {
    let sent: unknown
    server.use(
      http.get(apiUrl('/public/orgs/night-owls'), () =>
        HttpResponse.json({ slug: 'night-owls', name: 'Night Owls', description: '', tiers: [], events: [] }),
      ),
      http.post(apiUrl('/auth/register'), async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({ id: 'u2', organisationSlug: 'night-owls' })
      }),
    )
    const { user } = renderApp(<AuthPage mode="register" />, {
      at: '/night-owls/register',
      path: '/:slug/register',
      state: { email: 'gijs@example.com' },
    })

    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    // The organisation's name sits by its logo at the top.
    expect(await screen.findByText('Night Owls')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Organisation name/)).not.toBeInTheDocument()
    // The address was given in the email step: filled in and not editable here, but still a field.
    expect(screen.getByLabelText('Email')).toHaveValue('gijs@example.com')
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'username')
    // No name asked here: that comes with the other details, after choosing a membership.
    expect(screen.queryByLabelText(/Your name/)).not.toBeInTheDocument()
    await user.type(screen.getByLabelText(/Password/), 'correct horse')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await vi.waitFor(() =>
      expect(sent).toEqual({
        email: 'gijs@example.com',
        password: 'correct horse',
        joinOrganisationSlug: 'night-owls',
      }),
    )
    expect(await screen.findByText('Now at /night-owls/join')).toBeInTheDocument()
  })

  it('keeps the page the visitor was heading for when switching to "create an account"', () => {
    renderApp(<AuthPage mode="login" />, { at: '/login?next=%2Fo%2Fnight-owls', path: '/login' })

    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/register?next=%2Fo%2Fnight-owls',
    )
  })

  it('keeps organisation context when switching from login to registration', async () => {
    server.use(
      http.get(apiUrl('/public/orgs/night-owls'), () =>
        HttpResponse.json({ slug: 'night-owls', name: 'Night Owls', description: '', tiers: [], events: [] }),
      ),
    )
    renderApp(<AuthPage mode="login" />, {
      at: '/night-owls/login',
      path: '/:slug/login',
      state: { email: 'gijs@example.com' },
    })

    expect(await screen.findByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/night-owls/register',
    )
  })

  it('returns a member to their organisation after contextual login', async () => {
    server.use(
      http.get(apiUrl('/public/orgs/night-owls'), () =>
        HttpResponse.json({ slug: 'night-owls', name: 'Night Owls', description: '', tiers: [], events: [] }),
      ),
    )
    let sent: unknown
    server.use(
      http.post(apiUrl('/auth/login'), async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({ id: 'u3' })
      }),
    )
    const { user } = renderApp(<AuthPage mode="login" />, {
      at: '/night-owls/login',
      path: '/:slug/login',
      state: { email: 'gijs@example.com' },
    })

    await user.type(screen.getByLabelText('Password'), 'correct horse')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Now at /night-owls')).toBeInTheDocument()
    expect(sent).toEqual({
      email: 'gijs@example.com',
      password: 'correct horse',
      organisationSlug: 'night-owls',
    })
  })

  it('asks only for an email address first when signing in at an organisation', async () => {
    server.use(
      http.get(apiUrl('/public/orgs/night-owls'), () =>
        HttpResponse.json({ slug: 'night-owls', name: 'Night Owls', description: '', tiers: [], events: [] }),
      ),
    )
    renderApp(<AuthPage mode="login" />, { at: '/night-owls/login', path: '/:slug/login' })

    expect(await screen.findByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/Password/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Your name/)).not.toBeInTheDocument()
  })

  it('starts sign-up at an organisation with the email step too', async () => {
    server.use(
      http.get(apiUrl('/public/orgs/night-owls'), () =>
        HttpResponse.json({ slug: 'night-owls', name: 'Night Owls', description: '', tiers: [], events: [] }),
      ),
      // The address turns out to have an account already: on to the password, not a second account.
      http.post(apiUrl('/public/orgs/night-owls/account-check'), () => HttpResponse.json({ exists: true })),
    )
    const { user } = renderApp(<AuthPage mode="register" />, {
      at: '/night-owls/register?next=%2Fnight-owls%2Fwallet',
      path: '/:slug/register',
    })

    expect(screen.queryByLabelText(/Password/)).not.toBeInTheDocument()
    await user.type(await screen.findByLabelText('Email'), 'gijs@example.com')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    // Where they were heading is kept for after signing in.
    expect(
      await screen.findByText('Now at /night-owls/login?next=%2Fnight-owls%2Fwallet'),
    ).toBeInTheDocument()
  })

  it('lets someone go back and give a different email address', async () => {
    server.use(
      http.get(apiUrl('/public/orgs/night-owls'), () =>
        HttpResponse.json({ slug: 'night-owls', name: 'Night Owls', description: '', tiers: [], events: [] }),
      ),
    )
    const { user } = renderApp(<AuthPage mode="login" />, {
      at: '/night-owls/login',
      path: '/:slug/login',
      state: { email: 'wrong@example.com' },
    })

    await user.click(await screen.findByRole('link', { name: 'Change email address' }))

    expect(await screen.findByLabelText('Email')).toHaveValue('')
    expect(screen.queryByLabelText(/Password/)).not.toBeInTheDocument()
  })
})
