import { createRouter as createTanStackRouter } from '@tanstack/react-router'

import {
  createAppQueryClient,
  installQueryIntegration,
} from './features/query-client'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = createAppQueryClient()
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    context: {
      queryClient,
    },
  })

  installQueryIntegration({ router, queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
