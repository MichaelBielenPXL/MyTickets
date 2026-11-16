import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'

import { server } from './server'

beforeAll(() => {
  // A request the test did not prepare an answer for is a mistake in the test.
  server.listen({ onUnhandledFrame: 'error' })

  // The app calls "/api/..." like a browser does; outside a browser that needs the site's address in front.
  const fetchWithOrigin = globalThis.fetch
  globalThis.fetch = (input, init) =>
    fetchWithOrigin(
      typeof input === 'string' && input.startsWith('/') ? location.origin + input : input,
      init,
    )
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
})

afterAll(() => server.close())
