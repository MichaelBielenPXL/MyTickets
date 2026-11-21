import { screen } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { MemberInfoMode } from './MemberInfoMode'

// The camera is not there in tests: the stand-in "scans" a card's printed QR code.
vi.mock('@/components/QrScanner', () => ({
  QrScanner: ({ onScan }: { onScan: (code: string) => void }) => (
    <button onClick={() => onScan('https://cards.example/c?uid=04A2B91C5E8F80')}>Fake camera</button>
  ),
}))

function serve() {
  const searches: string[] = []
  server.use(
    http.get(apiUrl('/orgs/night-owls/staff/members'), ({ request }) => {
      const search = new URL(request.url).searchParams.get('search') ?? ''
      searches.push(search)
      const all = [
        {
          id: 'm1',
          displayName: 'Gijs Guest',
          email: 'gijs@example.com',
          tier: 'Member 2026-2027',
          membershipActive: true,
        },
      ]
      return HttpResponse.json(all.filter((m) => m.displayName.toLowerCase().includes(search.toLowerCase())))
    }),
    http.post(apiUrl('/orgs/night-owls/staff/lookup'), () =>
      HttpResponse.json({ name: 'Gijs Guest', memberId: 'm1' }),
    ),
  )
  return searches
}

describe('MemberInfoMode', () => {
  it('finds a member by name and links to their page', async () => {
    const searches = serve()
    const { user } = renderApp(<MemberInfoMode slug="night-owls" />)

    await user.type(screen.getByRole('searchbox', { name: 'Search members' }), 'gij')
    await vi.waitFor(() => expect(searches).toContain('gij'))

    expect(await screen.findByRole('link', { name: /Gijs Guest/ })).toHaveAttribute(
      'href',
      '/night-owls/members/m1',
    )
  })

  it("opens the page of the member whose card's QR code is scanned", async () => {
    serve()
    const { user } = renderApp(<MemberInfoMode slug="night-owls" />)

    await user.click(screen.getByRole('button', { name: 'Scan QR code' }))
    await user.click(screen.getByRole('button', { name: 'Fake camera' }))

    expect(await screen.findByText('Now at /night-owls/members/m1')).toBeInTheDocument()
  })
})
