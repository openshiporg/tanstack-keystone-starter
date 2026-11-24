import {
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
} from '@tanstack/react-router'

import { DashboardNotFound } from '@/components/dashboard/not-found'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { DashboardErrorFallback } from '@/components/dashboard/error-boundary'
import { getDashboardAuthStateForCurrentRequest } from '@/features/cms/dashboard-auth.functions'
import {
  isStandaloneDashboardAuthPath,
  resolveDashboardRedirect,
} from '@/features/cms/dashboard-route-guards'

function publicSignupsAllowed() {
  return process.env.PUBLIC_SIGNUPS_ALLOWED === 'true'
}

function dashboardRedirect(to: string, from?: string) {
  throw redirect({
    to,
    search: from ? { from } : undefined,
  })
}

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async ({ location }) => {
    if (typeof window !== 'undefined') return

    const { authenticatedItem, redirectToInit } =
      await getDashboardAuthStateForCurrentRequest()
    const decision = resolveDashboardRedirect({
      pathname: location.pathname,
      searchFrom:
        'from' in location.search ? String(location.search.from) : undefined,
      publicSignupsAllowed: publicSignupsAllowed(),
      authenticatedItem,
      redirectToInit,
    })

    if (decision) dashboardRedirect(decision.to, decision.search?.from)
  },
  component: DashboardLayoutRoute,
  notFoundComponent: () => <DashboardNotFound />,
  errorComponent: ({ error, reset }) => (
    <DashboardErrorFallback error={error} reset={reset} />
  ),
})

function DashboardLayoutRoute() {
  const location = useLocation()
  const isStandaloneAuthRoute = isStandaloneDashboardAuthPath(location.pathname)

  if (isStandaloneAuthRoute) return <Outlet />

  return (
    <DashboardShell>
      <Outlet />
    </DashboardShell>
  )
}
