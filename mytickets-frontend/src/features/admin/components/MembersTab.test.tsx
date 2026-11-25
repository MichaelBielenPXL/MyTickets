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
  it("lists just who is who, each opening the member's own page", async () => {
    server.use(
      http.get(apiUrl('/orgs/night-owls/admin/members'), () =>
        HttpResponse.json([gijs, { ...gijs, id: 'm2', displayName: 'Bart Barman', role: 'Barman' }]),
      ),
      http.get(apiUrl('/orgs/night-owls/admin/requests'), () => HttpResponse.json([])),
    )
    const { user } = renderApp(<MembersTab slug="night-owls" />)

    const gijsRow = await screen.findByRole('link', { name: /Gijs Guest/ })
    expect(gijsRow).toHaveAttribute('href', '/night-owls/members/m1')
    expect(screen.getByRole('link', { name: /Bart Barman/ })).toHaveTextContent('Barman')
    // No editing in the list itself.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Allow one extra card' })).not.toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: 'Search members' }), 'bart')
    expect(screen.queryByRole('link', { name: /Gijs Guest/ })).not.toBeInTheDocument()
  })
})
