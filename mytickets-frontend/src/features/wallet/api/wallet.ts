import { useMutation, useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api-client'

import type { Wallet } from '../types'

export const walletKeys = { detail: (slug: string) => ['wallet', slug] as const }

/** The member's credit and history with one organisation. */
export function useWallet(slug: string, enabled = true) {
  return useQuery({
    enabled,
    queryKey: walletKeys.detail(slug),
    queryFn: () => api.get<Wallet>(`/orgs/${slug}/wallet`),
    staleTime: 0,
  })
}

/** Starts an online top-up; the credit arrives once the payment at `checkoutUrl` goes through. */
export function useStartTopUp(slug: string) {
  return useMutation({
    mutationFn: (topUp: { amountCents: number } | { dealId: string }) =>
      api.post<{ checkoutUrl: string }>(
        `/orgs/${slug}/wallet/topup`,
        'dealId' in topUp ? { amountCents: 0, dealId: topUp.dealId } : topUp,
      ),
  })
}
