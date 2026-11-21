import { screen } from '@testing-library/react'

import { writeCard } from '@/lib/nfc'
import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import type { AdminCard } from '../types'
import { WriteCards } from './WriteCards'
import { useCardWriter } from './useCardWriter'

/** The panel as Manage › Cards shows it, with its own writer. */
function Panel({ cards }: { cards: AdminCard[] }) {
  return <WriteCards writer={useCardWriter('night-owls')} cards={cards} />
}

vi.mock('@/lib/nfc', () => ({ nfcSupported: true, writeCard: vi.fn() }))
// The camera is not there in tests: the stand-in "scans" the QR printed on card 42.
vi.mock('@/components/QrScanner', () => ({
  QrScanner: ({ onScan }: { onScan: (code: string) => void }) => (
    <button onClick={() => onScan('https://tickets.test/c/ABCDEFGHJK')}>Fake camera</button>
  ),
}))

const printed = {
  id: 'c42',
  number: '42',
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

function serve({ failFirstReport = false } = {}) {
  const reports: unknown[] = []
  server.use(
    http.get(apiUrl('/orgs/night-owls/admin/cards/writing'), () =>
      HttpResponse.json({ ready: true, reason: null }),
    ),
    http.post(apiUrl('/orgs/night-owls/admin/cards/blank'), () =>
      HttpResponse.json({ ...printed, id: 'c43', number: '43', url: 'https://tickets.test/c/BBBBBBBBBB' }),
    ),
    http.post(apiUrl('/orgs/night-owls/admin/cards/:id/written'), async ({ params, request }) => {
      reports.push({ id: params.id, ...((await request.json()) as object) })
      if (failFirstReport && reports.length === 1) return HttpResponse.error()
      return HttpResponse.json({ ...printed, uid: '04A2B91C' })
    }),
  )
  return reports
}

beforeEach(() => vi.mocked(writeCard).mockReset())

describe('WriteCards', () => {
  it('writes a printed card after scanning its QR code, and records the chip', async () => {
    const reports = serve()
    vi.mocked(writeCard).mockResolvedValue({ serialNumber: '04:a2:b9:1c' })
    const { user } = renderApp(<Panel cards={[printed]} />)

    expect(
      await screen.findByText("Cards are locked after writing and can't be changed."),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Write a printed card' }))
    await user.click(screen.getByRole('button', { name: 'Fake camera' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Card 42 is written.')
    expect(writeCard).toHaveBeenCalledWith('https://tickets.test/c/ABCDEFGHJK', expect.anything())
    expect(reports).toEqual([{ id: 'c42', uid: '04:a2:b9:1c', locked: true }])
  })

  it('writes a blank card as a new card', async () => {
    const reports = serve()
    vi.mocked(writeCard).mockResolvedValue({ serialNumber: '04:a2:b9:1d' })
    const { user } = renderApp(<Panel cards={[]} />)

    await user.click(await screen.findByRole('button', { name: 'Write a blank card' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Card 43 is written.')
    expect(writeCard).toHaveBeenCalledWith('https://tickets.test/c/BBBBBBBBBB', expect.anything())
    expect(reports).toEqual([{ id: 'c43', uid: '04:a2:b9:1d', locked: true }])
  })

  it('only sends the chip again when recording it failed', async () => {
    const reports = serve({ failFirstReport: true })
    vi.mocked(writeCard).mockResolvedValue({ serialNumber: '04:a2:b9:1c' })
    const { user } = renderApp(<Panel cards={[printed]} />)

    await user.click(await screen.findByRole('button', { name: 'Write a printed card' }))
    await user.click(screen.getByRole('button', { name: 'Fake camera' }))
    await user.click(await screen.findByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Card 42 is written.')
    expect(writeCard).toHaveBeenCalledTimes(1)
    expect(reports).toHaveLength(2)
  })

  it('offers to reuse a blocked card nobody has when its QR is scanned', async () => {
    serve()
    const unblocked: unknown[] = []
    server.use(
      http.put(apiUrl('/orgs/night-owls/admin/cards/c42/blocked'), async ({ request }) => {
        unblocked.push(await request.json())
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const blocked = { ...printed, uid: '04A2B91C', blocked: true }
    const { user } = renderApp(<Panel cards={[blocked]} />)

    await user.click(await screen.findByRole('button', { name: 'Write a printed card' }))
    await user.click(screen.getByRole('button', { name: 'Fake camera' }))
    expect(screen.getByText('Card 42 is blocked and nobody has it.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reuse as a new card' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Card 42 is ready to be linked again.')
    expect(unblocked).toEqual([{ blocked: false }])
    expect(writeCard).not.toHaveBeenCalled()
  })

  it('says why when a scanned QR is not one of these cards', async () => {
    serve()
    const { user } = renderApp(<Panel cards={[]} />)

    await user.click(await screen.findByRole('button', { name: 'Write a printed card' }))
    await user.click(screen.getByRole('button', { name: 'Fake camera' }))

    expect(await screen.findByText("This QR code isn't one of your cards.")).toBeInTheDocument()
  })
})
