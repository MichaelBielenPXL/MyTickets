import { screen } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { CashTopUpMode } from './CashTopUpMode'
import { CheckCardMode } from './CheckCardMode'

// The camera is not there in tests: the stand-in "scans" a card's printed QR code.
vi.mock('@/components/QrScanner', () => ({
  QrScanner: ({ onScan }: { onScan: (code: string) => void }) => (
    <button onClick={() => onScan('https://cards.example/c?uid=04A2B91C5E8F80')}>Fake camera</button>
  ),
}))

const holder = {
  name: 'Gijs Guest',
  tier: 'Member',
  membershipActive: true,
  expiresAt: null,
  balanceCents: 1250,
  drinkDiscountPercent: 0,
}

describe('scanning a QR code instead of tapping', () => {
  it('checks the card from its printed QR code', async () => {
    let asked: unknown
    server.use(
      http.post(apiUrl('/orgs/night-owls/staff/lookup'), async ({ request }) => {
        asked = await request.json()
        return HttpResponse.json(holder)
      }),
    )
    const { user } = renderApp(<CheckCardMode slug="night-owls" />)

    await user.click(screen.getByRole('button', { name: 'Scan QR code' }))
    await user.click(screen.getByRole('button', { name: 'Fake camera' }))

    expect(await screen.findByText('Gijs Guest')).toBeInTheDocument()
    expect(asked).toMatchObject({ cardUid: '04A2B91C5E8F80' })
  })

  it('adds cash to the scanned card', async () => {
    let asked: unknown
    server.use(
      http.post(apiUrl('/orgs/night-owls/staff/topup'), async ({ request }) => {
        asked = await request.json()
        return HttpResponse.json({ balanceCents: 2250, displayName: 'Gijs Guest' })
      }),
    )
    const { user } = renderApp(<CashTopUpMode slug="night-owls" />)

    await user.click(screen.getByRole('button', { name: 'Scan QR code' }))
    await user.click(screen.getByRole('button', { name: 'Fake camera' }))

    expect(await screen.findByText(/Gijs Guest/)).toBeInTheDocument()
    expect(asked).toMatchObject({ cardUid: '04A2B91C5E8F80', amountCents: 1000 })
  })
})
