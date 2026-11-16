import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api-client'

import type { Payment } from '../types'

export const paymentKeys = { detail: (slug: string, id: string) => ['payment', slug, id] as const }

export function usePayment(slug: string, id: string) {
  return useQuery({
    queryKey: paymentKeys.detail(slug, id),
    queryFn: () => api.get<Payment>(`/orgs/${slug}/payments/${id}`),
    staleTime: 0,
  })
}

/** The two buttons of the test checkout. A real payment company replaces this with its own page. */
export function useFinishTestPayment(slug: string, id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (outcome: 'pay' | 'cancel') => api.post(`/orgs/${slug}/payments/${id}/test-${outcome}`),
    // A payment can change tickets, credit and membership, so everything is reloaded.
    onSettled: () => queryClient.invalidateQueries(),
  })
}
