import { screen } from '@testing-library/react'

import { HttpResponse, apiUrl, http } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { ProfilePage } from './ProfilePage'

const empty = {
  firstName: null,
  lastName: null,
  phone: null,
  street: null,
  postalCode: null,
  city: null,
  school: null,
  faculty: null,
  studyYear: null,
}

const form = {
  fields: { phone: 'Optional', address: 'Off', school: 'Optional', faculty: 'Off', studyYear: 'Off' },
  profile: empty,
  complete: false,
  email: 'gijs@example.com',
}

function serve(sources: object[]) {
  const sent: { saved: unknown[] } = { saved: [] }
  const details = { ...empty, firstName: 'Gijs', lastName: 'Janssens', school: 'KU Leuven' }
  server.use(
    http.get(apiUrl('/orgs/night-owls/me/profile'), () => HttpResponse.json(form)),
    http.get(apiUrl('/orgs/night-owls/me/memberships'), () => HttpResponse.json([])),
    http.get(apiUrl('/orgs/night-owls/me/profile/copy-sources'), () => HttpResponse.json(sources)),
    http.get(apiUrl('/orgs/night-owls/me/profile/copy-from/moonlight'), () => HttpResponse.json(details)),
    http.put(apiUrl('/orgs/night-owls/me/profile'), async ({ request }) => {
      sent.saved.push(await request.json())
      return HttpResponse.json({ profile: empty, complete: true })
    }),
  )
  return sent
}

const renderPage = () => renderApp(<ProfilePage />, { at: '/night-owls/profile', path: '/:slug/profile' })

describe('ProfilePage', () => {
  it('brings over details from the first organisation, saved only when the person saves', async () => {
    const sent = serve([
      { slug: 'moonlight', name: 'Moonlight Society' },
      { slug: 'lanterns', name: 'Lantern Club' },
    ])
    const { user } = renderPage()

    // The first organisation joined is chosen to start with.
    expect(await screen.findByLabelText('Transfer my details from')).toHaveValue('moonlight')
    await user.click(screen.getByRole('button', { name: 'Transfer' }))

    expect(
      await screen.findByText('Filled in from Moonlight Society. Check them, then save.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/First name/)).toHaveValue('Gijs')
    expect(sent.saved).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Save details' }))
    await vi.waitFor(() =>
      expect(sent.saved).toMatchObject([{ firstName: 'Gijs', lastName: 'Janssens', school: 'KU Leuven' }]),
    )
  })

  it('offers nothing when the email address has no account elsewhere', async () => {
    serve([])
    renderPage()

    expect(await screen.findByLabelText(/First name/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Transfer my details from')).not.toBeInTheDocument()
  })
})
