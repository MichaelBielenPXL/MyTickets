import { screen } from '@testing-library/react'

import { HttpResponse, apiUrl, http, jsonError } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { BarMode } from './BarMode'

const products = [
  { id: 'beer', name: 'Beer', priceCents: 250, returnable: false },
  { id: 'cocktail', name: 'Cocktail', priceCents: 700, returnable: false },
  { id: 'cup', name: 'Cup', priceCents: 100, returnable: true },
]

type Sale = { cardUid: string; requestId: string; items: unknown[] }

function renderBar() {
  return renderApp(<BarMode slug="night-owls" products={products} onMenuChanged={() => {}} />)
}

async function tapCard(user: ReturnType<typeof renderBar>['user'], uid = '04A2B91C5E8F80') {
  await user.type(screen.getByLabelText('Card number'), uid)
  await user.click(screen.getByRole('button', { name: 'Use' }))
}

describe('BarMode', () => {
  it('charges the order to the tapped card and starts a fresh order', async () => {
    const sales: Sale[] = []
    server.use(
      http.post(apiUrl('/orgs/night-owls/staff/charge'), async ({ request }) => {
        sales.push((await request.json()) as Sale)
        return HttpResponse.json({ totalCents: 960, balanceCents: 1040, displayName: 'Gijs Guest' })
      }),
    )
    const { user } = renderBar()

    await user.click(screen.getByRole('button', { name: /^Beer/ }))
    await user.click(screen.getByRole('button', { name: /^Beer/ }))
    await user.click(screen.getByRole('button', { name: /^Cocktail/ }))
    expect(screen.getByText('Total').parentElement).toHaveTextContent('12,00')
    await tapCard(user)

    // The server decides the amount (member discount), so the banner shows its total, not ours.
    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent('Paid € 9,60')
    expect(banner).toHaveTextContent('Gijs Guest · € 10,40 left')
    expect(sales[0]).toMatchObject({
      cardUid: '04A2B91C5E8F80',
      items: [
        { productId: 'beer', quantity: 2 },
        { productId: 'cocktail', quantity: 1 },
      ],
    })
    expect(screen.queryByText('Total')).not.toBeInTheDocument()
  })

  it('keeps the order and reuses the same sale id when a charge fails, so a retry cannot charge twice', async () => {
    const sales: Sale[] = []
    server.use(
      http.post(apiUrl('/orgs/night-owls/staff/charge'), async ({ request }) => {
        sales.push((await request.json()) as Sale)
        return sales.length === 1
          ? jsonError(402, 'Not enough credit: € 2,00 on the card, € 7,00 needed.')
          : HttpResponse.json({ totalCents: 700, balanceCents: 0, displayName: 'Gijs Guest' })
      }),
    )
    const { user } = renderBar()

    await user.click(screen.getByRole('button', { name: /^Cocktail/ }))
    await tapCard(user)
    expect(await screen.findByRole('status')).toHaveTextContent('Not enough credit')
    expect(screen.getByText('Total')).toBeInTheDocument()

    await tapCard(user)
    expect(await screen.findByText(/Paid/)).toBeInTheDocument()
    expect(sales[1].requestId).toBe(sales[0].requestId)
  })

  it('uses a new sale id for the next guest', async () => {
    const sales: Sale[] = []
    server.use(
      http.post(apiUrl('/orgs/night-owls/staff/charge'), async ({ request }) => {
        sales.push((await request.json()) as Sale)
        return HttpResponse.json({ totalCents: 250, balanceCents: 0, displayName: 'Gijs Guest' })
      }),
    )
    const { user } = renderBar()

    for (const card of ['04A2B91C5E8F80', '04FFFFFFFFFF80']) {
      await user.click(screen.getByRole('button', { name: /^Beer/ }))
      await tapCard(user, card)
      await screen.findByText(/Paid/)
    }

    expect(sales).toHaveLength(2)
    expect(sales[1].requestId).not.toBe(sales[0].requestId)
  })

  it('shows the credit on a card when nothing is ordered, without charging', async () => {
    server.use(
      http.post(apiUrl('/orgs/night-owls/staff/lookup'), () =>
        HttpResponse.json({
          name: 'Gijs Guest',
          balanceCents: 1040,
          tier: 'Premium',
          membershipActive: true,
        }),
      ),
    )
    const { user } = renderBar()

    await tapCard(user)

    expect(await screen.findByRole('status')).toHaveTextContent('Gijs Guest: € 10,40')
  })

  it('takes cups back: a full return goes onto the card', async () => {
    const sales: Sale[] = []
    server.use(
      http.post(apiUrl('/orgs/night-owls/staff/charge'), async ({ request }) => {
        sales.push((await request.json()) as Sale)
        return HttpResponse.json({ totalCents: -200, balanceCents: 1240, displayName: 'Gijs Guest' })
      }),
    )
    const { user } = renderBar()

    await user.click(screen.getByRole('button', { name: 'Cup back' }))
    await user.click(screen.getByRole('button', { name: 'Cup back' }))
    expect(screen.getByText('Back onto the card').parentElement).toHaveTextContent('2,00')
    await tapCard(user)

    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent('Gave back € 2,00')
    expect(banner).toHaveTextContent('Gijs Guest · € 12,40 on the card')
    expect(sales[0].items).toEqual([{ productId: 'cup', quantity: -2 }])
  })

  it('takes a returned cup off the next round', async () => {
    const sales: Sale[] = []
    server.use(
      http.post(apiUrl('/orgs/night-owls/staff/charge'), async ({ request }) => {
        sales.push((await request.json()) as Sale)
        return HttpResponse.json({ totalCents: 250, balanceCents: 500, displayName: 'Gijs Guest' })
      }),
    )
    const { user } = renderBar()

    await user.click(screen.getByRole('button', { name: /^Beer/ }))
    await user.click(screen.getByRole('button', { name: /^Cup\s*€/ }))
    await user.click(screen.getByRole('button', { name: 'Cup back' }))
    // 2,50 + 1,00 for the new cup - 1,00 for the old one
    expect(screen.getByText('Total').parentElement).toHaveTextContent('2,50')
    await tapCard(user)

    expect(await screen.findByText(/Paid/)).toBeInTheDocument()
    expect(sales[0].items).toEqual([
      { productId: 'beer', quantity: 1 },
      { productId: 'cup', quantity: 1 },
      { productId: 'cup', quantity: -1 },
    ])
  })

  it('offers returns only for deposits', () => {
    renderBar()

    expect(screen.getByRole('button', { name: 'Cup back' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Beer back' })).not.toBeInTheDocument()
  })
})
