import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import { LanguageProvider } from '@/lib/i18n'

type RenderOptions = {
  /** The address the visitor is on, e.g. "/night-owls/events/e1". */
  at?: string
  /** The route pattern of the page under test, e.g. "/:slug/events/:eventId". */
  path?: string
  /** What the previous page handed over out of sight, e.g. the email address from the email step. */
  state?: unknown
}

/**
 * Renders a page the way the app does: with the server-data cache, a router and the language around it.
 * Any other address shows "Now at <address>", so tests can check where the visitor was sent.
 */
export function renderApp(ui: ReactElement, { at = '/', path = '/', state }: RenderOptions = {}) {
  // No retries and no caching between tests: a failing request should fail the test straight away.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })

  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ ...parseAddress(at), state }]}>
        <LanguageProvider>
          <Routes>
            <Route path={path} element={ui} />
            <Route path="*" element={<CurrentAddress />} />
          </Routes>
        </LanguageProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { user: userEvent.setup(), ...view }
}

/** "/login?next=x" -> its path and query, the form the router wants when state comes along. */
function parseAddress(address: string) {
  const [pathname, search = ''] = address.split('?')
  return { pathname, search: search && `?${search}` }
}

function CurrentAddress() {
  const location = useLocation()
  return (
    <p>
      Now at {location.pathname}
      {location.search}
    </p>
  )
}
