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
  durationDays: 365,
  isPublic: true,
  ticketDiscountPercent: 50,
  drinkDiscountPercent: 20,
}

export const freeTier = {
  ...premiumTier,
  id: 'tier-free',
  name: 'Member',
  priceCents: 0,
  durationDays: null,
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
