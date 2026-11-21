import { screen } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { CardsPage } from './CardsPage'

let scanned = 'https://tickets.test/c/ABCDEFGHJK'
// The camera is not there in tests: the stand-in "scans" whatever the test put in `scanned`.
vi.mock('@/components/QrScanner', () => ({
  QrScanner: ({ onScan }: { onScan: (code: string) => void }) => (
    <button onClick={() => onScan(scanned)}>Fake camera</button>
  ),
}))

function serve() {
  server.use(
    http.get(apiUrl('/orgs/night-owls/me/cards'), () =>
      HttpResponse.json([
        { id: 'c1', number: '7', label: '', blocked: false, linkedAt: '2026-11-01T20:00:00Z' },
      ]),
    ),
    http.get(apiUrl('/orgs/night-owls/cards/ABCDEFGHJK'), () =>
      HttpResponse.json({ number: '42', state: 'free', member: true }),
    ),
  )
}

const open = () => renderApp(<CardsPage />, { at: '/night-owls/wallet/cards', path: '/:slug/wallet/cards' })

describe('CardsPage', () => {
  it('lists the linked cards with the way back to the wallet, and has no number to type', async () => {
    serve()
    open()

    expect(await screen.findByText('Card 7')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '‹ My wallet' })).toHaveAttribute('href', '/night-owls/wallet')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('Hold the card to your phone, or scan its QR code.')).toBeInTheDocument()
  })

  it('asks to link a card whose QR code was scanned', async () => {
    serve()
    scanned = 'https://tickets.test/c/ABCDEFGHJK'
    const { user } = open()

    await user.click(await screen.findByRole('button', { name: 'Scan the QR code on the card' }))
    await user.click(screen.getByRole('button', { name: 'Fake camera' }))

    expect(
      await screen.findByRole('alertdialog', { name: 'Link card 42 to your wallet?' }),
    ).toBeInTheDocument()
  })

  it("says so when the QR code isn't a card", async () => {
    serve()
    scanned = 'https://example.com/hello'
    const { user } = open()

    await user.click(await screen.findByRole('button', { name: 'Scan the QR code on the card' }))
    await user.click(screen.getByRole('button', { name: 'Fake camera' }))

    expect(await screen.findByText("This QR code isn't a card.")).toBeInTheDocument()
  })
})
