import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api-client'

import type { Card, CardState } from '../types'

export const cardKeys = { mine: (slug: string) => ['cards', slug] as const }

/** The cards linked to the person's account at one organisation. */
export function useCards(slug: string) {
  return useQuery({ queryKey: cardKeys.mine(slug), queryFn: () => api.get<Card[]>(`/orgs/${slug}/me/cards`) })
}

function useCardMutation<TInput, TResult = unknown>(
  slug: string,
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cardKeys.mine(slug) }),
  })
}

/** Which organisation a card's link belongs to; the link itself carries no name, so it survives a rename. */
export function useCardOrganisation(code: string) {
  return useQuery({
    queryKey: ['card-organisation', code],
    queryFn: () => api.get<{ slug: string }>(`/c/${code}`),
  })
}

/** Whose a tapped card is, seen by the person signed in at its organisation. */
export function useCardState(slug: string, code: string, enabled = true) {
  return useQuery({
    queryKey: ['card-state', slug, code],
    queryFn: () => api.get<CardState>(`/orgs/${slug}/cards/${code}`),
    enabled,
  })
}

/** Links a tapped (or scanned) card to the wallet of the person signed in. */
export function useClaimCard(slug: string) {
  return useCardMutation(slug, (code: string) =>
    api.post<{ number: string }>(`/orgs/${slug}/cards/${code}/link`, {}),
  )
}

/** A blocked card stays on the account but no longer works at the door or the bar. */
export function useSetCardBlocked(slug: string) {
  return useCardMutation(slug, ({ id, blocked }: { id: string; blocked: boolean }) =>
    api.put(`/orgs/${slug}/me/cards/${id}/blocked`, { blocked }),
  )
}
