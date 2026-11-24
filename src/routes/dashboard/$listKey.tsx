import { useQuery } from '@tanstack/react-query'
import {
  Link,
  Outlet,
  createFileRoute,
  notFound,
  redirect,
  useRouterState,
} from '@tanstack/react-router'
import type { SearchSchemaInput } from '@tanstack/react-router'
import { Plus, RotateCw, SearchX, TriangleAlert } from 'lucide-react'

import { PageSkeleton } from '@/components/dashboard/page-skeleton'
import { DashboardNotFound } from '@/components/dashboard/not-found'
import { FilterBar } from '@/components/dashboard/filter-bar'
import { hasAnyDashboardFilters } from '@/components/dashboard/filter-param-compat'
import { KeystoneListTable } from '@/components/dashboard/keystone-list-table'
import { PageContainer } from '@/components/dashboard/page-container'
import { normalizeDashboardPageSize } from '@/components/dashboard/page-size'
import { Button, buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import {
  dashboardQueryKeys,
  fetchDashboardListPage,
  fetchKeystoneAdminMeta,
  findDashboardListByPath,
} from '@/features/cms/graphql-client'

type DashboardListSearchInput = Record<string, unknown> &
  SearchSchemaInput & {
    page?: unknown
    pageSize?: unknown
    search?: unknown
    sortBy?: unknown
    fields?: unknown
    column?: unknown
    filter?: unknown
  }

export const Route = createFileRoute('/dashboard/$listKey')({
  validateSearch: (search: DashboardListSearchInput) => ({
    ...search,
    page: toPositiveInteger(search.page, 1),
    pageSize: normalizeDashboardPageSize(search.pageSize, 50),
    search: typeof search.search === 'string' ? search.search : '',
    sortBy: typeof search.sortBy === 'string' ? search.sortBy : '',
    fields:
      typeof search.fields === 'string'
        ? search.fields
        : Array.isArray(search.column)
          ? search.column.map(String).join(',')
          : typeof search.column === 'string'
            ? search.column
            : '',
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, params, deps }) => {
    const adminMeta = await context.queryClient.ensureQueryData({
      queryKey: dashboardQueryKeys.adminMeta,
      queryFn: () => fetchKeystoneAdminMeta(),
    })
    const list = findDashboardListByPath(adminMeta, params.listKey)
    if (!list) throw notFound()
    if (params.listKey !== list.path)
      throw redirect({
        to: '/dashboard/$listKey',
        params: { listKey: list.path },
        search: deps,
      })

    try {
      return await context.queryClient.ensureQueryData({
        queryKey: dashboardQueryKeys.listPage(params.listKey, deps),
        queryFn: () =>
          fetchDashboardListPage({
            listPath: params.listKey,
            page: deps.page,
            pageSize: deps.pageSize,
            search: deps.search,
            sortBy: deps.sortBy,
            fields: deps.fields,
            filters: deps,
          }),
      })
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('List not found:'))
        throw notFound()
      throw error
    }
  },
  component: ListRoute,
  pendingComponent: PageSkeleton,
  notFoundComponent: DashboardListNotFound,
})

function ListRoute() {
  const isChildRoute = useRouterState({
    select: (state) => state.matches.at(-1)?.routeId !== '/dashboard/$listKey',
  })
  const params = Route.useParams()
  const search = Route.useSearch()
  const loaderData = Route.useLoaderData()

  const navigate = Route.useNavigate()
  const { data, isFetching, error, refetch } = useQuery({
    queryKey: dashboardQueryKeys.listPage(params.listKey, search),
    queryFn: () =>
      fetchDashboardListPage({
        listPath: params.listKey,
        page: search.page,
        pageSize: search.pageSize,
        search: search.search,
        sortBy: search.sortBy,
        fields: search.fields,
        filters: search,
      }),
    initialData: loaderData,
  })

  const list = data.list

  if (isChildRoute) return <Outlet />

  const selectedFields = new Set(data.selectedFieldPaths)
  const isFiltered =
    Boolean(search.search.trim()) || hasAnyDashboardFilters(search)
  const isEmpty = !error && data.count === 0 && !isFiltered
  const canCreate = !list.hideCreate && !list.isSingleton

  const createAction = canCreate ? (
    <Link
      to="/dashboard/$listKey/create"
      params={{ listKey: list.path }}
      data-variant="primary"
      className={buttonVariants({ size: 'sm' })}
    >
      <Plus />
      <span className="max-sm:hidden">New {list.singular.toLowerCase()}</span>
      <span className="sm:hidden">New</span>
    </Link>
  ) : null

  const header = (
    <div className="flex items-center gap-2.5">
      <h1 className="text-[18px] leading-7 font-semibold tracking-[-0.01em] text-[var(--ks-ink)] md:text-[20px]">
        {list.label}
      </h1>
      {!error ? (
        <span
          className="font-mono text-[12px] text-[var(--ks-dim)]"
          aria-label={`${data.count} total`}
        >
          {data.count}
        </span>
      ) : null}
    </div>
  )

  return (
    <PageContainer
      title={list.label}
      header={header}
      actions={createAction}
      breadcrumbs={[
        { type: 'link', label: 'Overview', href: '/dashboard' },
        { type: 'page', label: list.label },
      ]}
    >
      <div className="px-4 pt-4 pb-3 md:px-6">
        <FilterBar list={list} selectedFields={selectedFields} />
      </div>

      <div className="border-y border-[var(--ks-line)] md:mx-6 md:mb-6 md:rounded-[12px] md:border md:bg-[var(--ks-surface)] md:shadow-[var(--ks-card-shadow)]">
        {error ? (
          <EmptyState
            title={`Couldn't load ${list.label.toLowerCase()}`}
            description={error.message}
            icons={[TriangleAlert]}
          >
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              <RotateCw />
              Retry
            </Button>
          </EmptyState>
        ) : isEmpty ? (
          <EmptyState title={`No ${list.plural.toLowerCase()}`}>
            {canCreate ? (
              <Link
                to="/dashboard/$listKey/create"
                params={{ listKey: list.path }}
                data-variant="primary"
                className={buttonVariants({ size: 'sm' })}
              >
                <Plus />
                New {list.singular.toLowerCase()}
              </Link>
            ) : null}
          </EmptyState>
        ) : data.count === 0 ? (
          <EmptyState
            title="No matches"
            description={
              search.search ? `Nothing matches “${search.search}”` : undefined
            }
            icons={[SearchX]}
            action={{
              label: 'Clear search and filters',
              onClick: () =>
                void navigate({
                  to: '/dashboard/$listKey',
                  params: { listKey: list.path },
                }),
            }}
          />
        ) : (
          <KeystoneListTable
            data={data}
            isFiltered={isFiltered}
            isFetching={isFetching}
          />
        )}
      </div>
    </PageContainer>
  )
}

function DashboardListNotFound() {
  return <DashboardNotFound />
}

function toPositiveInteger(value: unknown, fallback?: number) {
  const parsed =
    typeof value === 'string' ? Number.parseInt(value, 10) : Number(value)
  if (Number.isFinite(parsed) && parsed > 0) return parsed
  return fallback
}
