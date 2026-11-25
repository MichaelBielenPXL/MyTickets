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
  it('lays out every card not yet written as a card-sized page with its QR code and number', async () => {
    server.use(
      http.get(apiUrl('/orgs/night-owls/admin/cards'), () =>
        HttpResponse.json([card('3'), card('2'), card('1', { uid: '04A2B91C' })]),
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

    // Cards 2 and 3; 1 is already written.
    expect(await screen.findAllByTitle('QR code of the card')).toHaveLength(2)
    expect(screen.getAllByText('2')).not.toHaveLength(0)
    expect(screen.getAllByText('3')).not.toHaveLength(0)
    expect(screen.queryByText('1')).not.toBeInTheDocument()
    // Both sides of each card by default, for a printer that prints both sides; or one side at a time.
    expect(screen.getAllByText('Voorkant')).toHaveLength(2)
    expect(screen.getAllByText('Lidkaart')).toHaveLength(2)
    await user.click(screen.getByRole('radio', { name: 'Backs only' }))
    expect(screen.queryByText('Voorkant')).not.toBeInTheDocument()
    expect(screen.getAllByText('Lidkaart')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Print 2 cards' })).toBeInTheDocument()
  })
})
