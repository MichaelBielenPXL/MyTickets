import { screen, within } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { CardsTab } from './CardsTab'

vi.mock('@/lib/nfc', () => ({ nfcSupported: false, writeCard: vi.fn() }))

const card = (number: string, extra: object = {}) => ({
  id: `id-${number}`,
  number,
  code: `CODE${number}AB`,
  url: `https://tickets.test/c/CODE${number}AB`,
  uid: null,
  locked: false,
  blocked: false,
  linkedTo: null,
  createdAt: '2026-11-19T10:00:00Z',
  writtenAt: null,
  linkedAt: null,
  ...extra,
})

function serve(initial: object[]) {
  let cards = initial
  const calls: string[] = []
  server.use(
    http.get(apiUrl('/orgs/night-owls/admin/cards'), () => HttpResponse.json(cards)),
    http.get(apiUrl('/orgs/night-owls/admin/cards/writing'), () =>
      HttpResponse.json({ ready: true, reason: null }),
    ),
    http.post(apiUrl('/orgs/night-owls/admin/cards'), async ({ request }) => {
      const { count } = (await request.json()) as { count: number }
      const made = Array.from({ length: count }, (_, i) => card(String(i + 1).padStart(4, '0')))
      cards = [...made].reverse()
      calls.push(`create ${count}`)
      return HttpResponse.json(made)
    }),
    http.put(apiUrl('/orgs/night-owls/admin/cards/:id/blocked'), async ({ params, request }) => {
      calls.push(`blocked ${params.id} ${JSON.stringify(await request.json())}`)
      return new HttpResponse(null, { status: 204 })
    }),
    http.delete(apiUrl('/orgs/night-owls/admin/cards/:id/link'), ({ params }) => {
      calls.push(`unlink ${params.id}`)
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return calls
}

describe('CardsTab', () => {
  it('creates cards and offers the file for the card printer', async () => {
    const calls = serve([])
    const { user } = renderApp(<CardsTab slug="night-owls" />)

    await user.clear(await screen.findByLabelText('How many cards'))
    await user.type(screen.getByLabelText('How many cards'), '3')
    await user.click(screen.getByRole('button', { name: 'Create cards' }))

    expect(await screen.findByText('0003')).toBeInTheDocument()
    expect(within(screen.getByRole('list')).getAllByText('Not written')).toHaveLength(3)
    expect(calls).toEqual(['create 3'])
    expect(screen.getByRole('link', { name: 'Download for the card printer' })).toHaveAttribute(
      'href',
      '/api/orgs/night-owls/admin/cards/export',
    )
  })

  it('shows who has a card, and blocks or unlinks it', async () => {
    const calls = serve([
      card('0002', { uid: '04A2B91C', writtenAt: '2026-11-19T10:00:00Z' }),
      card('0001', { uid: '04A2B91D', linkedTo: { name: 'Gijs Guest' }, linkedAt: '2026-11-19T11:00:00Z' }),
    ])
    const { user } = renderApp(<CardsTab slug="night-owls" />)

    const linked = (await screen.findByText('0001')).closest('li')!
    expect(within(linked).getByText('Gijs Guest')).toBeInTheDocument()
    await user.click(within(linked).getByRole('button', { name: 'Block' }))
    await user.click(within(linked).getByRole('button', { name: 'Unlink' }))
    await user.click(screen.getByRole('button', { name: 'Ready' }))

    expect(screen.queryByText('0001')).not.toBeInTheDocument()
    expect(screen.getByText('0002')).toBeInTheDocument()
    await vi.waitFor(() => expect(calls).toEqual(['blocked id-0001 {"blocked":true}', 'unlink id-0001']))
  })

  it('explains that writing cards needs Chrome on Android', async () => {
    serve([])
    renderApp(<CardsTab slug="night-owls" />)

    expect(await screen.findByText('Writing cards needs Chrome on an Android phone.')).toBeInTheDocument()
  })
})
