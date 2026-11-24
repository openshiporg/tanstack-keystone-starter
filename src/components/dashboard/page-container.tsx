import type { ReactNode } from 'react'

import { TopBar } from './top-bar'

type DashboardBreadcrumbItem = {
  type: 'link' | 'model' | 'page'
  label: string
  href?: string
}

export function toCrumbs(items: DashboardBreadcrumbItem[]) {
  return items.map((item) => ({
    label: item.label,
    href: item.type === 'page' ? undefined : item.href,
  }))
}

/** PageContainer: the shared top bar, an optional page head, then the page body. */
export function PageContainer({
  children,
  title,
  header,
  breadcrumbs,
  actions,
}: {
  children: ReactNode
  title?: string
  header?: ReactNode
  breadcrumbs?: DashboardBreadcrumbItem[]
  actions?: ReactNode
}) {
  const crumbs = toCrumbs(
    breadcrumbs?.length
      ? breadcrumbs
      : [{ type: 'page', label: title || '' }],
  )

  return (
    <div className="flex min-h-full flex-col">
      <TopBar crumbs={crumbs} actions={actions} />
      {header ? (
        <div className="px-4 pt-5 md:px-6 md:pt-6">{header}</div>
      ) : null}
      <div className="flex-1">
        {children}
      </div>
    </div>
  )
}
