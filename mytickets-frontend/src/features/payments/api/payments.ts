import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api-client'

import type { Payment } from '../types'

export const paymentKeys = { detail: (slug: string, id: string) => ['payment', slug, id] as const }

/**
 * One payment, as its buyer sees it. Back from Stripe, it asks Stripe how it went (rather than waiting
 * for Stripe to tell us) and keeps asking every couple of seconds while the bank is still confirming.
 */
export function usePayment(slug: string, id: string, cancelled = false) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: [...paymentKeys.detail(slug, id), cancelled],
    queryFn: async () => {
      // Back from Stripe without paying: close Stripe's page, so it can't be paid later in another tab.
      const action = cancelled ? 'cancel' : 'refresh'
      const payment = await api.post<Payment>(`/orgs/${slug}/payments/${id}/${action}`)
      // A finished payment may have changed tickets, credit or membership: let those pages load afresh.
      if (payment.status !== 'Pending')
        await queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'payment' })
      return payment
    },
    staleTime: 0,
    refetchInterval: (query) =>
      query.state.data?.status === 'Pending' &&
      query.state.data.provider !== 'Fake' &&
      query.state.dataUpdateCount < 30
        ? 2000
        : false,
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
