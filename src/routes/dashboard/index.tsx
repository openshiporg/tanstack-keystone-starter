import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowUpRight, Database, Plus, Search } from 'lucide-react'

import { PageSkeleton } from '@/components/dashboard/page-skeleton'
import { useCommandPalette } from '@/components/dashboard/command-palette'
import { PageContainer } from '@/components/dashboard/page-container'
import { buttonVariants } from '@/components/ui/button'
import type { DashboardListSummary } from '@/features/cms/graphql-client'
import {
  dashboardQueryKeys,
  fetchDashboardOverview,
} from '@/features/cms/graphql-client'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/dashboard/')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: dashboardQueryKeys.overview,
      queryFn: () => fetchDashboardOverview(),
    }),
  component: DashboardIndexRoute,
  pendingComponent: PageSkeleton,
})

function DashboardIndexRoute() {
  const { data } = useSuspenseQuery({
    queryKey: dashboardQueryKeys.overview,
    queryFn: () => fetchDashboardOverview(),
  })

  const lists = data.lists.filter((list) => !list.hideNavigation)
  const total = lists.reduce(
    (sum, list) => sum + (list.isSingleton ? 0 : list.count),
    0,
  )

  return (
    <PageContainer
      title="Overview"
      breadcrumbs={[{ type: 'page', label: 'Overview' }]}
    >
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-4 pt-5 pb-16 md:px-6 md:pt-8">
        <div className="flex items-baseline gap-2">
          <h1 className="text-[18px] leading-7 font-semibold tracking-[-0.01em] text-[var(--ks-ink)] md:text-[20px]">
            Overview
          </h1>
          {lists.length > 0 ? (
            <span className="font-mono text-[12px] text-[var(--ks-dim)] tabular-nums">
              {total.toLocaleString('en-US')} records
            </span>
          ) : null}
        </div>

        <OverviewSearch />

        {lists.length === 0 ? (
          <div className="ks-card">
            <EmptyState />
          </div>
        ) : (
          <section
            aria-labelledby="lists-heading"
            className="flex flex-col gap-2"
          >
            <h2 id="lists-heading" className="ks-label px-1">
              Lists
            </h2>
            <ul className="ks-card divide-y divide-[var(--ks-line)] overflow-hidden">
              {lists.map((list) => (
                <ListRow key={list.key} list={list} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </PageContainer>
  )
}

/** Find-a-record entry on the overview: opens the command palette's record search. */
function OverviewSearch() {
  const palette = useCommandPalette()
  return (
    <button
      type="button"
      onClick={palette.open}
      className="ks-field flex h-10 w-full items-center gap-2.5 px-3 text-left text-[13px] text-[var(--ks-label)] hover:text-[var(--ks-dim)]"
    >
      <Search className="size-4 shrink-0" />
      <span className="flex-1 truncate">Search records</span>
      <kbd className="ks-kbd max-sm:hidden">⌘K</kbd>
    </button>
  )
}

/**
 * One list: label on the left, then a New pill and one ks-track holding the count (a plain
 * label) and an open-list arrow pill. The whole row is a link; only the two buttons take clicks.
 */
function ListRow({ list }: { list: DashboardListSummary }) {
  const isSingleton = list.isSingleton || false
  const hideCreate = Boolean(list.hideCreate)
  const singletonIsMissing = isSingleton && !list.singletonItemId
  const meta = isSingleton
    ? singletonIsMissing
      ? 'Not created'
      : 'Singleton'
    : list.count.toLocaleString('en-US')
  const canOpen = !(singletonIsMissing && hideCreate)
  const href = isSingleton
    ? `/dashboard/${list.path}/1`
    : `/dashboard/${list.path}`

  const body = (
    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--ks-ink)]">
      {list.label}
    </span>
  )

  return (
    <li className="group relative flex items-center gap-3 px-3 py-[5px] md:px-4">
      {!canOpen ? (
        <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
      ) : (
        <Link
          to={href}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-[8px] outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-[10px] focus-visible:after:ring-2 focus-visible:after:ring-[var(--ks-focus)]"
        >
          {body}
        </Link>
      )}
      <div className="pointer-events-none relative z-10 flex shrink-0 items-center justify-end gap-2">
        {!hideCreate && !isSingleton ? (
          <Link
            to="/dashboard/$listKey/create"
            params={{ listKey: list.path }}
            aria-label={`New ${list.singular?.toLowerCase() || 'item'}`}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'pointer-events-auto max-sm:w-7 max-sm:px-0',
            )}
          >
            <Plus />
            <span className="max-sm:hidden">New</span>
          </Link>
        ) : null}
        <div className="ks-track">
          <span className="flex h-7 min-w-9 items-center justify-end px-1.5 font-mono text-[12px] text-[var(--ks-dim)] tabular-nums">
            {meta}
          </span>
          {canOpen ? (
            <Link
              to={href}
              aria-label={`Open ${list.label}`}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'icon-sm' }),
                'pointer-events-auto',
              )}
            >
              <ArrowUpRight />
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 p-10 text-center">
      <Database className="mb-2 size-5 text-[var(--ks-label)]" />
      <h3 className="text-[13px] font-medium text-[var(--ks-ink)]">No lists</h3>
      <p className="text-[13px] text-[var(--ks-dim)]">
        There are no lists configured in this dashboard.
      </p>
    </div>
  )
}
