import { screen } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { PrintCardsPage } from './PrintCardsPage'

const card = (number: string, extra: object = {}) => ({
  id: `id-${number}`,
  number,
  code: `CODE${number}AB`,
  url: `https://tickets.test/c/CODE${number}AB`,
  uid: null,
  locked: false,
  blocked: false,
  linkedTo: null,
  createdAt: '2026-11-19T10:00:00Z',
  writtenAt: null,
  linkedAt: null,
  ...extra,
})

describe('PrintCardsPage', () => {
  it('lays out every card not yet written as a card-sized page with its number and QR code', async () => {
    server.use(
      http.get(apiUrl('/orgs/night-owls/admin/cards'), () =>
        HttpResponse.json([card('0003'), card('0002'), card('0001', { uid: '04A2B91C' })]),
      ),
      http.get(apiUrl('/orgs/night-owls/admin/organisation'), () =>
        HttpResponse.json({
          slug: 'night-owls',
          name: 'Night Owls',
          description: '',
          logoKey: null,
          logoUrl: null,
          brandColor: null,
        }),
      ),
      http.get(apiUrl('/orgs/night-owls/admin/cards/design'), () =>
        HttpResponse.json({
          front: {
            background: 'brand',
            colour: null,
            imageKey: null,
            imageUrl: null,
            showLogo: false,
            tagline: 'Voorkant',
          },
          back: {
            background: 'brand',
            colour: null,
            imageKey: null,
            imageUrl: null,
            showLogo: false,
            tagline: 'Lidkaart',
          },
        }),
      ),
    )
    const { user } = renderApp(<PrintCardsPage />, {
      at: '/night-owls/admin/cards/print',
      path: '/:slug/admin/cards/print',
    })

    expect(await screen.findByText('0002')).toBeInTheDocument()
    expect(screen.getByText('0003')).toBeInTheDocument()
    expect(screen.queryByText('0001')).not.toBeInTheDocument()
    expect(screen.getByTitle('QR code for card 0002')).toBeInTheDocument()
    // Both sides of each card by default, for a printer that prints both sides; or one side at a time.
    expect(screen.getAllByText('Voorkant')).toHaveLength(2)
    expect(screen.getAllByText('Lidkaart')).toHaveLength(2)
    await user.click(screen.getByRole('radio', { name: 'Backs only' }))
    expect(screen.queryByText('Voorkant')).not.toBeInTheDocument()
    expect(screen.getAllByText('Lidkaart')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Print 2 cards' })).toBeInTheDocument()
  })
})
