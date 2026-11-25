import { screen, within } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { MembershipHistory } from './MembershipHistory'

describe('MembershipHistory', () => {
  it('lists every membership over the years, the running one marked', async () => {
    server.use(
      http.get(apiUrl('/orgs/night-owls/me/memberships'), () =>
        HttpResponse.json([
          {
            id: 'p2',
            tierName: 'Member 2026-2027',
            startedAt: '2026-09-20T10:00:00Z',
            endsAt: '2027-06-30T22:00:00Z',
            current: true,
          },
          {
            id: 'p1',
            tierName: 'Member 2025-2026',
            startedAt: '2025-09-25T10:00:00Z',
            endsAt: '2026-06-30T22:00:00Z',
            current: false,
          },
        ]),
      ),
    )
    renderApp(<MembershipHistory slug="night-owls" />)

    const rows = await screen.findAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      'Member 2026-2027Current20/09/2026 to 30/06/2027',
      'Member 2025-202625/09/2025 to 30/06/2026',
    ])
    expect(within(rows[1]).queryByText('Current')).not.toBeInTheDocument()
  })

  it('says so when there is no history yet', async () => {
    server.use(http.get(apiUrl('/orgs/night-owls/me/memberships'), () => HttpResponse.json([])))
    renderApp(<MembershipHistory slug="night-owls" />)

    expect(await screen.findByText('No memberships yet.')).toBeInTheDocument()
  })
})
