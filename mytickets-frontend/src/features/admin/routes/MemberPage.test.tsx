import { screen, within } from '@testing-library/react'

import { HttpResponse, aMe, aMembership, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { MemberPage } from './MemberPage'

const gijs = {
  id: 'm1',
  displayName: 'Gijs Guest',
  email: 'gijs@example.com',
  role: 'Member',
  tierId: 'tier-free',
  tier: 'Member 2026-2027',
  joinedAt: '2025-09-25T10:00:00Z',
  expiresAt: '2027-06-30T22:00:00Z',
  membershipActive: true,
  balanceCents: 1250,
  extraCardAllowed: false,
  firstName: 'Gijs',
  lastName: 'Guest',
  phone: '0470 12 34 56',
  street: null,
  postalCode: null,
  city: null,
  school: null,
  faculty: null,
  studyYear: null,
  fields: { phone: 'Optional', address: 'Off', school: 'Off', faculty: 'Off', studyYear: 'Off' },
  profile: {
    firstName: 'Gijs',
    lastName: 'Guest',
    phone: '0470 12 34 56',
    street: null,
    postalCode: null,
    city: null,
    school: null,
    faculty: null,
    studyYear: null,
  },
  cards: [{ number: '7', label: '', blocked: false, linkedAt: '2025-10-01T10:00:00Z' }],
  history: [
    {
      id: 'p1',
      tierName: 'Member 2025-2026',
      startedAt: '2025-09-25T10:00:00Z',
      endsAt: '2026-06-30T22:00:00Z',
      current: false,
    },
  ],
}

function serve(role: string) {
  const sent: { profile: unknown[]; extraCard: unknown[]; member: unknown[] } = {
    profile: [],
    extraCard: [],
    member: [],
  }
  server.use(
    http.get(apiUrl('/auth/me'), () => HttpResponse.json(aMe({ memberships: [aMembership({ role })] }))),
    http.get(apiUrl('/orgs/night-owls/staff/members/m1'), () => HttpResponse.json(gijs)),
    http.get(apiUrl('/orgs/night-owls/admin/tiers'), () =>
      HttpResponse.json([
        { id: 'tier-free', name: 'Member 2026-2027', endsOn: null },
        { id: 'tier-old', name: 'Season 2024', endsOn: '2024-06-30' },
        { id: 'tier-board', name: 'Board', endsOn: '2099-06-30' },
      ]),
    ),
    http.put(apiUrl('/orgs/night-owls/admin/members/m1'), async ({ request }) => {
      sent.member.push(await request.json())
      return new HttpResponse(null, { status: 204 })
    }),
    http.put(apiUrl('/orgs/night-owls/admin/members/m1/profile'), async ({ request }) => {
      sent.profile.push(await request.json())
      return new HttpResponse(null, { status: 204 })
    }),
    http.put(apiUrl('/orgs/night-owls/admin/members/m1/extra-card'), async ({ request }) => {
      sent.extraCard.push(await request.json())
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return sent
}

const renderPage = () =>
  renderApp(<MemberPage />, { at: '/night-owls/members/m1', path: '/:slug/members/:memberId' })

describe('MemberPage', () => {
  it("lets an admin correct a member's details and allow one more card", async () => {
    const sent = serve('Admin')
    const { user } = renderPage()

    expect(await screen.findByRole('heading', { name: 'Gijs Guest' })).toBeInTheDocument()
    const details = within(screen.getByRole('region', { name: 'Details' }))
    const lastName = await details.findByLabelText(/Last name/)
    await user.clear(lastName)
    await user.type(lastName, 'Gast')
    await user.click(details.getByRole('button', { name: 'Save details' }))
    await vi.waitFor(() => expect(sent.profile).toMatchObject([{ firstName: 'Gijs', lastName: 'Gast' }]))

    await user.click(screen.getByRole('button', { name: 'Allow one extra card' }))
    await vi.waitFor(() => expect(sent.extraCard).toEqual([{ allowed: true }]))

    expect(screen.getByText('Card 7')).toBeInTheDocument()
    expect(screen.getByText('Member 2025-2026')).toBeInTheDocument()
  })

  it('assigns another membership type, but not one that has ended', async () => {
    const sent = serve('Admin')
    const { user } = renderPage()

    const type = await screen.findByRole('combobox', { name: 'Membership type' })
    expect(await within(type).findByRole('option', { name: 'Season 2024 (ended)' })).toBeDisabled()
    await user.selectOptions(type, 'Board')

    await vi.waitFor(() => expect(sent.member).toMatchObject([{ tierId: 'tier-board', role: 'Member' }]))
  })

  it('shows staff the same page without anything to change', async () => {
    serve('Staff')
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Gijs Guest' })).toBeInTheDocument()
    expect(screen.getByText('0470 12 34 56')).toBeInTheDocument()
    expect(screen.getByText('Member 2025-2026')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save details' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Members/ })).toHaveAttribute(
      'href',
      '/night-owls/staff?mode=members',
    )
  })
})
