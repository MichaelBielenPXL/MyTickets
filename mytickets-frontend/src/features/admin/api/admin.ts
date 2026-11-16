import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { meQueryKey } from '@/features/auth'
import { eventKeys } from '@/features/events'
import { organisationKeys } from '@/features/organisations'
import { staffKeys } from '@/features/staff'
import { api } from '@/lib/api-client'

import type {
  AdminEvent,
  AdminTier,
  EventInput,
  Member,
  OrganisationSettings,
  OrganisationSettingsInput,
  Product,
  ProductInput,
  StoredImage,
  Summary,
  TicketTypeInput,
  TierInput,
} from '../types'

export const adminKeys = {
  all: (slug: string) => ['admin', slug] as const,
  settings: (slug: string) => ['admin', slug, 'settings'] as const,
  summary: (slug: string) => ['admin', slug, 'summary'] as const,
  tiers: (slug: string) => ['admin', slug, 'tiers'] as const,
  members: (slug: string) => ['admin', slug, 'members'] as const,
  events: (slug: string) => ['admin', slug, 'events'] as const,
  products: (slug: string) => ['admin', slug, 'products'] as const,
}

const base = (slug: string) => `/orgs/${slug}/admin`

export function useOrganisationSettings(slug: string) {
  return useQuery({
    queryKey: adminKeys.settings(slug),
    queryFn: () => api.get<OrganisationSettings>(`${base(slug)}/organisation`),
  })
}

export function useSummary(slug: string) {
  return useQuery({
    queryKey: adminKeys.summary(slug),
    queryFn: () => api.get<Summary>(`${base(slug)}/summary`),
  })
}

export function useAdminTiers(slug: string) {
  return useQuery({
    queryKey: adminKeys.tiers(slug),
    queryFn: () => api.get<AdminTier[]>(`${base(slug)}/tiers`),
  })
}

export function useMembers(slug: string) {
  return useQuery({
    queryKey: adminKeys.members(slug),
    queryFn: () => api.get<Member[]>(`${base(slug)}/members`),
  })
}

export function useAdminEvents(slug: string) {
  return useQuery({
    queryKey: adminKeys.events(slug),
    queryFn: () => api.get<AdminEvent[]>(`${base(slug)}/events`),
  })
}

export function useProducts(slug: string) {
  return useQuery({
    queryKey: adminKeys.products(slug),
    queryFn: () => api.get<Product[]>(`${base(slug)}/products`),
  })
}

/**
 * A change an admin makes. Afterwards every admin list is reloaded, along with what members
 * and staff see of this organisation, because most changes show up in several places.
 */
function useAdminMutation<TInput>(slug: string, mutationFn: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.all(slug) }),
        queryClient.invalidateQueries({ queryKey: organisationKeys.detail(slug) }),
        queryClient.invalidateQueries({ queryKey: staffKeys.context(slug) }),
        queryClient.invalidateQueries({ queryKey: eventKeys.forOrganisation(slug) }),
      ]),
  })
}

/** Creates when `id` is missing, otherwise updates. */
export function useSaveTier(slug: string) {
  return useAdminMutation(slug, ({ id, tier }: { id?: string; tier: TierInput }) =>
    id ? api.put(`${base(slug)}/tiers/${id}`, tier) : api.post(`${base(slug)}/tiers`, tier),
  )
}

export function useSaveEvent(slug: string) {
  return useAdminMutation(slug, ({ id, event }: { id?: string; event: EventInput }) =>
    id ? api.put(`${base(slug)}/events/${id}`, event) : api.post(`${base(slug)}/events`, event),
  )
}

export function useSaveTicketType(slug: string, eventId: string) {
  return useAdminMutation(slug, ({ id, ticketType }: { id?: string; ticketType: TicketTypeInput }) =>
    id
      ? api.put(`${base(slug)}/ticket-types/${id}`, ticketType)
      : api.post(`${base(slug)}/events/${eventId}/ticket-types`, ticketType),
  )
}

export function useUpdateMember(slug: string) {
  return useAdminMutation(slug, (member: Pick<Member, 'id' | 'role' | 'tierId' | 'expiresAt'>) =>
    api.put(`${base(slug)}/members/${member.id}`, member),
  )
}

export function useSaveProduct(slug: string) {
  return useAdminMutation(slug, ({ id, product }: { id?: string; product: ProductInput }) =>
    id ? api.put(`${base(slug)}/products/${id}`, product) : api.post(`${base(slug)}/products`, product),
  )
}

/**
 * Changes the organisation's name, description or logo. The page address follows the name, so a
 * rename answers with the new address (`slug`) and the caller moves there.
 */
export function useUpdateOrganisation(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (settings: OrganisationSettingsInput) =>
      api.put<{ slug: string }>(`${base(slug)}/organisation`, settings),
    onSuccess: async (saved) => {
      // The header reads the name and address from "who am I", so wait for that one.
      await queryClient.invalidateQueries({ queryKey: meQueryKey })
      // After a rename everything on screen still asks for the old address, which no longer exists:
      // mark it out of date without asking again, and let the new address load fresh.
      await queryClient.invalidateQueries({ refetchType: saved.slug === slug ? 'active' : 'none' })
    },
  })
}

/** Stores a picture and answers with its key. Nothing shows it until that key is saved on something. */
export function useUploadImage(slug: string) {
  return useMutation({
    mutationFn: (file: File) => api.upload<StoredImage>(`${base(slug)}/images`, file),
  })
}
