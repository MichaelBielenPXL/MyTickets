import { screen } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { PayoutsTab } from './PayoutsTab'

function serve(status: string, requirementsDue = 0) {
  server.use(
    http.get(apiUrl('/orgs/night-owls/admin/payouts'), () =>
      HttpResponse.json({ status, requirementsDue, feePercent: 5, feeMaxCentsPerItem: 150 }),
    ),
  )
}

describe('PayoutsTab', () => {
  const assign = vi.fn()
  beforeEach(() => {
    assign.mockReset()
    vi.stubGlobal('location', { ...window.location, assign })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sends an admin who has not started to Stripe to set up payouts', async () => {
    serve('not-started')
    server.use(
      http.post(apiUrl('/orgs/night-owls/admin/payouts/onboarding'), () =>
        HttpResponse.json({ url: 'https://connect.stripe.com/setup/e/acct_1' }),
      ),
    )
    const { user } = renderApp(<PayoutsTab slug="night-owls" />)

    expect(await screen.findByText(/members can only pay with tokens/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Set up payouts' }))

    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://connect.stripe.com/setup/e/acct_1'))
  })

  it('says how much Stripe still needs', async () => {
    serve('incomplete', 2)
    renderApp(<PayoutsTab slug="night-owls" />)

    expect(await screen.findByText(/Stripe still needs 2 more details/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue setting up' })).toBeInTheDocument()
  })

  it('opens the Stripe dashboard once payouts are active', async () => {
    serve('active')
    server.use(
      http.post(apiUrl('/orgs/night-owls/admin/payouts/dashboard'), () =>
        HttpResponse.json({ url: 'https://connect.stripe.com/express/acct_1' }),
      ),
    )
    const { user } = renderApp(<PayoutsTab slug="night-owls" />)

    expect(await screen.findByText('Payouts are active')).toBeInTheDocument()
    expect(
      screen.getByText(/MyTickets keeps 5% of each ticket or top-up, at most € 1,50 each/),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open your Stripe dashboard' }))

    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://connect.stripe.com/express/acct_1'))
  })
})
