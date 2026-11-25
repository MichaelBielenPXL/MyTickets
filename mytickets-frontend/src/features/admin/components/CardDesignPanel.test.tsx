import { screen, within } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { CardDesignPanel } from './CardDesignPanel'

const side = {
  background: 'brand',
  colour: null,
  imageKey: null,
  imageUrl: null,
  showLogo: true,
  tagline: '',
}

function serve() {
  const saved: unknown[] = []
  server.use(
    http.get(apiUrl('/orgs/night-owls/admin/organisation'), () =>
      HttpResponse.json({
        slug: 'night-owls',
        name: 'Night Owls',
        description: '',
        logoKey: null,
        logoUrl: null,
        brandColor: '#14365d',
      }),
    ),
    http.get(apiUrl('/orgs/night-owls/admin/cards/design'), () =>
      HttpResponse.json({ front: side, back: side }),
    ),
    http.put(apiUrl('/orgs/night-owls/admin/cards/design'), async ({ request }) => {
      saved.push(await request.json())
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return saved
}

describe('CardDesignPanel', () => {
  it('shows the front, and the back with the QR code, the name and the number', async () => {
    serve()
    const { user } = renderApp(<CardDesignPanel slug="night-owls" />)

    const front = within(await screen.findByRole('figure', { name: 'Card preview' }))
    expect(front.getByText('Night Owls')).toBeInTheDocument()
    expect(front.queryByTitle('QR code of the card')).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Back' }))
    const back = within(screen.getByRole('figure', { name: 'Card preview' }))
    expect(back.getByTitle('QR code of the card')).toBeInTheDocument()
    expect(back.getByText('1')).toBeInTheDocument()
  })

  it('saves each side on its own', async () => {
    const saved = serve()
    const { user } = renderApp(<CardDesignPanel slug="night-owls" />)

    await user.click(await screen.findByRole('radio', { name: 'Another colour' }))
    await user.clear(screen.getByLabelText('Colour code'))
    await user.type(screen.getByLabelText('Colour code'), '#0b3d2e')
    await user.type(screen.getByLabelText(/^Line on the card \(optional\)/), 'Lidkaart 2026–2027')
    expect(
      within(screen.getByRole('figure', { name: 'Card preview' })).getByText('Lidkaart 2026–2027'),
    ).toBeInTheDocument()
    // The back keeps its own design.
    await user.click(screen.getByRole('radio', { name: 'Back' }))
    expect(screen.getByRole('radio', { name: 'Brand colour' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Save card design' }))

    const plain = { background: 'brand', colour: null, imageKey: null, showLogo: true, tagline: '' }
    await vi.waitFor(() =>
      expect(saved).toEqual([
        {
          front: {
            background: 'colour',
            colour: '#0b3d2e',
            imageKey: null,
            showLogo: true,
            tagline: 'Lidkaart 2026–2027',
          },
          back: plain,
        },
      ]),
    )
  })
})
