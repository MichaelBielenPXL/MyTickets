import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ApiError, api } from '@/lib/api-client'
import { getLanguage } from '@/lib/i18n'

import type { AuthResult, Credentials, Me } from '../types'

export const meQueryKey = ['me'] as const

/** Who is signed in. `null` means nobody; that is an answer, not an error. */
async function getMe(): Promise<Me | null> {
  try {
    return await api.get<Me>('/auth/me')
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export function useMe() {
  return useQuery({ queryKey: meQueryKey, queryFn: getMe, staleTime: 5 * 60_000 })
}

export function useSignIn(mode: 'login' | 'register') {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (credentials: Credentials) => api.post<AuthResult>(`/auth/${mode}`, credentials),
    // Waiting for "who am I" to reload keeps the button busy until the app has switched to signed in.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meQueryKey }),
  })
}

/**
 * The person's record at one organisation: null when they haven't joined it (or aren't signed in), undefined while
 * that is still being found out. Whether they are signed in at all is `useMe`.
 */
export function useAccount(slug: string) {
  const me = useMe()
  const account = me.data?.memberships.find((membership) => membership.slug === slug) ?? null
  return { data: me.isPending ? undefined : account, isPending: me.isPending }
}

/** Whether there is an account with this email address at the organisation. */
export function useCheckAccount(slug: string) {
  return useMutation({
    mutationFn: (email: string) =>
      api.post<{ exists: boolean }>(`/public/orgs/${slug}/account-check`, { email }),
  })
}

/** Signs out of MyTickets: one account, so everywhere at once. */
export function useSignOut() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/auth/logout', {}),
    onSuccess: () => {
      // Nothing the previous person loaded may be shown to the next one on this device.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== meQueryKey[0] })
      queryClient.setQueryData(meQueryKey, null)
    },
  })
}

/**
 * Asks for a link by email to choose a new MyTickets password. Asked at an organisation, the link brings them back
 * there to sign in. The answer is the same whether or not the address has an account.
 */
export function useForgotPassword(organisationSlug?: string) {
  return useMutation({
    mutationFn: (email: string) =>
      api.post('/auth/forgot-password', { email, organisationSlug, language: getLanguage() }),
  })
}

/** Sets a new password with the token from the emailed link. Answers with the organisation to sign in at, if any. */
export function useResetPassword() {
  return useMutation({
    mutationFn: (request: { token: string; password: string }) =>
      api.post<{ organisationSlug: string | null }>('/auth/reset-password', request),
  })
}
