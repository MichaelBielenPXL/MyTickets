import { screen } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { CheckoutPage } from './CheckoutPage'

const page = { at: '/night-owls/checkout/p-1', path: '/:slug/checkout/:paymentId' }

function aPayment(overrides: object = {}) {
  return {
    id: '3f2a9c1e-0000-0000-0000-000000000000',
    amountCents: 2500,
    description: '2 ticket(s) for Halloween Bash',
    purpose: 'Tickets',
    status: 'Paid',
    provider: 'Stripe',
    createdAt: '2026-11-17T12:00:00Z',
    completedAt: '2026-11-17T12:01:00Z',
    organisationName: 'Night Owls',
    organisationSlug: 'night-owls',
    ...overrides,
  }
}

/** Stripe's answer for this payment changes over time, like a real bank confirming. */
function serveStatuses(...statuses: string[]) {
  let asked = 0
  server.use(
    http.post(apiUrl('/orgs/night-owls/payments/p-1/refresh'), () =>
      HttpResponse.json(aPayment({ status: statuses[Math.min(asked++, statuses.length - 1)] })),
    ),
  )
  return () => asked
}

describe('CheckoutPage', () => {
  it('confirms a paid order with a reference and the way to the tickets', async () => {
    serveStatuses('Paid')
    renderApp(<CheckoutPage />, page)

    expect(await screen.findByRole('heading', { name: 'Payment received' })).toBeInTheDocument()
    expect(screen.getByText('3F2A9C1E')).toBeInTheDocument()
    expect(screen.getByText(/25,00/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View my tickets' })).toHaveAttribute(
      'href',
      '/night-owls/tickets',
    )
  })

  it('waits while the bank confirms, without asking to pay again, then confirms', async () => {
    const asked = serveStatuses('Pending', 'Paid')
    renderApp(<CheckoutPage />, page)

    expect(await screen.findByRole('heading', { name: 'Confirming your payment…' })).toBeInTheDocument()
    expect(screen.getByText(/don.t need to pay again/)).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'Payment received' }, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(asked()).toBeGreaterThanOrEqual(2)
  })

  it('says plainly when nothing was charged and offers to try again', async () => {
    serveStatuses('Failed')
    renderApp(<CheckoutPage />, page)

    expect(await screen.findByRole('heading', { name: 'Payment not completed' })).toBeInTheDocument()
    expect(screen.getByText(/Nothing was charged, and the tickets went back on sale/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/night-owls')
  })

  it('shows the test checkout buttons only for test payments', async () => {
    server.use(
      http.post(apiUrl('/orgs/night-owls/payments/p-1/refresh'), () =>
        HttpResponse.json(aPayment({ status: 'Pending', provider: 'Fake' })),
      ),
    )
    renderApp(<CheckoutPage />, page)

    expect(await screen.findByText(/Test checkout: no real money is taken/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Pay/ })).toBeInTheDocument()
  })

  it('closes the payment when the buyer comes back from Stripe without paying', async () => {
    let cancelled = false
    server.use(
      http.post(apiUrl('/orgs/night-owls/payments/p-1/cancel'), () => {
        cancelled = true
        return HttpResponse.json(aPayment({ status: 'Failed' }))
      }),
    )
    renderApp(<CheckoutPage />, { at: '/night-owls/checkout/p-1?cancelled=1', path: page.path })

    expect(await screen.findByRole('heading', { name: 'Payment not completed' })).toBeInTheDocument()
    expect(cancelled).toBe(true)
  })
})
