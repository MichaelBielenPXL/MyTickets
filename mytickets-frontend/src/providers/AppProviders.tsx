import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { BrowserRouter } from 'react-router-dom'

import { LanguageProvider } from '@/lib/i18n'
import { createQueryClient } from '@/lib/query-client'

type AppProvidersProps = {
  children: ReactNode
}

/** Everything the app needs around it: the server-data cache, the router and the language. */
export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(createQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LanguageProvider>{children}</LanguageProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
