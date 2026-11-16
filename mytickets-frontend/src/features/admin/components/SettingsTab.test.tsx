import { screen } from '@testing-library/react'

import { HttpResponse, apiUrl, http, jsonError } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { SettingsTab } from './SettingsTab'

const logoKey = 'orgs/aaaa/bbbb.png'

/** A pretend server that remembers what was saved, like the real one. */
function serveSettings() {
  const state = {
    settings: {
      slug: 'night-owls',
      name: 'Night Owls',
      description: '',
      logoKey: null as string | null,
      logoUrl: null as string | null,
    },
    saved: [] as unknown[],
    /** The content type of each upload request. */
    uploads: [] as string[],
  }
  server.use(
    http.get(apiUrl('/orgs/night-owls/admin/organisation'), () => HttpResponse.json(state.settings)),
    http.put(apiUrl('/orgs/night-owls/admin/organisation'), async ({ request }) => {
      const body = (await request.json()) as { name: string; description: string; logoKey: string | null }
      state.saved.push(body)
      state.settings = { ...state.settings, ...body, logoUrl: body.logoKey && `/api/images/${body.logoKey}` }
      // The address follows the name, like on the real server.
      state.settings.slug = body.name.toLowerCase().replaceAll(' ', '-')
      return HttpResponse.json({ slug: state.settings.slug })
    }),
    http.post(apiUrl('/orgs/night-owls/admin/images'), async ({ request }) => {
      state.uploads.push(request.headers.get('content-type') ?? '')
      return HttpResponse.json({ key: logoKey, url: `/api/images/${logoKey}` })
    }),
  )
  return state
}

const png = (name = 'logo.png', bytes = 10) => new File([new Uint8Array(bytes)], name, { type: 'image/png' })

describe('SettingsTab', () => {
  it('has nothing to save until something is changed', async () => {
    serveSettings()
    renderApp(<SettingsTab slug="night-owls" />)

    expect(await screen.findByLabelText('Name')).toHaveValue('Night Owls')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  it('uploads a logo, then saves it together with the new name', async () => {
    const state = serveSettings()
    const { user } = renderApp(<SettingsTab slug="night-owls" />)

    await user.upload(await screen.findByLabelText('Logo'), png())
    expect(await screen.findByRole('img', { name: 'Current logo' })).toHaveAttribute(
      'src',
      `/api/images/${logoKey}`,
    )
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Night Owls Hasselt')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    // The page now lives at the new name, so the admin is taken there.
    expect(await screen.findByText('Now at /night-owls-hasselt/admin')).toBeInTheDocument()
    // Sent as a form with a file in it, which is what the server reads.
    expect(state.uploads[0]).toMatch(/^multipart\/form-data/)
    expect(state.saved).toEqual([{ name: 'Night Owls Hasselt', description: '', logoKey }])
  })

  it('stays put when only the description changes', async () => {
    const state = serveSettings()
    const { user } = renderApp(<SettingsTab slug="night-owls" />)

    await user.type(await screen.findByLabelText(/Description/), 'Student parties')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Saved.')
    expect(state.saved).toEqual([{ name: 'Night Owls', description: 'Student parties', logoKey: null }])
    expect(screen.queryByLabelText(/Page address/)).not.toBeInTheDocument()
  })

  it('says so when another organisation already has the name', async () => {
    serveSettings()
    server.use(
      http.put(apiUrl('/orgs/night-owls/admin/organisation'), () =>
        jsonError(409, 'Another organisation already uses this name.'),
      ),
    )
    const { user } = renderApp(<SettingsTab slug="night-owls" />)

    await user.type(await screen.findByLabelText('Name'), ' Two')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Another organisation already uses this name.')
    expect(screen.getByLabelText('Name')).toHaveValue('Night Owls Two')
  })

  it('refuses a picture that is too large without sending it', async () => {
    const state = serveSettings()
    const { user } = renderApp(<SettingsTab slug="night-owls" />)

    await user.upload(await screen.findByLabelText('Logo'), png('huge.png', 4 * 1024 * 1024 + 1))

    expect(screen.getByRole('alert')).toHaveTextContent('larger than 4 MB')
    expect(state.uploads).toHaveLength(0)
  })

  it('shows why the server refused a picture', async () => {
    serveSettings()
    server.use(
      http.post(apiUrl('/orgs/night-owls/admin/images'), () =>
        jsonError(400, 'Upload a PNG, JPEG or WebP picture.'),
      ),
    )
    const { user } = renderApp(<SettingsTab slug="night-owls" />)

    await user.upload(await screen.findByLabelText('Logo'), png())

    expect(await screen.findByRole('alert')).toHaveTextContent('Upload a PNG, JPEG or WebP picture.')
    expect(screen.queryByRole('img', { name: 'Current logo' })).not.toBeInTheDocument()
  })

  it('removes the logo when asked', async () => {
    const state = serveSettings()
    state.settings = { ...state.settings, logoKey, logoUrl: `/api/images/${logoKey}` }
    const { user } = renderApp(<SettingsTab slug="night-owls" />)

    await user.click(await screen.findByRole('button', { name: 'Remove' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Saved.')
    expect(state.saved).toEqual([{ name: 'Night Owls', description: '', logoKey: null }])
  })
})
