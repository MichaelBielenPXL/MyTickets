import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api-client'

import type { Card } from '../types'

export const cardKeys = { mine: (slug: string) => ['cards', slug] as const }

/** The cards linked to the person's account at one organisation. */
export function useCards(slug: string) {
  return useQuery({ queryKey: cardKeys.mine(slug), queryFn: () => api.get<Card[]>(`/orgs/${slug}/me/cards`) })
}

function useCardMutation<TInput>(slug: string, mutationFn: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cardKeys.mine(slug) }),
  })
}

export function useLinkCard(slug: string) {
  return useCardMutation(slug, (card: { uid: string; label: string }) =>
    api.post(`/orgs/${slug}/me/cards`, card),
  )
}

/** A blocked card stays on the account but no longer works at the door or the bar. */
export function useSetCardBlocked(slug: string) {
  return useCardMutation(slug, ({ id, blocked }: { id: string; blocked: boolean }) =>
    api.put(`/orgs/${slug}/me/cards/${id}/blocked`, { blocked }),
  )
}

export function useRemoveCard(slug: string) {
  return useCardMutation(slug, (id: string) => api.delete(`/orgs/${slug}/me/cards/${id}`))
}
