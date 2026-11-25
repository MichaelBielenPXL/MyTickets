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
  MemberInfo,
  MemberSummary,
  StaffContext,
} from '../types'

export const staffKeys = {
  context: (slug: string) => ['staff', slug] as const,
  members: (slug: string, search: string) => ['staff', slug, 'members', search] as const,
  member: (slug: string, id: string) => ['staff', slug, 'member', id] as const,
}

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

/** Members whose name or email contains the search; the first ones alphabetically when it is empty. */
export function useStaffMembers(slug: string, search: string) {
  return useQuery({
    queryKey: staffKeys.members(slug, search),
    queryFn: () =>
      api.get<MemberSummary[]>(`/orgs/${slug}/staff/members?search=${encodeURIComponent(search)}`),
    // Keeps the last results up while the next ones load, so the list doesn't flicker while typing.
    placeholderData: (previous) => previous,
  })
}

export function useStaffMember(slug: string, id: string) {
  return useQuery({
    queryKey: staffKeys.member(slug, id),
    queryFn: () => api.get<MemberInfo>(`/orgs/${slug}/staff/members/${id}`),
  })
}
