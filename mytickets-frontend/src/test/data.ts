import { HttpResponse, http } from 'msw'

/** Addresses of the pretend API, so tests read like the real requests. */
export const apiUrl = (path: string) => `*/api${path}`

export const jsonError = (status: number, error: string, extra: object = {}) =>
  HttpResponse.json({ error, ...extra }, { status })

export { HttpResponse, http }

export const premiumTier = {
  id: 'tier-premium',
  name: 'Premium',
  description: '',
  priceCents: 2500,
  endsOn: '2027-06-30',
  requiresApproval: false,
  isPublic: true,
  ticketDiscountPercent: 50,
  drinkDiscountPercent: 20,
}

export const freeTier = {
  ...premiumTier,
  id: 'tier-free',
  name: 'Member',
  priceCents: 0,
  endsOn: null,
  ticketDiscountPercent: 0,
  drinkDiscountPercent: 0,
}

/** An organisation as a signed-in Premium member sees it. Override what the test is about. */
export function anOrganisation(overrides: object = {}) {
  return {
    slug: 'night-owls',
    name: 'Night Owls',
    description: 'Student parties',
    logoUrl: null,
    brandColor: null,
    membership: {
      role: 'Member',
      tierId: premiumTier.id,
      tier: 'Premium',
      expiresAt: '2027-11-16T00:00:00Z',
      active: true,
      ticketDiscountPercent: 50,
      drinkDiscountPercent: 20,
    },
    balanceCents: 2000,
    tiers: [freeTier, premiumTier],
    hasInviteOnlyTiers: false,
    events: [],
    request: null,
    profileComplete: true,
    ...overrides,
  }
}

export function aTicketType(overrides: object = {}) {
  return {
    id: 'type-regular',
    name: 'Regular',
    priceCents: 1250,
    yourPriceCents: 625,
    available: 3,
    maxPerUser: 4,
    salesStartAt: null,
    salesEndAt: null,
    onSale: true,
    allowedForYou: true,
    membersOnly: false,
    owned: 0,
    ...overrides,
  }
}

export function anEvent(overrides: object = {}) {
  return {
    id: 'event-1',
    name: 'Halloween Bash',
    description: '',
    location: 'De Kelder',
    startsAt: '2026-12-05T21:00:00Z',
    endsAt: null,
    ticketTypes: [aTicketType()],
    ...overrides,
  }
}

/**
 * Everything the browser is signed in as, as the "who am I" request answers: here an organiser with
 * an account at Night Owls. Override the accounts a test is about.
 */
export function aMe(overrides: object = {}) {
  return {
    email: 'olga@example.com',
    displayName: 'Olga Organiser',
    isOwner: true,
    canCreateOrganisations: true,
    memberships: [aMembership()],
    ...overrides,
  }
}

/** An account at one organisation. */
export function aMembership(overrides: object = {}) {
  return {
    slug: 'night-owls',
    name: 'Night Owls',
    logoUrl: null,
    role: 'Member',
    tier: 'Premium',
    expiresAt: null,
    userId: 'user-1',
    email: 'olga@example.com',
    displayName: 'Olga Organiser',
    ...overrides,
  }
}

/**
 * Manage › Overview for one period. A €25 membership and a €12.50 top-up paid online; the first carried this
 * month's €2 payout-account fee. One €10 top-up in cash. Override what the test is about.
 */
export function aSummary(overrides: object = {}) {
  return {
    payout: {
      paidCents: 3750,
      feeCents: 187,
      accountFeeCents: 200,
      payoutFeeCents: 0,
      youGetCents: 3363,
      testCents: 0,
      monthlyAccountFeeCents: 200,
    },
    sources: [
      {
        purpose: 'TopUp',
        count: 1,
        paidCents: 1250,
        feeCents: 62,
        accountFeeCents: 0,
        payoutFeeCents: 0,
        netCents: 1188,
      },
      {
        purpose: 'Tickets',
        count: 0,
        paidCents: 0,
        feeCents: 0,
        accountFeeCents: 0,
        netCents: 0,
      },
      {
        purpose: 'Membership',
        count: 1,
        paidCents: 2500,
        feeCents: 125,
        accountFeeCents: 200,
        payoutFeeCents: 0,
        netCents: 2175,
      },
    ],
    cash: { count: 1, cents: 1000 },
    bar: { sales: 12, takingsCents: 34050, depositsOutCents: 400, depositsBackCents: 300 },
    tokens: {
      boughtCents: 2250,
      paidCents: 2250,
      bonusCents: 0,
      spentAtBarCents: 34050,
      spentOnTicketsCents: 0,
      outstandingCents: 12000,
      depositsHeldCents: 100,
    },
    memberships: { active: 42, joined: 5, byType: [{ name: 'Member', active: 42 }] },
    tickets: { sold: 3, revenueCents: 3600, checkedIn: 2 },
    byPeriod: {
      unit: 'day',
      points: [
        { key: '2026-11-21', barCents: 0, barSales: 0, moneyInCents: 0 },
        { key: '2026-11-22', barCents: 34050, barSales: 12, moneyInCents: 4750 },
      ],
    },
    payments: [
      {
        id: 'p2',
        paidAt: '2026-11-22T20:15:00Z',
        purpose: 'TopUp',
        description: 'Top up €12.50',
        amountCents: 1250,
        feeCents: 62,
        accountFeeCents: 0,
        payoutFeeCents: 0,
        netCents: 1188,
        test: false,
      },
      {
        id: 'p1',
        paidAt: '2026-11-22T19:00:00Z',
        purpose: 'Membership',
        description: 'Member membership',
        amountCents: 2500,
        feeCents: 125,
        accountFeeCents: 200,
        payoutFeeCents: 0,
        netCents: 2175,
        test: false,
      },
    ],
    paymentsCount: 2,
    bankPayouts: {
      payouts: [
        { id: 'b1', paidAt: '2026-11-20T06:00:00Z', amountCents: 10000, feeCents: 35, accountFeeCents: 200 },
      ],
      amountCents: 10000,
      feeCents: 235,
      bufferCents: 15,
      owedCents: 0,
      targetBufferCents: 250,
    },
    ...overrides,
  }
}
