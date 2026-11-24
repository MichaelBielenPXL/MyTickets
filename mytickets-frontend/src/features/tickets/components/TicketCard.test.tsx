import { screen } from '@testing-library/react'

import { renderApp } from '@/test/render'

import type { MyTicket } from '../types'
import { downloadTicketPdf } from '../utils/ticket-pdf'
import { TicketCard } from './TicketCard'

vi.mock('../utils/ticket-pdf', () => ({ downloadTicketPdf: vi.fn(() => Promise.resolve()) }))

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
  it('downloads the ticket as a PDF, with the holder’s name', async () => {
    const { user } = renderApp(
      <TicketCard ticket={ticket} holderName="Gijs Guest" open onToggle={() => {}} />,
    )

    await user.click(screen.getByRole('button', { name: 'Download PDF' }))

    expect(downloadTicketPdf).toHaveBeenCalledWith(ticket, 'Gijs Guest')
  })
})
