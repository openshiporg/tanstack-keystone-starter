import type { QueryClient } from '@tanstack/react-query'

import { dashboardQueryKeys, executeDashboardGraphQL } from './graphql-client'

function isDashboardQueryKey(queryKey: unknown) {
  return (
    Array.isArray(queryKey) && queryKey[0] === dashboardQueryKeys.adminMeta[0]
  )
}

export async function signOutDashboard(queryClient?: QueryClient) {
  try {
    await executeDashboardGraphQL('mutation DashboardSignOut { endSession }')
  } catch (error) {
    console.error('[dashboard/signout] endSession failed:', error)
  }

  if (queryClient) {
    await queryClient.cancelQueries({
      predicate: (query) => isDashboardQueryKey(query.queryKey),
    })
    queryClient.removeQueries({
      predicate: (query) => isDashboardQueryKey(query.queryKey),
    })
  }

  window.location.assign('/dashboard/signin')
}
