import { screen } from '@testing-library/react'

import { HttpResponse, anOrganisation, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { WalletPage } from './WalletPage'

const page = { at: '/night-owls/wallet', path: '/:slug/wallet' }
const aCard = {
  id: 'c1',
  uid: '04A1B2C3',
  label: 'Blue card',
  blocked: false,
  linkedAt: '2026-11-01T20:00:00Z',
}

describe('WalletPage', () => {
  it('shows the tokens, and how many cards pay with it', async () => {
    server.use(
      http.get(apiUrl('/orgs/night-owls'), () => HttpResponse.json(anOrganisation())),
      http.get(apiUrl('/orgs/night-owls/wallet'), () =>
        HttpResponse.json({ balanceCents: 1250, minTopUpCents: 500, maxTopUpCents: 25000, transactions: [] }),
      ),
      http.get(apiUrl('/orgs/night-owls/me/cards'), () => HttpResponse.json([aCard])),
    )
    renderApp(<WalletPage />, page)

    expect(await screen.findByText('12,50 tokens')).toBeInTheDocument()
    expect(await screen.findByText('1 card linked')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Manage cards' })).toHaveAttribute(
      'href',
      '/night-owls/wallet/cards',
    )
  })

  it('lets someone without a membership link a card before choosing one', async () => {
    server.use(
      http.get(apiUrl('/orgs/night-owls'), () =>
        HttpResponse.json(anOrganisation({ membership: null, balanceCents: null })),
      ),
      http.get(apiUrl('/orgs/night-owls/me/cards'), () => HttpResponse.json([])),
    )
    renderApp(<WalletPage />, page)

    expect(await screen.findByRole('heading', { name: 'No tokens yet' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Choose a membership' })).toHaveAttribute(
      'href',
      '/night-owls/join',
    )
    expect(await screen.findByText('No card linked yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Manage cards' })).toBeInTheDocument()
  })
})
