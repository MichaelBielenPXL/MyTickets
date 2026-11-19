import { screen } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { TopUpForm } from './TopUpForm'

function renderForm() {
  return renderApp(<TopUpForm slug="night-owls" minCents={500} maxCents={50_000} />)
}

describe('TopUpForm', () => {
  it('refuses an amount outside the limits without bothering the server', async () => {
    // No answer prepared: a request here would fail the test.
    const { user } = renderForm()

    await user.clear(screen.getByLabelText('Amount in euro'))
    await user.type(screen.getByLabelText('Amount in euro'), '2')
    await user.click(screen.getByRole('button', { name: /^Pay/ }))

    expect(screen.getByRole('alert')).toHaveTextContent(/between € 5,00 and € 500,00/)
  })

  it('starts a payment for the typed amount and goes to the checkout', async () => {
    let sent: unknown
    server.use(
      http.post(apiUrl('/orgs/night-owls/wallet/topup'), async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({ checkoutUrl: '/checkout/pay-3' })
      }),
    )
    const { user } = renderForm()

    await user.click(screen.getByRole('button', { name: '40 Tokens' }))
    await user.clear(screen.getByLabelText('Amount in euro'))
    await user.type(screen.getByLabelText('Amount in euro'), '12,50')
    await user.click(screen.getByRole('button', { name: /^Pay €\s12,50 for 12,50 tokens$/ }))

    expect(await screen.findByText('Now at /checkout/pay-3')).toBeInTheDocument()
    expect(sent).toEqual({ amountCents: 1250 })
  })

  it("offers the organisation's own top-ups and pays for the one chosen", async () => {
    let sent: unknown
    server.use(
      http.post(apiUrl('/orgs/night-owls/wallet/topup'), async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({ checkoutUrl: '/checkout/pay-4' })
      }),
    )
    const deals = [
      { id: 'deal-5', priceCents: 500, tokensCents: 600 },
      { id: 'deal-20', priceCents: 2000, tokensCents: 2500 },
    ]
    const { user } = renderApp(<TopUpForm slug="night-owls" minCents={500} maxCents={50_000} deals={deals} />)

    const twenty = screen.getByRole('button', { name: /^25 tokens for €\s20,00$/ })
    expect(twenty).toHaveTextContent('+5 tokens free')
    await user.click(twenty)
    await user.click(screen.getByRole('button', { name: /^Pay €\s20,00 for 25 tokens$/ }))

    expect(await screen.findByText('Now at /checkout/pay-4')).toBeInTheDocument()
    expect(sent).toEqual({ amountCents: 0, dealId: 'deal-20' })
  })

  it('offers no amount of your own when the organisation has deals', () => {
    const deals = [{ id: 'deal-5', priceCents: 500, tokensCents: 600 }]
    renderApp(<TopUpForm slug="night-owls" minCents={500} maxCents={50_000} deals={deals} />)

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Pay €\s5,00 for 6 tokens$/ })).toBeEnabled()
  })
})
