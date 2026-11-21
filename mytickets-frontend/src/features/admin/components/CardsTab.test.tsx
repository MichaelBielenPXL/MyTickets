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
      const made = Array.from({ length: count }, (_, i) => card(String(i + 1)))
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
    http.delete(apiUrl('/orgs/night-owls/admin/cards/:id'), ({ params }) => {
      calls.push(`delete ${params.id}`)
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
    // Many numbered cards at once is hard to undo, so it asks first.
    const ask = screen.getByRole('alertdialog', { name: 'Create 3 cards?' })
    expect(within(ask).getByText('They get the numbers 1 to 3.')).toBeInTheDocument()
    await user.click(within(ask).getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('3')).toBeInTheDocument()
    expect(within(screen.getByRole('list')).getAllByText('Not written')).toHaveLength(3)
    expect(calls).toEqual(['create 3'])
    expect(screen.getByRole('link', { name: 'Download for the card printer' })).toHaveAttribute(
      'href',
      '/api/orgs/night-owls/admin/cards/export',
    )
  })

  it('shows who has a card, and blocks or unlinks it', async () => {
    const calls = serve([
      card('2', { uid: '04A2B91C', writtenAt: '2026-11-19T10:00:00Z' }),
      card('1', { uid: '04A2B91D', linkedTo: { name: 'Gijs Guest' }, linkedAt: '2026-11-19T11:00:00Z' }),
    ])
    const { user } = renderApp(<CardsTab slug="night-owls" />)

    const linked = (await screen.findByText('1')).closest('li')!
    expect(within(linked).getByText('Gijs Guest')).toBeInTheDocument()
    // The actions wait behind one button per card, and each asks before it acts.
    await user.click(within(linked).getByRole('button', { name: 'Actions for card 1' }))
    await user.click(within(linked).getByRole('button', { name: 'Block' }))
    await user.click(
      within(screen.getByRole('alertdialog', { name: 'Block card 1?' })).getByRole('button', {
        name: 'Block',
      }),
    )
    await user.click(within(linked).getByRole('button', { name: 'Actions for card 1' }))
    await user.click(within(linked).getByRole('button', { name: 'Unlink' }))
    await user.click(
      within(screen.getByRole('alertdialog', { name: 'Unlink card 1?' })).getByRole('button', {
        name: 'Unlink',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Ready' }))

    expect(screen.queryByText('1')).not.toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    await vi.waitFor(() => expect(calls).toEqual(['blocked id-1 {"blocked":true}', 'unlink id-1']))
  })

  it('keeps blocked cards nobody has out of the way, and reuses one that turns up', async () => {
    const calls = serve([
      card('3', { uid: '04A2B91E', blocked: true }),
      card('2', { uid: '04A2B91C' }),
      card('1', { uid: '04A2B91D', blocked: true, linkedTo: { name: 'Gijs Guest' } }),
    ])
    const { user } = renderApp(<CardsTab slug="night-owls" />)

    // Hidden at first; a blocked card someone still has stays in view.
    expect(await screen.findByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.queryByText('3')).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Show blocked cards nobody has' }))
    const rows = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(within(rows[rows.length - 1]).getByText('3')).toBeInTheDocument()

    await user.click(within(rows[rows.length - 1]).getByRole('button', { name: 'Actions for card 3' }))
    await user.click(within(rows[rows.length - 1]).getByRole('button', { name: 'Reuse as a new card' }))
    await vi.waitFor(() => expect(calls).toEqual(['blocked id-3 {"blocked":false}']))
  })

  it('only offers to delete a card that was never written, and asks first', async () => {
    const calls = serve([card('2'), card('1', { uid: '04A2B91D' })])
    const { user } = renderApp(<CardsTab slug="night-owls" />)

    const unwritten = (await screen.findByText('2')).closest('li')!
    await user.click(within(unwritten).getByRole('button', { name: 'Actions for card 2' }))
    expect(within(unwritten).queryByRole('button', { name: 'Block' })).not.toBeInTheDocument()
    await user.click(within(unwritten).getByRole('button', { name: 'Delete' }))
    await user.click(
      within(screen.getByRole('alertdialog', { name: 'Delete card 2?' })).getByRole('button', {
        name: 'Delete',
      }),
    )

    await vi.waitFor(() => expect(calls).toEqual(['delete id-2']))
    const written = screen.getByText('1').closest('li')!
    await user.click(within(written).getByRole('button', { name: 'Actions for card 1' }))
    expect(within(written).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('explains that writing cards needs Chrome on Android', async () => {
    serve([])
    renderApp(<CardsTab slug="night-owls" />)

    expect(await screen.findByText(/Writing cards needs Chrome on an Android phone/)).toBeInTheDocument()
  })
})
