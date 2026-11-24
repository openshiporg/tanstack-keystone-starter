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

import { FilterBar } from '@/components/dashboard/filter-bar'
import { hasAnyDashboardFilters } from '@/components/dashboard/filter-param-compat'
import { KeystoneListTable } from '@/components/dashboard/keystone-list-table'
import { PageContainer } from '@/components/dashboard/page-container'
import { normalizeDashboardPageSize } from '@/components/dashboard/page-size'
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
  notFoundComponent: DashboardListNotFound,
})

function ListRoute() {
  const isChildRoute = useRouterState({
    select: (state) => state.matches.at(-1)?.routeId !== '/dashboard/$listKey',
  })
  const params = Route.useParams()
  const search = Route.useSearch()
  const loaderData = Route.useLoaderData()

  const { data, isFetching, error } = useQuery({
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
  const header = (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
        {list.label}
      </h1>
      <p className="text-muted-foreground">
        {list.description || `Create and manage ${list.label.toLowerCase()}`}
      </p>
    </div>
  )

  return (
    <PageContainer
      title={list.label}
      header={header}
      breadcrumbs={[
        { type: 'link', label: 'Overview', href: '/dashboard' },
        { type: 'page', label: list.label },
      ]}
    >
      <div className="px-4 md:px-6">
        <FilterBar list={list} selectedFields={selectedFields} />
      </div>

      {error ? (
        <div className="px-4 md:px-6">
          <div
            className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive"
            role="alert"
            aria-live="assertive"
          >
            Failed to load items: {error.message}
          </div>
        </div>
      ) : isFetching ? (
        <div
          className="px-4 md:px-6 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          Loading items…
        </div>
      ) : (
        <KeystoneListTable data={data} isFiltered={isFiltered} />
      )}
    </PageContainer>
  )
}

function DashboardListNotFound() {
  const { listKey } = Route.useParams()
  const title = 'Model not found'

  return (
    <PageContainer
      title={title}
      header={
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-muted-foreground">
            The model “{listKey}” is not available in this dashboard.
          </p>
        </div>
      }
      breadcrumbs={[
        { type: 'link', label: 'Overview', href: '/dashboard' },
        { type: 'page', label: title },
      ]}
    >
      <div className="px-4 md:px-6">
        <Link
          to="/dashboard"
          className="font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
        >
          Back to dashboard
        </Link>
      </div>
    </PageContainer>
  )
}

function toPositiveInteger(value: unknown, fallback?: number) {
  const parsed =
    typeof value === 'string' ? Number.parseInt(value, 10) : Number(value)
  if (Number.isFinite(parsed) && parsed > 0) return parsed
  return fallback
}
