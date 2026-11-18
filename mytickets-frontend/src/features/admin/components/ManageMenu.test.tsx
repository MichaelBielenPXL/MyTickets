import { screen, within } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { ManageMenu } from './ManageMenu'

describe('ManageMenu', () => {
  it('shows the key numbers, then every other section, each opening its own page', async () => {
    server.use(
      http.get(apiUrl('/orgs/night-owls/admin/summary'), () =>
        HttpResponse.json({
          members: 42,
          creditOutstandingCents: 12000,
          barRevenueCents: 34050,
          depositsHeldCents: 0,
          onlineTopUpsCents: 0,
          cashTopUpsCents: 0,
          ticketRevenueCents: 80000,
        }),
      ),
    )
    renderApp(<ManageMenu slug="night-owls" />)

    const glance = screen.getByRole('link', { name: 'Overview: see details' })
    expect(glance).toHaveAttribute('href', '/night-owls/admin?tab=overview')
    expect(await within(glance).findByText('42')).toBeInTheDocument()
    expect(within(glance).getByText(/340,50/)).toBeInTheDocument()

    const menu = within(screen.getByRole('navigation', { name: 'Manage sections' }))
    const names = menu.getAllByRole('link').map((link) => link.querySelector('strong')?.textContent)
    expect(names).toEqual(['Events', 'Memberships', 'Members', 'Bar menu', 'Payouts', 'Settings'])
    expect(menu.getByRole('link', { name: /Bar menu/ })).toHaveAttribute('href', '/night-owls/admin?tab=bar')
  })
})
