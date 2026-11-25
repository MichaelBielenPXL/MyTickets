import { screen } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { LinkCardDialog } from './LinkCardDialog'

const code = 'ABCDEFGHJK'

function serve(state: object) {
  const linked: string[] = []
  server.use(
    http.get(apiUrl(`/orgs/night-owls/cards/${code}`), () => HttpResponse.json(state)),
    http.post(apiUrl(`/orgs/night-owls/cards/${code}/link`), () => {
      linked.push(code)
      return HttpResponse.json({ number: '42' })
    }),
    http.get(apiUrl('/orgs/night-owls/me/cards'), () => HttpResponse.json([])),
  )
  return linked
}

describe('LinkCardDialog', () => {
  it('links the card to the wallet when asked', async () => {
    const linked = serve({ number: '42', state: 'free', member: true })
    const done = vi.fn()
    const { user } = renderApp(<LinkCardDialog slug="night-owls" code={code} onDone={done} />)

    const dialog = await screen.findByRole('alertdialog', { name: 'Link card 42 to your wallet?' })
    expect(dialog).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Link card' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Card 42 is linked to your wallet.')
    expect(linked).toEqual([code])
  })

  it('can be put off', async () => {
    const linked = serve({ number: '42', state: 'free', member: true })
    const done = vi.fn()
    const { user } = renderApp(<LinkCardDialog slug="night-owls" code={code} onDone={done} />)

    await user.click(await screen.findByRole('button', { name: 'Not now' }))

    expect(done).toHaveBeenCalled()
    expect(linked).toEqual([])
  })

  it('sends someone without a membership to join first', async () => {
    serve({ number: '42', state: 'free', member: false })
    const { user } = renderApp(<LinkCardDialog slug="night-owls" code={code} onDone={() => {}} />)

    await user.click(await screen.findByRole('button', { name: 'Become a member' }))

    expect(await screen.findByText('Now at /night-owls/join')).toBeInTheDocument()
  })
})
