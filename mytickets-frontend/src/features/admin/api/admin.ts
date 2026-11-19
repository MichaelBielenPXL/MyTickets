import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { meQueryKey } from '@/features/auth'
import { eventKeys } from '@/features/events'
import { type FieldMode, type ProfileFieldName, organisationKeys } from '@/features/organisations'
import { staffKeys } from '@/features/staff'
import { api } from '@/lib/api-client'

import type {
  AdminCard,
  AdminEvent,
  AdminTier,
  CardWriting,
  Category,
  EventInput,
  JoinRequest,
  Member,
  OrganisationSettings,
  OrganisationSettingsInput,
  PayoutSetup,
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
  payouts: (slug: string) => ['admin', slug, 'payouts'] as const,
  requests: (slug: string) => ['admin', slug, 'requests'] as const,
  memberFields: (slug: string) => ['admin', slug, 'member-fields'] as const,
  summary: (slug: string) => ['admin', slug, 'summary'] as const,
  tiers: (slug: string) => ['admin', slug, 'tiers'] as const,
  members: (slug: string) => ['admin', slug, 'members'] as const,
  events: (slug: string) => ['admin', slug, 'events'] as const,
  products: (slug: string) => ['admin', slug, 'products'] as const,
  categories: (slug: string) => ['admin', slug, 'categories'] as const,
  topUpDeals: (slug: string) => ['admin', slug, 'topup-deals'] as const,
  cards: (slug: string) => ['admin', slug, 'cards'] as const,
  cardWriting: (slug: string) => ['admin', slug, 'card-writing'] as const,
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

/** Where the organisation stands with Stripe. Asked afresh each time, so it is right after coming back from Stripe. */
export function usePayoutSetup(slug: string) {
  return useQuery({
    queryKey: adminKeys.payouts(slug),
    queryFn: () => api.get<PayoutSetup>(`${base(slug)}/payouts`),
    staleTime: 0,
  })
}

/** A one-time link to Stripe's sign-up pages, or to the organisation's own Stripe dashboard. */
export function useStripeLink(slug: string) {
  return useMutation({
    mutationFn: (to: 'onboarding' | 'dashboard') => api.post<{ url: string }>(`${base(slug)}/payouts/${to}`),
  })
}

/** Requests for memberships that need approval: waiting for a decision, or approved but not yet paid. */
export function useJoinRequests(slug: string) {
  return useQuery({
    queryKey: adminKeys.requests(slug),
    queryFn: () => api.get<JoinRequest[]>(`${base(slug)}/requests`),
  })
}

export function useDecideRequest(slug: string) {
  return useAdminMutation(slug, ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) =>
    api.post(`${base(slug)}/requests/${id}/${decision}`),
  )
}

/** Which details members are asked for, besides their name. */
export function useMemberFields(slug: string) {
  return useQuery({
    queryKey: adminKeys.memberFields(slug),
    queryFn: () => api.get<Record<ProfileFieldName, FieldMode>>(`${base(slug)}/member-fields`),
  })
}

export function useSaveMemberFields(slug: string) {
  return useAdminMutation(slug, (fields: Record<ProfileFieldName, FieldMode>) =>
    api.put(`${base(slug)}/member-fields`, fields),
  )
}

export function useDeleteProduct(slug: string) {
  return useAdminMutation(slug, (id: string) => api.delete(`${base(slug)}/products/${id}`))
}

/**
 * Saves a new order for a list (bar items or memberships). The list moves at once; if the server
 * refuses, it is loaded again as it was.
 */
function useReorder<T extends { id: string }>(slug: string, key: readonly unknown[], url: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => api.put(url, { ids }),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: key })
      queryClient.setQueryData<T[]>(key, (list) =>
        list
          ? ids.map((id) => list.find((item) => item.id === id)).filter((item) => item !== undefined)
          : list,
      )
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.all(slug) }),
        queryClient.invalidateQueries({ queryKey: organisationKeys.detail(slug) }),
        queryClient.invalidateQueries({ queryKey: staffKeys.context(slug) }),
      ]),
  })
}

export function useReorderProducts(slug: string) {
  return useReorder<Product>(slug, adminKeys.products(slug), `${base(slug)}/products/order`)
}

export function useReorderTiers(slug: string) {
  return useReorder<AdminTier>(slug, adminKeys.tiers(slug), `${base(slug)}/tiers/order`)
}

export function useCategories(slug: string) {
  return useQuery({
    queryKey: adminKeys.categories(slug),
    queryFn: () => api.get<Category[]>(`${base(slug)}/categories`),
  })
}

/** Creates when `id` is missing, otherwise renames. */
export function useSaveCategory(slug: string) {
  return useAdminMutation(slug, ({ id, name }: { id?: string; name: string }) =>
    id ? api.put(`${base(slug)}/categories/${id}`, { name }) : api.post(`${base(slug)}/categories`, { name }),
  )
}

export function useDeleteCategory(slug: string) {
  return useAdminMutation(slug, (id: string) => api.delete(`${base(slug)}/categories/${id}`))
}

export function useReorderCategories(slug: string) {
  return useReorder<Category>(slug, adminKeys.categories(slug), `${base(slug)}/categories/order`)
}

export type TopUpDealInput = { priceCents: number; tokensCents: number }

/** The organisation's own top-ups, in the order members see them. */
export function useTopUpDeals(slug: string) {
  return useQuery({
    queryKey: adminKeys.topUpDeals(slug),
    queryFn: () => api.get<(TopUpDealInput & { id: string })[]>(`${base(slug)}/topup-deals`),
  })
}

/** Saves the whole list at once; an empty list goes back to one token per euro. */
export function useSaveTopUpDeals(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (deals: TopUpDealInput[]) =>
      api.put<(TopUpDealInput & { id: string })[]>(`${base(slug)}/topup-deals`, deals),
    onSuccess: (saved) => queryClient.setQueryData(adminKeys.topUpDeals(slug), saved),
  })
}

export function useAdminCards(slug: string) {
  return useQuery({
    queryKey: adminKeys.cards(slug),
    queryFn: () => api.get<AdminCard[]>(`${base(slug)}/cards`),
  })
}

export function useCardWriting(slug: string) {
  return useQuery({
    queryKey: adminKeys.cardWriting(slug),
    queryFn: () => api.get<CardWriting>(`${base(slug)}/cards/writing`),
  })
}

/** Every change to cards reloads the list. */
function useCardsMutation<TInput, TResult>(slug: string, mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.cards(slug) }),
  })
}

export function useCreateCards(slug: string) {
  return useCardsMutation(slug, (count: number) => api.post<AdminCard[]>(`${base(slug)}/cards`, { count }))
}

/** A new card for a blank chip, made just before it is written. */
export function useCreateBlankCard(slug: string) {
  return useCardsMutation(slug, () => api.post<AdminCard>(`${base(slug)}/cards/blank`, {}))
}

/** Tells the server which chip a card was written to. Safe to send again for the same chip. */
export function useReportCardWritten(slug: string) {
  return useCardsMutation(slug, ({ id, uid }: { id: string; uid: string }) =>
    api.post<AdminCard>(`${base(slug)}/cards/${id}/written`, { uid, locked: true }),
  )
}

export function useSetCardBlocked(slug: string) {
  return useCardsMutation(slug, ({ id, blocked }: { id: string; blocked: boolean }) =>
    api.put<void>(`${base(slug)}/cards/${id}/blocked`, { blocked }),
  )
}

export function useUnlinkCard(slug: string) {
  return useCardsMutation(slug, (id: string) => api.delete<void>(`${base(slug)}/cards/${id}/link`))
}

export function useDeleteCard(slug: string) {
  return useCardsMutation(slug, (id: string) => api.delete<void>(`${base(slug)}/cards/${id}`))
}

/** Lets a member link one more card within the year, for a lost one. */
export function useAllowExtraCard(slug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, allowed }: { memberId: string; allowed: boolean }) =>
      api.put<void>(`${base(slug)}/members/${memberId}/extra-card`, { allowed }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.members(slug) }),
  })
}
