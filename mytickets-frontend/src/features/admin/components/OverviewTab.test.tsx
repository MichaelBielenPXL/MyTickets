import { screen, within } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { OverviewTab } from './OverviewTab'

describe('OverviewTab', () => {
  it('shows ticket and token sales in euros with the fees taken off', async () => {
    server.use(
      http.get(apiUrl('/orgs/night-owls/admin/summary'), () =>
        HttpResponse.json({
          members: 12,
          creditOutstandingCents: 12000,
          barRevenueCents: 34050,
          depositsHeldCents: 0,
          onlineTopUpsCents: 1250,
          cashTopUpsCents: 2000,
          ticketRevenueCents: 80000,
          ticketFeesCents: 3200,
          topUpFeesCents: 62,
        }),
      ),
    )
    renderApp(<OverviewTab slug="night-owls" />)

    const tickets = within((await screen.findByText('Ticket sales')).closest('dl') as HTMLElement)
    expect(tickets.getByText(/800,00/)).toBeInTheDocument()
    expect(tickets.getByText(/32,00 fees · .*768,00 to you/)).toBeInTheDocument()

    const tokens = within(screen.getByText('Token sales').closest('dl') as HTMLElement)
    expect(tokens.getByText(/32,50/)).toBeInTheDocument()
    expect(tokens.getByText(/0,62 fees · .*31,88 to you/)).toBeInTheDocument()

    const bar = within(screen.getByText('Bar sales').closest('dl') as HTMLElement)
    expect(bar.getByText(/€\s?340,50/)).toBeInTheDocument()
  })
})
