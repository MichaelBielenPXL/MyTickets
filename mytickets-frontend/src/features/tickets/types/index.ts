export interface MyTicket {
  id: string
  /** The secret shown as the QR code. */
  code: string
  status: 'Valid' | 'CheckedIn'
  checkedInAt: string | null
  ticketType: string
  eventId: string
  eventName: string
  startsAt: string
  location: string
  organisationName: string
  organisationSlug: string
}
