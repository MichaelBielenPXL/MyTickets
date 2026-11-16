import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ApiError, api } from '@/lib/api-client'

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
 * The account this browser has at one organisation: null when it has none (also when it is signed in
 * somewhere else), undefined while that is still being found out.
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

/** Signs out of one organisation when given its address, otherwise out of everything. */
export function useSignOut() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (organisationSlug?: string) => api.post('/auth/logout', { organisationSlug }),
    onSuccess: async (_, organisationSlug) => {
      // Nothing the previous person loaded may be shown to the next one on this device.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== meQueryKey[0] })
      if (organisationSlug) await queryClient.invalidateQueries({ queryKey: meQueryKey })
      else queryClient.setQueryData(meQueryKey, null)
    },
  })
}
