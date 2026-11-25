import { screen } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { TillPage } from './TillPage'

const page = { at: '/night-owls/staff/till', path: '/:slug/staff/till' }

function serveContext(tasks: string[]) {
  server.use(
    http.get(apiUrl('/orgs/night-owls/staff/context'), () =>
      HttpResponse.json({ name: 'Night Owls', tasks, events: [], products: [], categories: [] }),
    ),
  )
}

describe('TillPage', () => {
  it('shows the till with a way back to the bar', async () => {
    serveContext(['Bar', 'CheckCard'])
    renderApp(<TillPage />, page)

    const back = await screen.findByRole('link', { name: /Bar/ })
    expect(back).toHaveAttribute('href', '/night-owls/staff?mode=bar')
  })

  it('sends someone without the bar back to their staff screens', async () => {
    serveContext(['Door', 'CheckCard'])
    renderApp(<TillPage />, page)

    expect(await screen.findByText('Now at /night-owls/staff')).toBeInTheDocument()
  })
})
