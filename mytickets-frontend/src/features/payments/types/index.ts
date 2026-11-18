export interface Payment {
  id: string
  amountCents: number
  description: string
  purpose: 'TopUp' | 'Tickets' | 'Membership'
  status: 'Pending' | 'Paid' | 'Failed'
  /** "Stripe" for a real payment, "Fake" for the test checkout used on a developer's machine. */
  provider: string
  createdAt: string
  completedAt: string | null
  organisationName: string
  organisationSlug: string
}
