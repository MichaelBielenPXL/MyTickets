import { screen } from '@testing-library/react'

import {
  HttpResponse,
  aMe,
  anOrganisation,
  apiUrl,
  freeTier,
  http,
  jsonError,
  premiumTier,
} from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { JoinPage } from './JoinPage'

const path = '/:slug/join'
const newcomer = { membership: null, balanceCents: null, profileComplete: false }
const emptyProfile = {
  firstName: null,
  lastName: null,
  phone: null,
  street: null,
  postalCode: null,
  city: null,
  school: null,
  faculty: null,
  studyYear: null,
}

function serve(organisation = anOrganisation(newcomer), fields: object = {}) {
  const saved: unknown[] = []
  const joined: unknown[] = []
  server.use(
    http.get(apiUrl('/auth/me'), () => HttpResponse.json(aMe())),
    http.get(apiUrl('/orgs/night-owls'), () => HttpResponse.json(organisation)),
    http.get(apiUrl('/orgs/night-owls/me/profile'), () =>
      HttpResponse.json({
        email: 'gijs@example.com',
        complete: false,
        profile: emptyProfile,
        fields: {
          phone: 'Optional',
          address: 'Optional',
          school: 'Optional',
          faculty: 'Optional',
          studyYear: 'Optional',
          ...fields,
        },
      }),
    ),
    http.put(apiUrl('/orgs/night-owls/me/profile'), async ({ request }) => {
      saved.push(await request.json())
      return HttpResponse.json({ complete: true })
    }),
  )
  return { saved, joined }
}

function answerJoin(result: object, joined: unknown[]) {
  server.use(
    http.post(apiUrl('/orgs/night-owls/join'), async ({ request }) => {
      joined.push(await request.json())
      return HttpResponse.json(result)
    }),
  )
}

describe('JoinPage', () => {
  it('lets a newcomer decide later', async () => {
    serve()
    const { user } = renderApp(<JoinPage />, { at: '/night-owls/join', path })

    expect(await screen.findByRole('heading', { name: 'Choose your membership' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Decide later' }))

    expect(await screen.findByText('Now at /night-owls')).toBeInTheDocument()
  })

  it('goes back to a tapped card once the membership has started', async () => {
    sessionStorage.setItem('mytickets.pendingCard', 'ABCDEFGHJK')
    const { joined } = serve()
    answerJoin({ joined: true, pending: false, checkoutUrl: null }, joined)
    const { user } = renderApp(<JoinPage />, { at: '/night-owls/join', path })

    await user.click((await screen.findAllByRole('button', { name: 'Choose' }))[0])
    await user.type(await screen.findByLabelText('First name'), 'Gijs')
    await user.type(screen.getByLabelText('Last name'), 'Janssens')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Now at /c/ABCDEFGHJK')).toBeInTheDocument()
    expect(sessionStorage.getItem('mytickets.pendingCard')).toBeNull()
  })

  it('asks the details after choosing, then starts a free membership', async () => {
    const { saved, joined } = serve()
    answerJoin({ joined: true, pending: false, checkoutUrl: null }, joined)
    const { user } = renderApp(<JoinPage />, { at: '/night-owls/join', path })

    await user.click((await screen.findAllByRole('button', { name: 'Choose' }))[0])
    expect(await screen.findByRole('heading', { name: 'Your details' })).toBeInTheDocument()
    await user.type(await screen.findByLabelText('First name'), 'Gijs')
    await user.type(screen.getByLabelText('Last name'), 'Janssens')
    await user.type(screen.getByLabelText('Faculty (optional)'), 'Rechten')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Now at /night-owls')).toBeInTheDocument()
    expect(saved[0]).toMatchObject({ firstName: 'Gijs', lastName: 'Janssens', faculty: 'Rechten' })
    expect(joined[0]).toMatchObject({ tierId: freeTier.id })
  })

  it('hides details the organisation does not ask for, and marks the required ones', async () => {
    serve(anOrganisation(newcomer), { school: 'Off', faculty: 'Off', studyYear: 'Off', phone: 'Required' })
    renderApp(<JoinPage />, { at: `/night-owls/join?tier=${premiumTier.id}`, path })

    expect(await screen.findByLabelText('Phone')).toBeRequired()
    expect(screen.queryByLabelText(/School/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Faculty/)).not.toBeInTheDocument()
  })

  it('sends a request for a membership that needs approval, and says it is waiting', async () => {
    const board = { ...freeTier, id: 'tier-board', name: 'Board', requiresApproval: true }
    const { joined } = serve(anOrganisation({ ...newcomer, tiers: [freeTier, board] }))
    answerJoin({ joined: false, pending: true, checkoutUrl: null }, joined)
    const { user } = renderApp(<JoinPage />, { at: '/night-owls/join?tier=tier-board', path })

    expect(await screen.findByText(/checks each request before the membership starts/)).toBeInTheDocument()
    await user.type(await screen.findByLabelText('First name'), 'Gijs')
    await user.type(screen.getByLabelText('Last name'), 'Janssens')
    await user.click(screen.getByRole('button', { name: 'Send request' }))

    expect(await screen.findByRole('heading', { name: 'Request sent' })).toBeInTheDocument()
  })

  it('keeps the details and says why when the server refuses them', async () => {
    serve()
    server.use(
      http.put(apiUrl('/orgs/night-owls/me/profile'), () =>
        jsonError(400, "That doesn't look like a phone number."),
      ),
    )
    const { user } = renderApp(<JoinPage />, { at: `/night-owls/join?tier=${freeTier.id}`, path })

    await user.type(await screen.findByLabelText('First name'), 'Gijs')
    await user.type(screen.getByLabelText('Last name'), 'Janssens')
    await user.type(screen.getByLabelText('Phone (optional)'), 'call me')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("That doesn't look like a phone number.")
    expect(screen.getByLabelText('First name')).toHaveValue('Gijs')
  })

  it('lets a member change membership, or cancel and keep the one they have', async () => {
    serve(anOrganisation())
    renderApp(<JoinPage />, { at: '/night-owls/join', path })

    expect(await screen.findByRole('heading', { name: 'Change your membership' })).toBeInTheDocument()
    expect(screen.getByText(/You're on Premium now/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Current' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/night-owls')
    expect(screen.queryByRole('link', { name: 'Decide later' })).not.toBeInTheDocument()
  })

  it('can be cancelled from the details step too', async () => {
    serve()
    renderApp(<JoinPage />, { at: `/night-owls/join?tier=${freeTier.id}`, path })

    expect(await screen.findByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/night-owls')
  })
})
