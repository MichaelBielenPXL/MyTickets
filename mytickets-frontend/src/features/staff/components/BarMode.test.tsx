import { act, fireEvent, screen, within } from '@testing-library/react'

import { HttpResponse, apiUrl, http, jsonError } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { BarMode } from './BarMode'

// The camera is not there in tests: the stand-in "scans" what `camera.shows`, at first the member code in the app.
const camera = vi.hoisted(() => ({ shows: '' }))
vi.mock('@/components/QrScanner', () => ({
  QrScanner: ({ onScan }: { onScan: (code: string) => void }) => (
    <button onClick={() => onScan(camera.shows)}>Fake camera</button>
  ),
}))
beforeEach(() => {
  camera.shows = 'MTABCD2345WXYZ'
})

const beers = { id: 'beers', name: 'Beers' }
const softs = { id: 'softs', name: 'Soft drinks' }
const products = [
  {
    id: 'beer',
    name: 'Beer',
    priceCents: 250,
    isDeposit: false,
    depositProductId: 'cup',
    categoryId: 'beers',
    color: 'yellow',
  },
  {
    id: 'cola',
    name: 'Cola',
    priceCents: 200,
    isDeposit: false,
    depositProductId: 'cup',
    categoryId: 'softs',
    color: 'red',
  },
  {
    id: 'cocktail',
    name: 'Cocktail',
    priceCents: 700,
    isDeposit: false,
    depositProductId: null,
    categoryId: null,
    color: null,
  },
  {
    id: 'cup',
    name: 'Cup',
    priceCents: 100,
    isDeposit: true,
    depositProductId: null,
    categoryId: null,
    color: null,
  },
]

type Sale = { cardUid: string; requestId: string; items: unknown[] }
type User = ReturnType<typeof renderBar>['user']

function renderBar(categories = [beers, softs]) {
  return renderApp(
    <BarMode slug="night-owls" products={products} categories={categories} onMenuChanged={() => {}} />,
  )
}

/** The order ticket beside the tiles (on a phone, the sheet). */
const ticket = () => within(screen.getByRole('complementary', { name: 'Order' }))

async function payWith(user: User, uid = '04A2B91C5E8F80') {
  await user.click(ticket().getByRole('button', { name: /^(Charge|Give back)/ }))
  await scanCard(user, uid)
}

/** Cards are never typed in: without a card reader (as in tests) staff scan the QR code printed on the card. */
async function scanCard(user: User, uid: string) {
  camera.shows = `https://cards.example/c?uid=${uid}`
  const screenStep = within(screen.getByRole('dialog', { name: 'Tap card' }))
  const scanButton = screenStep.queryByRole('button', { name: 'Scan QR code' })
  if (scanButton) await user.click(scanButton)
  await user.click(await screenStep.findByRole('button', { name: 'Fake camera' }))
}

function answerSales(answer: (sale: Sale, count: number) => Response) {
  const sales: Sale[] = []
  server.use(
    http.post(apiUrl('/orgs/night-owls/staff/charge'), async ({ request }) => {
      sales.push((await request.json()) as Sale)
      return answer(sales[sales.length - 1], sales.length)
    }),
  )
  return sales
}

describe('BarMode', () => {
  it('shows a tab per category, and Other for items without one', async () => {
    const { user } = renderBar()

    expect(screen.getByRole('tab', { name: 'Beers' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: /^Beer/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Cola/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Other' }))
    expect(screen.getByRole('button', { name: /^Cocktail/ })).toBeInTheDocument()
    // The cup tiles stay on every tab.
    expect(screen.getByRole('button', { name: 'Return Cup' })).toBeInTheDocument()
  })

  it('shows every item on one page when there are no categories', () => {
    renderBar([])

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Cola/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Cocktail/ })).toBeInTheDocument()
  })

  it('charges the order on the charge screen and starts a fresh order', async () => {
    const sales = answerSales(() =>
      HttpResponse.json({
        totalCents: 960,
        depositCents: 200,
        balanceCents: 1040,
        displayName: 'Gijs Guest',
      }),
    )
    const { user } = renderBar([])

    await user.click(screen.getByRole('button', { name: /^Beer/ }))
    await user.click(screen.getByRole('button', { name: /^Beer/ }))
    await user.click(screen.getByRole('button', { name: /^Cocktail/ }))
    // Two beers, a cocktail, and a cup for each beer.
    expect(ticket().getByText('2× Cup')).toBeInTheDocument()
    expect(ticket().getByText('2 with drinks')).toBeInTheDocument()
    expect(ticket().getByRole('button', { name: /^Charge €\s14,00$/ })).toBeInTheDocument()
    await payWith(user)

    // The server decides the amount (member discount), so the result shows its total, not ours.
    const result = await screen.findByRole('status')
    expect(result).toHaveTextContent('Paid € 9,60')
    expect(result).toHaveTextContent('Gijs Guest · € 10,40 left')
    expect(sales[0]).toMatchObject({
      cardUid: '04A2B91C5E8F80',
      items: [
        { productId: 'beer', quantity: 2 },
        { productId: 'cocktail', quantity: 1 },
      ],
    })
    await user.click(screen.getByRole('button', { name: 'Next order' }))
    expect(ticket().getByText('Tap items to start an order.')).toBeInTheDocument()
  })

  it("charges the member's QR code, from the app or the wallet, like a card", async () => {
    const sales = answerSales(() =>
      HttpResponse.json({ totalCents: 350, depositCents: 100, balanceCents: 650, displayName: 'Gijs Guest' }),
    )
    const { user } = renderBar([])

    await user.click(screen.getByRole('button', { name: /^Beer/ }))
    await user.click(ticket().getByRole('button', { name: /^Charge/ }))
    const step = within(screen.getByRole('dialog', { name: 'Tap card' }))
    await user.click(step.getByRole('button', { name: 'Scan QR code' }))
    await user.click(step.getByRole('button', { name: 'Fake camera' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Paid € 3,50')
    expect(sales[0].cardUid).toBe('MTABCD2345WXYZ')
  })

  it('changes quantities on the ticket, and holding a tile takes one off', async () => {
    const { user } = renderBar([])

    await user.click(screen.getByRole('button', { name: /^Cocktail/ }))
    await user.click(ticket().getByRole('button', { name: 'One more Cocktail' }))
    expect(ticket().getByRole('button', { name: /^Charge €\s14,00$/ })).toBeInTheDocument()

    vi.useFakeTimers()
    const tile = screen.getByRole('button', { name: /^Cocktail/ })
    fireEvent.pointerDown(tile)
    act(() => vi.advanceTimersByTime(600))
    fireEvent.pointerUp(tile)
    fireEvent.click(tile)
    vi.useRealTimers()

    expect(ticket().getByRole('button', { name: /^Charge €\s7,00$/ })).toBeInTheDocument()
  })

  it('keeps the order and reuses the same sale id when a charge fails, so a retry cannot charge twice', async () => {
    const sales = answerSales((_, n) =>
      n === 1
        ? jsonError(402, 'Not enough tokens: 2 tokens on the card, 7 tokens needed.')
        : HttpResponse.json({ totalCents: 700, depositCents: 0, balanceCents: 0, displayName: 'Gijs Guest' }),
    )
    const { user } = renderBar([])

    await user.click(screen.getByRole('button', { name: /^Cocktail/ }))
    await payWith(user)
    expect(await screen.findByRole('status')).toHaveTextContent('Not enough tokens')

    await user.click(screen.getByRole('button', { name: 'Try another card' }))
    await scanCard(user, '04FFFFFFFFFF80')
    expect(await screen.findByText(/Paid/)).toBeInTheDocument()
    expect(sales[1].requestId).toBe(sales[0].requestId)
  })

  it('uses a new sale id for the next guest', async () => {
    const sales = answerSales(() =>
      HttpResponse.json({ totalCents: 350, depositCents: 100, balanceCents: 0, displayName: 'Gijs Guest' }),
    )
    const { user } = renderBar([])

    for (const card of ['04A2B91C5E8F80', '04FFFFFFFFFF80']) {
      await user.click(screen.getByRole('button', { name: /^Beer/ }))
      await payWith(user, card)
      await screen.findByText(/Paid/)
      await user.click(screen.getByRole('button', { name: 'Next order' }))
    }

    expect(sales).toHaveLength(2)
    expect(sales[1].requestId).not.toBe(sales[0].requestId)
  })

  it('checks the tokens on a card without charging', async () => {
    let charged = false
    server.use(
      http.post(apiUrl('/orgs/night-owls/staff/charge'), () => {
        charged = true
        return HttpResponse.json({})
      }),
      http.post(apiUrl('/orgs/night-owls/staff/lookup'), () =>
        HttpResponse.json({
          name: 'Gijs Guest',
          balanceCents: 1040,
          tier: 'Premium',
          membershipActive: true,
        }),
      ),
    )
    const { user } = renderBar([])

    await user.click(screen.getByRole('button', { name: /^Beer/ }))
    await user.click(ticket().getByRole('button', { name: 'Check tokens' }))
    await scanCard(user, '04A2B91C5E8F80')

    const result = await screen.findByRole('status')
    expect(result).toHaveTextContent('€ 10,40')
    expect(result).toHaveTextContent('Gijs Guest · Premium')
    expect(charged).toBe(false)
  })

  it('takes cups back: a full return goes onto the card', async () => {
    const sales = answerSales(() =>
      HttpResponse.json({
        totalCents: -200,
        depositCents: -200,
        balanceCents: 1240,
        displayName: 'Gijs Guest',
      }),
    )
    const { user } = renderBar([])

    await user.click(screen.getByRole('button', { name: 'Return Cup' }))
    await user.click(screen.getByRole('button', { name: 'Return Cup' }))
    expect(ticket().getByText('2× Cup returned')).toBeInTheDocument()
    expect(ticket().getByText('Back onto the card').parentElement).toHaveTextContent('2,00')
    await payWith(user)

    const result = await screen.findByRole('status')
    expect(result).toHaveTextContent('Gave back € 2,00')
    expect(result).toHaveTextContent('Gijs Guest · € 12,40 on the card')
    expect(sales[0].items).toEqual([{ productId: 'cup', quantity: -2 }])
  })

  it('swaps a returned cup for a new drink at no extra cost', async () => {
    const sales = answerSales(() =>
      HttpResponse.json({ totalCents: 250, depositCents: 0, balanceCents: 500, displayName: 'Gijs Guest' }),
    )
    const { user } = renderBar([])

    await user.click(screen.getByRole('button', { name: /^Beer/ }))
    await user.click(screen.getByRole('button', { name: 'Return Cup' }))
    // 2,50 beer + 1,00 cup - 1,00 cup back
    expect(ticket().getByText('Cup swapped')).toBeInTheDocument()
    expect(ticket().getByRole('button', { name: /^Charge €\s2,50$/ })).toBeInTheDocument()
    await payWith(user)

    expect(await screen.findByText(/Paid/)).toBeInTheDocument()
    // The cup going out is left to the server; only what the bartender entered is sent.
    expect(sales[0].items).toEqual([
      { productId: 'beer', quantity: 1 },
      { productId: 'cup', quantity: -1 },
    ])
  })

  it('sells a cup on its own, and the ticket stepper corrects cups', async () => {
    const sales = answerSales(() =>
      HttpResponse.json({ totalCents: 100, depositCents: 100, balanceCents: 900, displayName: 'Gijs Guest' }),
    )
    const { user } = renderBar([])

    await user.click(screen.getByRole('button', { name: 'Buy Cup' }))
    await user.click(screen.getByRole('button', { name: 'Buy Cup' }))
    await user.click(ticket().getByRole('button', { name: 'Return a Cup' }))
    expect(ticket().getByText('1× Cup')).toBeInTheDocument()
    expect(ticket().getByRole('button', { name: /^Charge €\s1,00$/ })).toBeInTheDocument()
    await payWith(user)

    expect(await screen.findByText(/Paid/)).toBeInTheDocument()
    expect(sales[0].items).toEqual([{ productId: 'cup', quantity: 1 }])
  })
})
