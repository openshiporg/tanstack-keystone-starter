import { QueryClient } from '@tanstack/react-query'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'

import type { getRouter } from '@/router'

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
      },
    },
  })
}

export function installQueryIntegration({
  router,
  queryClient,
}: {
  router: ReturnType<typeof getRouter>
  queryClient: QueryClient
}) {
  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  })
}
