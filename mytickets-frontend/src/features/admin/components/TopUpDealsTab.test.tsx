import { screen } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { TopUpDealsTab } from './TopUpDealsTab'

describe('TopUpDealsTab', () => {
  it('adds a deal like 6 tokens for 5 euro and saves the list', async () => {
    let sent: unknown
    server.use(
      http.get(apiUrl('/orgs/night-owls/admin/topup-deals'), () => HttpResponse.json([])),
      http.put(apiUrl('/orgs/night-owls/admin/topup-deals'), async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json([{ id: 'd1', priceCents: 500, tokensCents: 600 }])
      }),
    )
    const { user } = renderApp(<TopUpDealsTab slug="night-owls" />)

    expect(await screen.findByText(/No deals yet/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add a top-up' }))
    await user.type(screen.getByLabelText('Price in euro'), '5')
    await user.type(screen.getByLabelText('Tokens'), '6')
    expect(screen.getByText(/for 6 tokens: 1 token free/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save token prices' }))

    expect(await screen.findByText('Saved.')).toBeInTheDocument()
    expect(sent).toEqual([{ priceCents: 500, tokensCents: 600 }])
  })

  it('asks for both numbers before saving', async () => {
    server.use(http.get(apiUrl('/orgs/night-owls/admin/topup-deals'), () => HttpResponse.json([])))
    const { user } = renderApp(<TopUpDealsTab slug="night-owls" />)

    await user.click(await screen.findByRole('button', { name: 'Add a top-up' }))
    await user.type(screen.getByLabelText('Price in euro'), '5')
    await user.click(screen.getByRole('button', { name: 'Save token prices' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Fill in a price and a number of tokens')
  })
})
