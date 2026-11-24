import type { ReactNode } from 'react'

import { toCrumbs } from './page-container'
import { TopBar } from './top-bar'

type DashboardBreadcrumbItem = {
  type: 'link' | 'model' | 'page'
  label: string
  href?: string
}

/** The sticky trail plus page actions; the same TopBar PageContainer renders. */
export function PageBreadcrumbs({
  items,
  actions,
}: {
  items: DashboardBreadcrumbItem[]
  actions?: ReactNode
}) {
  return <TopBar crumbs={toCrumbs(items)} actions={actions} />
}
