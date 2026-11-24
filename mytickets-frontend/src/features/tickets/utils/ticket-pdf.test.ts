import type { MyTicket } from '../types'
import { downloadTicketPdf } from './ticket-pdf'

// The real PDF, with "save to disk" caught: what would have been saved is kept here instead.
const saved = vi.hoisted(() => [] as { name: string; pdf: string; pages: number }[])
vi.mock('jspdf', async (importOriginal) => {
  const real = await importOriginal<typeof import('jspdf')>()
  class Caught extends real.jsPDF {
    constructor(...args: ConstructorParameters<typeof real.jsPDF>) {
      super(...args)
      this.save = ((name?: string) => {
        saved.push({ name: name ?? '', pdf: this.output(), pages: this.getNumberOfPages() })
        return this
      }) as unknown as typeof this.save
    }
  }
  return { ...real, jsPDF: Caught }
})

const ticket: MyTicket = {
  id: 't1',
  code: 'A1B2C3D4E5F6A7B8C9D0E1F2',
  status: 'Valid',
  checkedInAt: null,
  ticketType: 'Early bird',
  eventId: 'e1',
  eventName: 'Halloween Party',
  startsAt: '2026-10-31T21:00:00Z',
  location: 'De Zwerver, Leuven',
  organisationName: 'Night Owls',
  organisationSlug: 'night-owls',
}

describe('downloadTicketPdf', () => {
  it('saves a one-page PDF with the event, the holder and the code to scan', async () => {
    await downloadTicketPdf(ticket, 'Gijs Guest')

    const [file] = saved
    expect(file.name).toBe('night-owls-halloween-party-early-bird.pdf')
    expect(file.pages).toBe(1)
    expect(file.pdf.startsWith('%PDF-')).toBe(true)
    for (const text of [
      'NIGHT OWLS',
      'Halloween Party',
      'De Zwerver, Leuven',
      'Early bird',
      'Gijs Guest',
      ticket.code,
    ])
      expect(file.pdf).toContain(text)
  })
})
