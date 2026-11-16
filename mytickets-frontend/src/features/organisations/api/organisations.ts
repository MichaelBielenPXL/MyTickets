import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { meQueryKey } from '@/features/auth'
import { api } from '@/lib/api-client'

import type { JoinResult, Organisation, OrganisationSummary } from '../types'

export const organisationKeys = {
  list: ['organisations'] as const,
  detail: (slug: string) => ['organisation', slug] as const,
  publicDetail: (slug: string) => ['public-organisation', slug] as const,
}

export function useOrganisations() {
  return useQuery({
    queryKey: organisationKeys.list,
    queryFn: () => api.get<OrganisationSummary[]>('/orgs'),
  })
}

/** One organisation with the signed-in person's membership, credit and upcoming events. */
export function useOrganisation(slug: string, enabled = true) {
  return useQuery({
    queryKey: organisationKeys.detail(slug),
    queryFn: () => api.get<Organisation>(`/orgs/${slug}`),
    enabled: enabled && slug.length > 0,
  })
}

export function usePublicOrganisation(slug: string, enabled = true) {
  return useQuery({
    queryKey: organisationKeys.publicDetail(slug),
    queryFn: () => api.get<Organisation>(`/public/orgs/${slug}`),
    enabled: enabled && slug.length > 0,
  })
}

export interface OrganisationSlugAvailability {
  available: boolean
  slug: string
  reason: string | null
}

export function useOrganisationSlugAvailability(name: string, enabled = true) {
  return useQuery({
    queryKey: ['organisation-slug-availability', name] as const,
    queryFn: () =>
      api.get<OrganisationSlugAvailability>(
        `/public/orgs/slug-availability?name=${encodeURIComponent(name)}`,
      ),
    enabled: enabled && name.trim().length >= 2,
    staleTime: 30_000,
  })
}

export function useCreateOrganisation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (organisation: { name: string; description: string }) =>
      api.post<{ slug: string }>('/orgs', organisation),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: organisationKeys.list }),
        queryClient.invalidateQueries({ queryKey: meQueryKey }),
      ]),
  })
}

type JoinRequest = { tierId: string } | { inviteCode: string }

const NO_TIER = '00000000-0000-0000-0000-000000000000'

/** Join, switch membership type or renew. Paid types answer with a checkout address instead of joining. */
export function useJoinOrganisation(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: JoinRequest) =>
      api.post<JoinResult>(`/orgs/${slug}/join`, { tierId: NO_TIER, ...request }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: organisationKeys.detail(slug) }),
        queryClient.invalidateQueries({ queryKey: organisationKeys.list }),
        queryClient.invalidateQueries({ queryKey: meQueryKey }),
      ]),
  })
}
