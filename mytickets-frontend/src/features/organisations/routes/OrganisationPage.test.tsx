import { screen, within } from '@testing-library/react'

import { HttpResponse, aMe, anOrganisation, apiUrl, http, jsonError } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { OrganisationPage } from './OrganisationPage'

const page = { at: '/night-owls', path: '/:slug' }
const notJoined = { membership: null, balanceCents: null }

beforeEach(() => {
  server.use(
    // Signed in with an account at Night Owls.
    http.get(apiUrl('/auth/me'), () => HttpResponse.json(aMe())),
  )
})

function tierRow(name: string) {
  return within(screen.getByText(name, { selector: 'strong' }).closest('.list-item') as HTMLElement)
}

describe('OrganisationPage', () => {
  it('sends someone joining a paid membership to the checkout', async () => {
    server.use(
      http.get(apiUrl('/orgs/night-owls'), () => HttpResponse.json(anOrganisation(notJoined))),
      http.post(apiUrl('/orgs/night-owls/join'), () =>
        HttpResponse.json({ joined: false, checkoutUrl: '/checkout/pay-9' }),
      ),
    )
    const { user } = renderApp(<OrganisationPage />, page)

    expect(await screen.findByRole('heading', { name: 'Join to buy tickets' })).toBeInTheDocument()
    await user.click(tierRow('Premium').getByRole('button', { name: 'Join' }))

    expect(await screen.findByText('Now at /checkout/pay-9')).toBeInTheDocument()
  })

  it('lets someone in on an invite-only membership with the code', async () => {
    let joined = false
    let sent: unknown
    server.use(
      http.get(apiUrl('/orgs/night-owls'), () =>
        HttpResponse.json(
          joined
            ? anOrganisation({
                hasInviteOnlyTiers: true,
                membership: { ...anOrganisation().membership, tier: 'Crew' },
              })
            : anOrganisation({ ...notJoined, hasInviteOnlyTiers: true }),
        ),
      ),
      http.post(apiUrl('/orgs/night-owls/join'), async ({ request }) => {
        sent = await request.json()
        joined = true
        return HttpResponse.json({ joined: true, checkoutUrl: null })
      }),
    )
    const { user } = renderApp(<OrganisationPage />, page)

    await user.type(await screen.findByLabelText('Invite code'), ' CREW2026 ')
    await user.click(screen.getByRole('button', { name: 'Use code' }))

    // The page reloads itself and now shows the membership instead of the options.
    expect(await screen.findByText('Crew')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Join to buy tickets' })).not.toBeInTheDocument()
    expect(sent).toMatchObject({ inviteCode: 'CREW2026' })
  })

  it('says so when the invite code is wrong', async () => {
    server.use(
      http.get(apiUrl('/orgs/night-owls'), () =>
        HttpResponse.json(anOrganisation({ ...notJoined, hasInviteOnlyTiers: true })),
      ),
      http.post(apiUrl('/orgs/night-owls/join'), () => jsonError(400, 'That invite code is not valid.')),
    )
    const { user } = renderApp(<OrganisationPage />, page)

    await user.type(await screen.findByLabelText('Invite code'), 'WRONG')
    await user.click(screen.getByRole('button', { name: 'Use code' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('That invite code is not valid.')
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
})
