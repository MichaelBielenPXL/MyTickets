/**
 * Vercel routing middleware: the site keeps calling /api on its own address, and this forwards those requests to
 * the API of the same environment. For the browser everything stays on one site, so the sign-in cookie is a
 * first-party cookie (Safari and iPhones block cookies of other sites) and no CORS is needed.
 *
 * Which API: API_ORIGIN when it is set in the Vercel project; otherwise the live API for Production deployments
 * and the dev API for Preview deployments.
 */
export const config = { matcher: '/api/:path*' }

const LIVE_API = 'https://myticketsapi.michaelbielen.be'
const DEV_API = 'https://devticketsapi.michaelbielen.be'

export function apiOrigin(): string {
  const configured = process.env.API_ORIGIN?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  return process.env.VERCEL_ENV === 'production' ? LIVE_API : DEV_API
}

export default function middleware(request: Request): Response {
  const { pathname, search } = new URL(request.url)
  // The same as `rewrite()` from @vercel/functions: Vercel fetches this address and returns its answer as-is,
  // Set-Cookie included.
  return new Response(null, {
    headers: { 'x-middleware-rewrite': new URL(pathname + search, apiOrigin()).toString() },
  })
}
