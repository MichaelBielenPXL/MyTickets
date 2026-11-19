import { screen } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { MembersTab } from './MembersTab'

const gijs = {
  id: 'm1',
  displayName: 'Gijs Guest',
  email: 'gijs@example.com',
  role: 'Member',
  tierId: 'tier-free',
  tier: 'Member',
  joinedAt: '2026-11-01T10:00:00Z',
  expiresAt: null,
  balanceCents: 0,
  extraCardAllowed: false,
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

describe('MembersTab', () => {
  it('lets a member who lost their card link one more this year', async () => {
    const sent: unknown[] = []
    server.use(
      http.get(apiUrl('/orgs/night-owls/admin/members'), () => HttpResponse.json([gijs])),
      http.get(apiUrl('/orgs/night-owls/admin/tiers'), () => HttpResponse.json([])),
      http.get(apiUrl('/orgs/night-owls/admin/requests'), () => HttpResponse.json([])),
      http.put(apiUrl('/orgs/night-owls/admin/members/m1/extra-card'), async ({ request }) => {
        sent.push(await request.json())
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderApp(<MembersTab slug="night-owls" />)

    await user.click(await screen.findByRole('button', { name: 'Allow one extra card' }))

    await vi.waitFor(() => expect(sent).toEqual([{ allowed: true }]))
  })
})
