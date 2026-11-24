import { screen, within } from '@testing-library/react'

import { HttpResponse, aMe, aMembership, anOrganisation, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { AppRoutes } from './AppRoutes'

const jazz = aMembership({ slug: 'jazz-cellar', name: 'Jazz Cellar', role: 'Admin', tier: 'Member' })

function signedInAs(me: object) {
  server.use(
    http.get(apiUrl('/auth/me'), () => HttpResponse.json(me)),
    http.get(apiUrl('/orgs/:slug'), ({ params }) =>
      HttpResponse.json(
        anOrganisation({
          slug: params.slug,
          name: params.slug === 'jazz-cellar' ? 'Jazz Cellar' : 'Night Owls',
        }),
      ),
    ),
  )
}

// The tabs appear once "who am I" has loaded.
const tabs = async () => within(await screen.findByRole('navigation', { name: 'Organisation' }))

describe('start page', () => {
  beforeEach(() => localStorage.clear())

  it('opens straight in your organisation', async () => {
    signedInAs(aMe())
    renderApp(<AppRoutes />, { at: '/', path: '*' })

    expect(await screen.findByRole('heading', { name: 'Night Owls', level: 1 })).toBeInTheDocument()
  })

  it('opens in the organisation you used last, not just the first one', async () => {
    localStorage.setItem('mytickets:last-organisation', 'jazz-cellar')
    signedInAs(aMe({ memberships: [aMembership(), jazz] }))
    renderApp(<AppRoutes />, { at: '/', path: '*' })

    expect(await screen.findByRole('heading', { name: 'Jazz Cellar', level: 1 })).toBeInTheDocument()
  })

  it('ignores a remembered organisation you no longer belong to', async () => {
    localStorage.setItem('mytickets:last-organisation', 'left-long-ago')
    signedInAs(aMe())
    renderApp(<AppRoutes />, { at: '/', path: '*' })

    expect(await screen.findByRole('heading', { name: 'Night Owls', level: 1 })).toBeInTheDocument()
  })

  it('shows the organisations to choose from when you have not joined any', async () => {
    signedInAs(aMe({ memberships: [] }))
    server.use(http.get(apiUrl('/orgs'), () => HttpResponse.json([])))
    renderApp(<AppRoutes />, { at: '/', path: '*' })

    expect(await screen.findByRole('heading', { name: 'Organisations' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose organisation' })).toBeInTheDocument()
  })
})

describe('organisation switcher', () => {
  beforeEach(() => localStorage.clear())

  it('lists your organisations and takes you to the one you pick', async () => {
    signedInAs(aMe({ memberships: [aMembership(), jazz] }))
    const { user } = renderApp(<AppRoutes />, { at: '/night-owls', path: '*' })

    await user.click(await screen.findByRole('button', { name: 'Switch organisation' }))
    const list = within(screen.getByRole('navigation', { name: 'Your organisations' }))
    expect(list.getByRole('link', { name: 'Night Owls' })).toHaveAttribute('aria-current', 'true')
    await user.click(list.getByRole('link', { name: 'Jazz Cellar' }))

    expect(await screen.findByRole('heading', { name: 'Jazz Cellar', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Your organisations' })).not.toBeInTheDocument()
    // Next visit starts here.
    expect(localStorage.getItem('mytickets:last-organisation')).toBe('jazz-cellar')
  })

  it('closes when Escape is pressed', async () => {
    signedInAs(aMe())
    const { user } = renderApp(<AppRoutes />, { at: '/night-owls', path: '*' })

    await user.click(await screen.findByRole('button', { name: 'Switch organisation' }))
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('navigation', { name: 'Your organisations' })).not.toBeInTheDocument()
  })

  it('stays in your organisation on pages that belong to no organisation', async () => {
    localStorage.setItem('mytickets:last-organisation', 'jazz-cellar')
    signedInAs(aMe({ memberships: [aMembership(), jazz] }))
    server.use(http.get(apiUrl('/orgs'), () => HttpResponse.json([])))
    renderApp(<AppRoutes />, { at: '/discover', path: '*' })

    expect((await tabs()).getByRole('link', { name: 'Manage' })).toHaveAttribute('href', '/jazz-cellar/admin')
  })
})

describe('one MyTickets account', () => {
  beforeEach(() => localStorage.clear())

  const publicNightOwls = {
    slug: 'night-owls',
    name: 'Night Owls',
    description: '',
    logoUrl: null,
    tiers: [],
    hasInviteOnlyTiers: false,
    events: [],
  }

  it('shows an organisation you have not joined yet as yours to join, without signing in again', async () => {
    signedInAs(aMe({ isOwner: false, memberships: [jazz] }))
    server.use(
      http.get(apiUrl('/orgs/night-owls'), () =>
        HttpResponse.json(anOrganisation({ membership: null, balanceCents: null })),
      ),
    )
    renderApp(<AppRoutes />, { at: '/night-owls', path: '*' })

    expect(await screen.findByText('Visiting')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Sign in at Night Owls' })).not.toBeInTheDocument()
    // No tabs into a record that does not exist here yet.
    expect((await tabs()).queryByRole('link', { name: 'Tickets' })).not.toBeInTheDocument()
    expect((await tabs()).queryByRole('link', { name: 'Wallet' })).not.toBeInTheDocument()
  })

  it("sends someone who isn't signed in to that organisation's sign-in", async () => {
    server.use(
      http.get(apiUrl('/auth/me'), () => HttpResponse.json({}, { status: 401 })),
      http.get(apiUrl('/public/orgs/night-owls'), () => HttpResponse.json(publicNightOwls)),
    )
    renderApp(<AppRoutes />, { at: '/night-owls/wallet', path: '*' })

    // Signing in there starts with just an email address.
    expect(await screen.findByRole('button', { name: 'Continue' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/Password/)).not.toBeInTheDocument()
  })

  it('loads tickets from the organisation you are in', async () => {
    signedInAs(aMe())
    const asked: string[] = []
    server.use(
      http.get(apiUrl('/orgs/:slug/me/tickets'), ({ params }) => {
        asked.push(String(params.slug))
        return HttpResponse.json([])
      }),
    )
    renderApp(<AppRoutes />, { at: '/night-owls/tickets', path: '*' })

    expect(await screen.findByText(/No tickets yet/)).toBeInTheDocument()
    expect(asked).toEqual(['night-owls'])
  })

  it('signs out of MyTickets, everywhere at once', async () => {
    let signedIn = true
    server.use(
      http.get(apiUrl('/auth/me'), () =>
        signedIn
          ? HttpResponse.json(aMe({ isOwner: false, memberships: [aMembership(), jazz] }))
          : HttpResponse.json({}, { status: 401 }),
      ),
      http.get(apiUrl('/orgs/:slug'), ({ params }) =>
        HttpResponse.json(anOrganisation({ slug: params.slug })),
      ),
      http.get(apiUrl('/public/orgs/night-owls'), () => HttpResponse.json(publicNightOwls)),
      http.post(apiUrl('/auth/logout'), () => {
        signedIn = false
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderApp(<AppRoutes />, { at: '/night-owls', path: '*' })

    await user.click(await screen.findByRole('button', { name: 'Account menu' }))
    expect(screen.queryByRole('button', { name: /Sign out of/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('form', { name: 'Sign in at Night Owls' })).toBeInTheDocument()
  })
})

describe('starting an organisation', () => {
  beforeEach(() => localStorage.clear())

  it('is offered on the MyTickets site itself, never from inside an organisation', async () => {
    signedInAs(aMe({ canCreateOrganisations: true }))
    server.use(http.get(apiUrl('/orgs'), () => HttpResponse.json([])))
    const { user } = renderApp(<AppRoutes />, { at: '/night-owls', path: '*' })

    await user.click(await screen.findByRole('button', { name: 'Switch organisation' }))
    expect(screen.queryByRole('link', { name: 'Create organisation' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Browse organisations' }))
    await user.click(await screen.findByRole('button', { name: 'Switch organisation' }))
    expect(screen.getByRole('link', { name: 'Create organisation' })).toHaveAttribute(
      'href',
      '/discover?new=1',
    )
  })
})

describe('organisation tabs', () => {
  beforeEach(() => localStorage.clear())

  it('shows a member only the member pages', async () => {
    signedInAs(aMe())
    renderApp(<AppRoutes />, { at: '/night-owls', path: '*' })

    expect((await tabs()).getByRole('link', { name: 'Wallet' })).toHaveAttribute('href', '/night-owls/wallet')
    expect((await tabs()).queryByRole('link', { name: 'Door & bar' })).not.toBeInTheDocument()
    expect((await tabs()).queryByRole('link', { name: 'Manage' })).not.toBeInTheDocument()
  })

  it('adds the door and bar for staff, and managing for admins', async () => {
    signedInAs(aMe({ memberships: [aMembership({ role: 'Staff' }), jazz] }))
    const { user } = renderApp(<AppRoutes />, { at: '/night-owls', path: '*' })

    expect((await tabs()).getByRole('link', { name: 'Door & bar' })).toBeInTheDocument()
    expect((await tabs()).queryByRole('link', { name: 'Manage' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Switch organisation' }))
    await user.click(screen.getByRole('link', { name: 'Jazz Cellar' }))
    expect((await tabs()).getByRole('link', { name: 'Manage' })).toBeInTheDocument()
  })

  it('offers no wallet in an organisation you are only visiting', async () => {
    signedInAs(aMe({ memberships: [jazz] }))
    server.use(
      http.get(apiUrl('/orgs/night-owls'), () =>
        HttpResponse.json(anOrganisation({ membership: null, balanceCents: null })),
      ),
    )
    renderApp(<AppRoutes />, { at: '/night-owls', path: '*' })

    expect(await screen.findByText('Visiting')).toBeInTheDocument()
    expect((await tabs()).queryByRole('link', { name: 'Wallet' })).not.toBeInTheDocument()
  })
})
