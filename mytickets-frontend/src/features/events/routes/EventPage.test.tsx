import { screen } from '@testing-library/react'

import { HttpResponse, aMe, aTicketType, anEvent, anOrganisation, apiUrl, http, jsonError } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { EventPage } from './EventPage'

const page = { at: '/night-owls/events/event-1', path: '/:slug/events/:eventId' }

beforeEach(() => {
  server.use(
    // Signed in with an account at Night Owls.
    http.get(apiUrl('/auth/me'), () => HttpResponse.json(aMe())),
  )
})

function serve(event = anEvent(), organisation = anOrganisation()) {
  server.use(
    http.get(apiUrl('/orgs/night-owls/events/event-1'), () => HttpResponse.json(event)),
    http.get(apiUrl('/orgs/night-owls'), () => HttpResponse.json(organisation)),
  )
}

describe('EventPage', () => {
  it('shows a member their discounted price next to the normal one', async () => {
    serve()
    renderApp(<EventPage />, page)

    expect(await screen.findByRole('heading', { name: 'Halloween Bash' })).toBeInTheDocument()
    expect(screen.getByText(/12,50/)).toBeInTheDocument()
    expect(screen.getByText(/6,25/)).toBeInTheDocument()
    expect(screen.getByText('Only 3 left')).toBeInTheDocument()
  })

  it('does not let someone pick more tickets than are left', async () => {
    serve(anEvent({ ticketTypes: [aTicketType({ available: 2 })] }))
    const { user } = renderApp(<EventPage />, page)

    const more = await screen.findByRole('button', { name: 'More Regular' })
    await user.click(more)
    await user.click(more)

    expect(screen.getByRole('status', { name: 'Regular quantity' })).toHaveTextContent('2')
    expect(more).toBeDisabled()
  })

  it('sends the order and takes the buyer to the checkout', async () => {
    serve()
    let order: unknown
    server.use(
      http.post(apiUrl('/orgs/night-owls/events/event-1/order'), async ({ request }) => {
        order = await request.json()
        return HttpResponse.json({ checkoutUrl: '/checkout/pay-1' })
      }),
    )
    const { user } = renderApp(<EventPage />, page)

    await user.click(await screen.findByRole('button', { name: 'More Regular' }))
    await user.click(screen.getByRole('button', { name: 'More Regular' }))
    await user.click(screen.getByRole('button', { name: /^Pay €\s12,50/ }))

    expect(await screen.findByText('Now at /checkout/pay-1')).toBeInTheDocument()
    expect(order).toEqual({ items: [{ ticketTypeId: 'type-regular', quantity: 2 }], payWith: 'online' })
  })

  it('offers paying with tokens only when there are enough of them', async () => {
    serve(anEvent(), anOrganisation({ balanceCents: 500 }))
    const { user } = renderApp(<EventPage />, page)

    await user.click(await screen.findByRole('button', { name: 'More Regular' }))

    expect(screen.getByRole('button', { name: /Pay with tokens/ })).toBeDisabled()
  })

  it('tells the buyer when the tickets were sold in the meantime', async () => {
    serve()
    server.use(
      http.post(apiUrl('/orgs/night-owls/events/event-1/order'), () =>
        jsonError(409, 'Not enough "Regular" tickets left.'),
      ),
    )
    const { user } = renderApp(<EventPage />, page)

    await user.click(await screen.findByRole('button', { name: 'More Regular' }))
    await user.click(screen.getByRole('button', { name: /^Pay €/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Not enough "Regular" tickets left.')
  })

  it('asks visitors who have not joined to join, instead of letting them pick tickets', async () => {
    serve(anEvent(), anOrganisation({ membership: null, balanceCents: null }))
    renderApp(<EventPage />, page)

    expect(await screen.findByRole('link', { name: 'Join Night Owls' })).toHaveAttribute(
      'href',
      '/night-owls',
    )
    expect(screen.queryByRole('button', { name: 'More Regular' })).not.toBeInTheDocument()
  })

  it('says why a ticket cannot be bought', async () => {
    serve(
      anEvent({
        ticketTypes: [
          aTicketType({ id: 'a', name: 'Early bird', available: 0 }),
          aTicketType({ id: 'b', name: 'Crew', allowedForYou: false, membersOnly: true }),
          aTicketType({ id: 'c', name: 'Late', onSale: false }),
        ],
      }),
    )
    renderApp(<EventPage />, page)

    expect(await screen.findByText('Sold out')).toBeInTheDocument()
    expect(screen.getByText('Not for your membership')).toBeInTheDocument()
    expect(screen.getByText('Sales closed')).toBeInTheDocument()
  })
})
