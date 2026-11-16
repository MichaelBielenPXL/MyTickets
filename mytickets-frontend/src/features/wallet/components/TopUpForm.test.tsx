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
    await user.click(screen.getByRole('button', { name: 'Top up' }))

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

    await user.click(screen.getByRole('button', { name: '€40' }))
    await user.clear(screen.getByLabelText('Amount in euro'))
    await user.type(screen.getByLabelText('Amount in euro'), '12,50')
    await user.click(screen.getByRole('button', { name: 'Top up' }))

    expect(await screen.findByText('Now at /checkout/pay-3')).toBeInTheDocument()
    expect(sent).toEqual({ amountCents: 1250 })
  })
})
