import { screen } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { StaffPage } from './StaffPage'

const page = { at: '/night-owls/staff', path: '/:slug/staff' }

function serveContext(tasks: string[]) {
  server.use(
    http.get(apiUrl('/orgs/night-owls/staff/context'), () =>
      HttpResponse.json({ name: 'Night Owls', tasks, events: [], products: [], categories: [] }),
    ),
  )
}

const modeNames = () =>
  screen
    .getAllByRole('button')
    .filter((b) => b.closest('nav[aria-label="Staff mode"]'))
    .map((b) => b.textContent)

describe('StaffPage', () => {
  it('gives a barman the bar and card checks only, starting at the bar', async () => {
    serveContext(['Bar', 'CheckCard'])
    renderApp(<StaffPage />, page)

    expect(await screen.findByRole('navigation', { name: 'Staff mode' })).toBeInTheDocument()
    expect(modeNames()).toEqual(['Bar', 'Check card'])
    expect(screen.getByRole('button', { name: 'Bar' })).toHaveAttribute('aria-current', 'page')
  })

  it('gives a doorman the door and card checks only', async () => {
    serveContext(['Door', 'CheckCard'])
    renderApp(<StaffPage />, page)

    expect(await screen.findByRole('navigation', { name: 'Staff mode' })).toBeInTheDocument()
    expect(modeNames()).toEqual(['Door', 'Check card'])
    expect(screen.getByRole('button', { name: 'Door' })).toHaveAttribute('aria-current', 'page')
  })

  it('gives staff every screen', async () => {
    serveContext(['Bar', 'Door', 'CashTopUp', 'CheckCard'])
    renderApp(<StaffPage />, page)

    expect(await screen.findByRole('navigation', { name: 'Staff mode' })).toBeInTheDocument()
    expect(modeNames()).toEqual(['Door', 'Bar', 'Top up', 'Check card'])
  })
})
