export interface Payment {
  id: string
  amountCents: number
  description: string
  purpose: 'TopUp' | 'Tickets' | 'Membership'
  status: 'Pending' | 'Paid' | 'Failed'
  provider: string
  organisationName: string
  organisationSlug: string
}
