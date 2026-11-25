import { screen } from '@testing-library/react'

import { renderApp } from '@/test/render'

import type { MyTicket } from '../types'
import { TicketCard } from './TicketCard'

const ticket: MyTicket = {
  id: 't1',
  code: 'A1B2C3',
  status: 'Valid',
  checkedInAt: null,
  ticketType: 'Early bird',
  eventId: 'e1',
  eventName: 'Halloween Party',
  startsAt: '2026-10-31T21:00:00Z',
  location: '',
  organisationName: 'Night Owls',
  organisationSlug: 'night-owls',
}

describe('TicketCard', () => {
  it('downloads the ticket as the PDF the server makes, in the app’s language', () => {
    renderApp(<TicketCard ticket={ticket} open onToggle={() => {}} />)

    const link = screen.getByRole('link', { name: 'Download PDF' })
    expect(link).toHaveAttribute('href', '/api/orgs/night-owls/me/tickets/t1/pdf?lang=en')
    expect(link).toHaveAttribute('download')
  })
})
