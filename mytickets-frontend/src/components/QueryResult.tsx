import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { ErrorNote } from './ErrorNote'
import { Loading } from './Loading'

type QueryResultProps<T> = {
  query: UseQueryResult<T>
  children: (data: T) => ReactNode
}

/** Shows "Loading…" or the error for a query, and the content once the data is there. */
export function QueryResult<T>({ query, children }: QueryResultProps<T>) {
  if (query.data !== undefined) return <>{children(query.data)}</>
  if (query.isError) return <ErrorNote error={query.error} />
  return <Loading />
}
