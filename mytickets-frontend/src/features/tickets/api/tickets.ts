import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api-client'

import type { MyTicket } from '../types'

export const ticketKeys = { mine: (slug: string) => ['tickets', slug] as const }

/** The person's tickets at one organisation, latest event first. */
export function useMyTickets(slug: string) {
  return useQuery({
    queryKey: ticketKeys.mine(slug),
    queryFn: () => api.get<MyTicket[]>(`/orgs/${slug}/me/tickets`),
  })
}
