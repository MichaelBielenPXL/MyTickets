import { screen, within } from '@testing-library/react'

import { HttpResponse, aMe, anOrganisation, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { OrganisationPage } from './OrganisationPage'

const page = { at: '/night-owls', path: '/:slug' }
const notJoined = { membership: null, balanceCents: null }

beforeEach(() => {
  server.use(
    // Signed in with an account at Night Owls.
    http.get(apiUrl('/auth/me'), () => HttpResponse.json(aMe())),
    http.get(apiUrl('/orgs/night-owls/me/cards'), () => HttpResponse.json([])),
  )
})

function tierRow(name: string) {
  return within(screen.getByText(name, { selector: 'strong' }).closest('.list-item') as HTMLElement)
}

describe('OrganisationPage', () => {
  it('takes someone choosing a membership to the details step', async () => {
    server.use(http.get(apiUrl('/orgs/night-owls'), () => HttpResponse.json(anOrganisation(notJoined))))
    const { user } = renderApp(<OrganisationPage />, page)

    expect(await screen.findByRole('heading', { name: 'Join to buy tickets' })).toBeInTheDocument()
    await user.click(tierRow('Premium').getByRole('button', { name: 'Join' }))

    expect(await screen.findByText('Now at /night-owls/join?tier=tier-premium')).toBeInTheDocument()
  })

  it('takes an invite code to the details step', async () => {
    server.use(
      http.get(apiUrl('/orgs/night-owls'), () =>
        HttpResponse.json(anOrganisation({ ...notJoined, hasInviteOnlyTiers: true })),
      ),
    )
    const { user } = renderApp(<OrganisationPage />, page)

    await user.type(await screen.findByLabelText('Invite code'), ' CREW2026 ')
    await user.click(screen.getByRole('button', { name: 'Use code' }))

    expect(await screen.findByText('Now at /night-owls/join?code=CREW2026')).toBeInTheDocument()
  })

  it('shows a request that is waiting for approval, and the way to pay once approved', async () => {
    const request = { id: 'r1', tierId: 'tier-premium', tier: 'Premium', createdAt: '2026-11-17T12:00:00Z' }
    server.use(
      http.get(apiUrl('/orgs/night-owls'), () =>
        HttpResponse.json(anOrganisation({ ...notJoined, request: { ...request, status: 'Approved' } })),
      ),
    )
    renderApp(<OrganisationPage />, page)

    expect(await screen.findByText("You've been approved")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue to payment' })).toHaveAttribute(
      'href',
      '/night-owls/join?tier=tier-premium',
    )
  })

  it('asks a member whose membership ran out to renew', async () => {
    const expired = { ...anOrganisation().membership, active: false, expiresAt: '2025-01-01T00:00:00Z' }
    server.use(
      http.get(apiUrl('/orgs/night-owls'), () => HttpResponse.json(anOrganisation({ membership: expired }))),
    )
    renderApp(<OrganisationPage />, page)

    expect(await screen.findByRole('heading', { name: 'Renew your membership' })).toBeInTheDocument()
    expect(screen.getByText(/Expired on/)).toBeInTheDocument()
  })

  it('opens the change-membership page from a working membership', async () => {
    server.use(http.get(apiUrl('/orgs/night-owls'), () => HttpResponse.json(anOrganisation())))
    renderApp(<OrganisationPage />, page)

    expect(await screen.findByRole('link', { name: 'Change membership' })).toHaveAttribute(
      'href',
      '/night-owls/join',
    )
    // Their card shows who they are, their membership and their tokens (20 euro = 20 tokens).
    const card = within(await screen.findByRole('group', { name: 'Night Owls membership card' }))
    expect(card.getByText('Premium')).toBeInTheDocument()
    expect(card.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('50% off tickets')).toBeInTheDocument()
    // The options themselves are not on the organisation's page for someone who already has a membership.
    expect(screen.queryByRole('heading', { name: 'Join to buy tickets' })).not.toBeInTheDocument()
  })
})
