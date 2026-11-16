import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { organisationKeys } from '@/features/organisations'
import { ticketKeys } from '@/features/tickets'
import { walletKeys } from '@/features/wallet'
import { api } from '@/lib/api-client'

import type { EventDetail, OrderRequest, OrderResult } from '../types'

export const eventKeys = {
  forOrganisation: (slug: string) => ['event', slug] as const,
  detail: (slug: string, eventId: string) => ['event', slug, eventId] as const,
}

export function useEvent(slug: string, eventId: string, enabled = true) {
  return useQuery({
    queryKey: eventKeys.detail(slug, eventId),
    queryFn: () => api.get<EventDetail>(`/orgs/${slug}/events/${eventId}`),
    enabled: enabled && slug.length > 0 && eventId.length > 0,
    // Availability moves fast while tickets are selling.
    staleTime: 0,
  })
}

export function usePublicEvent(slug: string, eventId: string, enabled = true) {
  return useQuery({
    queryKey: ['public-event', slug, eventId] as const,
    queryFn: () => api.get<EventDetail>(`/public/orgs/${slug}/events/${eventId}`),
    enabled: enabled && slug.length > 0 && eventId.length > 0,
    staleTime: 0,
  })
}

export function useOrderTickets(slug: string, eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (order: OrderRequest) =>
      api.post<OrderResult>(`/orgs/${slug}/events/${eventId}/order`, order),
    // Whether it worked or not, availability, credit and "my tickets" may all have changed.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: eventKeys.detail(slug, eventId) }),
        queryClient.invalidateQueries({ queryKey: organisationKeys.detail(slug) }),
        queryClient.invalidateQueries({ queryKey: ticketKeys.mine(slug) }),
        queryClient.invalidateQueries({ queryKey: walletKeys.detail(slug) }),
      ]),
  })
}
