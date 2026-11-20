// @vitest-environment node
import middleware, { apiOrigin } from './middleware.ts'

describe('the /api forwarding on Vercel', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('picks the API that belongs to the Vercel environment', () => {
    vi.stubEnv('API_ORIGIN', '')
    vi.stubEnv('VERCEL_ENV', 'production')
    expect(apiOrigin()).toBe('https://myticketsapi.michaelbielen.be')
    vi.stubEnv('VERCEL_ENV', 'preview')
    expect(apiOrigin()).toBe('https://devticketsapi.michaelbielen.be')
  })

  it('lets API_ORIGIN point anywhere, without a trailing slash', () => {
    vi.stubEnv('API_ORIGIN', 'https://api.mytickets.be/')
    expect(apiOrigin()).toBe('https://api.mytickets.be')
  })

  it('forwards the request path and query to that API', () => {
    vi.stubEnv('API_ORIGIN', '')
    vi.stubEnv('VERCEL_ENV', 'preview')

    const response = middleware(new Request('https://mytickets.vercel.app/api/orgs/night-owls/wallet?x=1'))

    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'https://devticketsapi.michaelbielen.be/api/orgs/night-owls/wallet?x=1',
    )
  })
})
