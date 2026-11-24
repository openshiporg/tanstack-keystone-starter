import { Link } from '@tanstack/react-router'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'

type DashboardBreadcrumbItem = {
  type: 'link' | 'page'
  label: string
  href?: string
}

export function PageContainer({
  children,
  title,
  header,
  breadcrumbs,
}: {
  children: React.ReactNode
  title?: string
  header?: React.ReactNode
  breadcrumbs?: DashboardBreadcrumbItem[]
}) {
  return (
    <div className="flex flex-col space-y-4">
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          {breadcrumbs?.length ? (
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((item, index) => (
                  <span
                    key={`${item.type}-${item.label}-${index}`}
                    className="contents"
                  >
                    <BreadcrumbItem>
                      {item.type === 'link' && item.href ? (
                        <BreadcrumbLink render={<Link to={item.href} />}>
                          {item.label}
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{item.label}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                    {index < breadcrumbs.length - 1 ? (
                      <BreadcrumbSeparator />
                    ) : null}
                  </span>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          ) : null}
        </div>
        <div className="px-4" />
      </header>

      {header ? (
        <div className="flex flex-col space-y-1.5 px-4 md:px-6">{header}</div>
      ) : null}

      <main className="flex-1" aria-label={title}>
        {children}
      </main>
    </div>
  )
}
