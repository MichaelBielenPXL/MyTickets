import { screen } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { CardsPage } from './CardsPage'

describe('CardsPage', () => {
  it('lists the linked cards with the way back to the wallet', async () => {
    server.use(
      http.get(apiUrl('/orgs/night-owls/me/cards'), () =>
        HttpResponse.json([
          { id: 'c1', uid: '04A1B2C3', label: 'Blue card', blocked: false, linkedAt: '2026-11-01T20:00:00Z' },
        ]),
      ),
    )
    renderApp(<CardsPage />, { at: '/night-owls/wallet/cards', path: '/:slug/wallet/cards' })

    expect(await screen.findByText('Blue card')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '‹ My wallet' })).toHaveAttribute('href', '/night-owls/wallet')
  })
})
