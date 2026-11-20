import { screen, within } from '@testing-library/react'

import { writeCard } from '@/lib/nfc'
import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { CardsTab } from './CardsTab'

// On an Android phone with Chrome: cards can be written.
vi.mock('@/lib/nfc', () => ({ nfcSupported: true, writeCard: vi.fn() }))

const unwritten = {
  id: 'c7',
  number: '0007',
  code: 'ABCDEFGHJK',
  url: 'https://tickets.test/c/ABCDEFGHJK',
  uid: null,
  locked: false,
  blocked: false,
  linkedTo: null,
  createdAt: '2026-11-19T10:00:00Z',
  writtenAt: null,
  linkedAt: null,
}

describe('CardsTab on a phone that writes cards', () => {
  it('writes one particular card straight from the list', async () => {
    const reports: unknown[] = []
    server.use(
      http.get(apiUrl('/orgs/night-owls/admin/cards'), () => HttpResponse.json([unwritten])),
      http.get(apiUrl('/orgs/night-owls/admin/cards/writing'), () =>
        HttpResponse.json({ ready: true, reason: null }),
      ),
      http.post(apiUrl('/orgs/night-owls/admin/cards/c7/written'), async ({ request }) => {
        reports.push(await request.json())
        return HttpResponse.json({ ...unwritten, uid: '04A2B91C' })
      }),
    )
    vi.mocked(writeCard).mockResolvedValue({ serialNumber: '04:a2:b9:1c' })
    const { user } = renderApp(<CardsTab slug="night-owls" />)

    const row = (await screen.findByText('0007')).closest('li')!
    await user.click(await within(row).findByRole('button', { name: 'Write to chip' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Card 0007 is written.')
    expect(writeCard).toHaveBeenCalledWith('https://tickets.test/c/ABCDEFGHJK', expect.anything())
    expect(reports).toEqual([{ uid: '04:a2:b9:1c', locked: true }])
  })
})
