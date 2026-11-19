import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api-client'

import type {
  CardHolder,
  CashTopUpRequest,
  ChargeRequest,
  ChargeResult,
  CheckInRequest,
  CheckInResult,
  EventStatus,
  StaffContext,
} from '../types'

export const staffKeys = { context: (slug: string) => ['staff', slug] as const }

export function useStaffContext(slug: string) {
  return useQuery({
    queryKey: staffKeys.context(slug),
    queryFn: () => api.get<StaffContext>(`/orgs/${slug}/staff/context`),
  })
}

export function useCheckIn(slug: string) {
  return useMutation({
    mutationFn: (request: CheckInRequest) => api.post<CheckInResult>(`/orgs/${slug}/staff/checkin`, request),
  })
}

/** Who a card belongs to and how much credit is on it. Changes nothing. */
export function useLookUpCard(slug: string) {
  return useMutation({
    mutationFn: (cardUid: string) => api.post<CardHolder>(`/orgs/${slug}/staff/lookup`, { cardUid }),
  })
}

export function useChargeCard(slug: string) {
  return useMutation({
    mutationFn: (request: ChargeRequest) => api.post<ChargeResult>(`/orgs/${slug}/staff/charge`, request),
  })
}

export function useCashTopUp(slug: string) {
  return useMutation({
    mutationFn: (request: CashTopUpRequest) =>
      api.post<{ balanceCents: number; displayName: string }>(`/orgs/${slug}/staff/topup`, request),
  })
}

/** Opens the doors now (also before the start time, or again after closing), or closes the event. */
export function useEventDoors(slug: string, eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: 'open' | 'close') =>
      api.post<{ status: EventStatus }>(`/orgs/${slug}/staff/events/${eventId}/${action}`),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: staffKeys.context(slug) }),
        // The admin's event list shows the status too.
        queryClient.invalidateQueries({ queryKey: ['admin', slug, 'events'] }),
      ]),
  })
}
