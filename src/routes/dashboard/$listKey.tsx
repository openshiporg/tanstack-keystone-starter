import { Outlet, createFileRoute } from '@tanstack/react-router'

import { DashboardNotFound } from '@/components/dashboard/not-found'

// Layout only. The list itself is `$listKey.index.tsx`, so record and create pages don't load
// the list's rows first or inherit its page/sort/filter search params. Unknown lists and
// records land on the not-found card here, inside the dashboard shell.
export const Route = createFileRoute('/dashboard/$listKey')({
  component: Outlet,
  notFoundComponent: () => <DashboardNotFound />,
})
