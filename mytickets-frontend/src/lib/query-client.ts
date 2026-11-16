import { QueryClient } from '@tanstack/react-query'

import { ApiError } from '@/lib/api-client'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        // Retrying helps with a dropped connection, not with "not found" or "not allowed".
        retry: (failures, error) => failures < 2 && !(error instanceof ApiError && error.status >= 400),
      },
      // Never repeat a payment or a charge on our own; the person decides whether to try again.
      mutations: { retry: false },
    },
  })
}
