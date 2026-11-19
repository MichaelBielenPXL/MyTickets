import { screen } from '@testing-library/react'

import { HttpResponse, apiUrl, http, jsonError } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { PENDING_CARD_KEY } from '../utils/pending-card'
import { CardLinkPage } from './CardLinkPage'

const code = 'ABCDEFGHJK'

function cardAnswers(state: (() => Response) | object) {
  server.use(
    http.get(apiUrl(`/c/${code}`), () => HttpResponse.json({ slug: 'night-owls' })),
    http.get(apiUrl(`/orgs/night-owls/cards/${code}`), () =>
      typeof state === 'function' ? state() : HttpResponse.json(state),
    ),
  )
}

const open = () => renderApp(<CardLinkPage />, { at: `/c/${code}`, path: '/c/:code' })

afterEach(() => sessionStorage.clear())

describe('CardLinkPage (a card held to the phone)', () => {
  it('asks a visitor who is not signed in there to sign in, and remembers the card', async () => {
    cardAnswers(() => jsonError(401, 'Sign in first.'))
    open()

    expect(await screen.findByText(`Now at /night-owls/login?next=%2Fc%2F${code}`)).toBeInTheDocument()
    expect(sessionStorage.getItem(PENDING_CARD_KEY)).toBe(code)
  })

  it('forgets the remembered card once the card is reached', async () => {
    sessionStorage.setItem(PENDING_CARD_KEY, code)
    cardAnswers({ number: '0042', state: 'free', member: true })
    open()

    await screen.findByText(`Now at /night-owls/wallet?link=${code}`)
    expect(sessionStorage.getItem(PENDING_CARD_KEY)).toBeNull()
  })

  it('opens the wallet for the card owner', async () => {
    cardAnswers({ number: '0042', state: 'mine', member: true })
    open()

    expect(await screen.findByText('Now at /night-owls/wallet')).toBeInTheDocument()
  })

  it('offers to link a free card on the wallet', async () => {
    cardAnswers({ number: '0042', state: 'free', member: true })
    open()

    expect(await screen.findByText(`Now at /night-owls/wallet?link=${code}`)).toBeInTheDocument()
  })

  it("says so when the card is someone else's", async () => {
    cardAnswers({ number: '0042', state: 'taken', member: true })
    open()

    expect(await screen.findByText('This card is linked to another account.')).toBeInTheDocument()
  })

  it('says so when the card is unknown', async () => {
    server.use(http.get(apiUrl(`/c/${code}`), () => jsonError(404, 'This card is not known.')))
    open()

    expect(await screen.findByText('This card is not known.')).toBeInTheDocument()
  })
})
