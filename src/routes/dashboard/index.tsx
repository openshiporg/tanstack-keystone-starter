import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Database, PlusIcon } from 'lucide-react'

import { PageContainer } from '@/components/dashboard/page-container'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
})

function DashboardIndexRoute() {
  const { data } = useSuspenseQuery({
    queryKey: dashboardQueryKeys.overview,
    queryFn: () => fetchDashboardOverview(),
  })

  const lists = data.lists.filter((list) => !list.hideNavigation)
  const header = (
    <div className="flex flex-col">
      <h1 className="text-lg font-semibold md:text-2xl">Dashboard</h1>
      {lists.length > 0 ? (
        <p className="text-muted-foreground">{lists.length} Models</p>
      ) : null}
    </div>
  )

  return (
    <PageContainer
      title="Dashboard"
      header={header}
      breadcrumbs={[{ type: 'page', label: 'Dashboard' }]}
    >
      <div className="flex w-full max-w-4xl flex-col gap-4 p-4 md:p-6">
        <div className="mb-4">
          <h2 className="mb-2 text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Data Models
          </h2>

          {lists.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:gap-4 xl:grid-cols-3">
              {lists.map((list) => (
                <ListCard key={list.key} list={list} />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}

function ListCard({
  list,
}: {
  list: (typeof Route.useLoaderData extends () => infer T
    ? Awaited<T>
    : never)['lists'][number]
}) {
  const isSingleton = list.isSingleton || false

  return (
    <Card
      className={cn(
        'relative bg-gradient-to-bl from-background to-muted/80 shadow-xs transition-colors hover:bg-muted',
      )}
    >
      {isSingleton ? (
        list.singletonItemId ? (
          <Link
            to="/dashboard/$listKey/$id"
            params={{ listKey: list.path, id: '1' }}
          >
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground">
                {list.label}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">Singleton</p>
            </CardContent>
          </Link>
        ) : !list.hideCreate ? (
          <Link
            to="/dashboard/$listKey/$id"
            params={{ listKey: list.path, id: '1' }}
          >
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground">
                {list.label}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Create singleton
              </p>
            </CardContent>
          </Link>
        ) : (
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground">
              {list.label}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">Singleton</p>
          </CardContent>
        )
      ) : (
        <Link to="/dashboard/$listKey" params={{ listKey: list.path }}>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground">
              {list.label}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {list.count} item{list.count !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Link>
      )}

      {!list.hideCreate && !isSingleton ? (
        <Link
          to="/dashboard/$listKey/create"
          params={{ listKey: list.path }}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'icon' }),
            'absolute top-3 right-3 size-7',
          )}
          title={`Add ${list.singular?.toLowerCase() || 'item'}`}
        >
          <PlusIcon className="size-4" />
          <span className="sr-only">Create new {list.label}</span>
        </Link>
      ) : null}
    </Card>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <Database className="mb-4 size-12 text-muted-foreground" />
      <h3 className="mb-2 text-lg font-semibold">No lists configured</h3>
      <p className="text-muted-foreground">
        There are no data models configured in your admin interface.
      </p>
    </div>
  )
}
