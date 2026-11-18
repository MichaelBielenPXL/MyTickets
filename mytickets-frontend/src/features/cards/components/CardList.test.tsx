import { screen, within } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { CardList } from './CardList'

const card = {
  id: 'c1',
  uid: '04A1B2C3',
  label: 'Blue card',
  blocked: false,
  linkedAt: '2026-11-01T20:00:00Z',
}

function serveRemove() {
  const removed: string[] = []
  server.use(
    http.delete(apiUrl('/orgs/night-owls/me/cards/:id'), ({ params }) => {
      removed.push(String(params.id))
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return removed
}

describe('CardList', () => {
  it('asks in its own dialog before removing a card, with Cancel ready first', async () => {
    const removed = serveRemove()
    const { user } = renderApp(<CardList slug="night-owls" cards={[card]} />)

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Remove Blue card?' })
    expect(within(dialog).getByText(/Block it instead/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()

    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
    await vi.waitFor(() => expect(removed).toEqual(['c1']))
    await vi.waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('keeps the card when cancelled, by button or Escape', async () => {
    const removed = serveRemove()
    const { user } = renderApp(<CardList slug="night-owls" cards={[card]} />)

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(removed).toEqual([])
  })
})
