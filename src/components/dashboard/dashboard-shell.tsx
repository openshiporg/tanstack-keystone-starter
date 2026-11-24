import { useSuspenseQuery } from '@tanstack/react-query'

import {
  dashboardQueryKeys,
  fetchDashboardOverview,
} from '@/features/cms/graphql-client'

import { DashboardErrorBoundary } from './error-boundary'
import { DashboardLayout } from './dashboard-layout'

function DashboardShellContent({ children }: { children: React.ReactNode }) {
  const { data } = useSuspenseQuery({
    queryKey: dashboardQueryKeys.overview,
    queryFn: () => fetchDashboardOverview(),
  })

  return (
    <DashboardLayout user={data.authenticatedItem} lists={data.lists}>
      {children}
    </DashboardLayout>
  )
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardErrorBoundary>
      <DashboardShellContent>{children}</DashboardShellContent>
    </DashboardErrorBoundary>
  )
}
