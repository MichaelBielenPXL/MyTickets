import { screen } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { CardList } from './CardList'

const card = { id: 'c1', number: '42', label: '', blocked: false, linkedAt: '2026-11-01T20:00:00Z' }

describe('CardList', () => {
  it('shows each card by its printed number, with no way to remove it', () => {
    renderApp(<CardList slug="night-owls" cards={[card]} />)

    expect(screen.getByText('Card 42')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('blocks a lost card', async () => {
    const blocked: unknown[] = []
    server.use(
      http.put(apiUrl('/orgs/night-owls/me/cards/c1/blocked'), async ({ request }) => {
        blocked.push(await request.json())
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderApp(<CardList slug="night-owls" cards={[card]} />)

    await user.click(screen.getByRole('button', { name: 'Block' }))

    await vi.waitFor(() => expect(blocked).toEqual([{ blocked: true }]))
  })
})
