import { screen } from '@testing-library/react'

import { HttpResponse, apiUrl, http, jsonError } from '@/test/data'
import { renderApp } from '@/test/render'
import { server } from '@/test/server'

import { ForgotPasswordPage } from './ForgotPasswordPage'
import { ResetPasswordPage } from './ResetPasswordPage'

describe('ForgotPasswordPage', () => {
  it('asks for a link for the account at this organisation, and never says whether there is one', async () => {
    let sent: unknown
    server.use(
      http.post(apiUrl('/auth/forgot-password'), async ({ request }) => {
        sent = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { user } = renderApp(<ForgotPasswordPage />, {
      at: '/night-owls/forgot-password',
      path: '/:slug/forgot-password',
      state: { email: 'gijs@example.com' },
    })

    expect(screen.getByLabelText('Email')).toHaveValue('gijs@example.com')
    await user.click(screen.getByRole('button', { name: 'Send link' }))

    expect(await screen.findByText(/If there is an account with gijs@example.com/)).toBeInTheDocument()
    expect(sent).toEqual({ email: 'gijs@example.com', organisationSlug: 'night-owls', language: 'en' })
  })
})

describe('ResetPasswordPage', () => {
  it('sets the new password with the token from the link', async () => {
    let sent: unknown
    server.use(
      http.post(apiUrl('/auth/reset-password'), async ({ request }) => {
        sent = await request.json()
        return HttpResponse.json({ organisationSlug: 'night-owls' })
      }),
    )
    const { user } = renderApp(<ResetPasswordPage />, {
      at: '/night-owls/reset-password?token=abc123',
      path: '/:slug/reset-password',
    })

    await user.type(screen.getByLabelText(/New password/), 'brand new password')
    await user.click(screen.getByRole('button', { name: 'Set new password' }))

    expect(await screen.findByRole('heading', { name: 'Your new password is set' })).toBeInTheDocument()
    expect(sent).toEqual({ token: 'abc123', password: 'brand new password' })
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/night-owls/login')
  })

  it('says so when the link has run out', async () => {
    server.use(
      http.post(apiUrl('/auth/reset-password'), () =>
        jsonError(400, 'This link has run out or was already used. Ask for a new one.'),
      ),
    )
    const { user } = renderApp(<ResetPasswordPage />, {
      at: '/reset-password?token=old',
      path: '/reset-password',
    })

    await user.type(screen.getByLabelText(/New password/), 'brand new password')
    await user.click(screen.getByRole('button', { name: 'Set new password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('This link has run out')
    expect(screen.getByRole('link', { name: 'Ask for a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })
})
