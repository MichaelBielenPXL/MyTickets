import { screen } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { TicketsPage } from './TicketsPage'

const ticket = (id: string, eventName: string, daysFromNow: number) => ({
  id,
  code: `CODE${id}`,
  status: 'Valid',
  checkedInAt: null,
  ticketType: 'Regular',
  eventId: `e-${id}`,
  eventName,
  startsAt: new Date(Date.now() + daysFromNow * 24 * 3600 * 1000).toISOString(),
  location: '',
  organisationName: 'Night Owls',
  organisationSlug: 'night-owls',
})

const renderPage = () => renderApp(<TicketsPage />, { at: '/night-owls/tickets', path: '/:slug/tickets' })

describe('TicketsPage', () => {
  it('shows upcoming tickets, and past ones only when the history is opened', async () => {
    server.use(
      http.get(apiUrl('/orgs/night-owls/me/tickets'), () =>
        HttpResponse.json([ticket('1', 'Winter Ball', 10), ticket('2', 'Halloween Party', -20)]),
      ),
    )
    const { user } = renderPage()

    expect(await screen.findByText('Winter Ball')).toBeInTheDocument()
    expect(screen.queryByText('Halloween Party')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show ticket history (1)' }))
    expect(screen.getByRole('heading', { name: 'Ticket history' })).toBeInTheDocument()
    expect(screen.getByText('Halloween Party')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hide ticket history' }))
    expect(screen.queryByText('Halloween Party')).not.toBeInTheDocument()
  })

  it('says there is nothing coming up when all tickets are past', async () => {
    server.use(
      http.get(apiUrl('/orgs/night-owls/me/tickets'), () =>
        HttpResponse.json([ticket('2', 'Halloween Party', -20)]),
      ),
    )
    renderPage()

    expect(await screen.findByText(/No upcoming tickets/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show ticket history (1)' })).toBeInTheDocument()
  })
})
