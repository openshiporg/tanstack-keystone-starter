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
  type: 'link' | 'model' | 'page'
  label: string
  href?: string
}

export function PageBreadcrumbs({
  items,
  actions,
}: {
  items: DashboardBreadcrumbItem[]
  actions?: React.ReactNode
}) {
  return (
    <header className="sticky top-0 z-30 flex min-h-16 shrink-0 items-center gap-2 border-b bg-background py-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:min-h-12">
      <div className="flex w-full min-w-0 items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb className="hidden min-w-0 overflow-hidden md:flex">
            <BreadcrumbList className="min-w-0 flex-nowrap overflow-hidden">
              {items.map((item, index) => (
                <span
                  key={`${item.type}-${item.label}-${index}`}
                  className="contents"
                >
                  {index > 0 ? <BreadcrumbSeparator /> : null}
                  <BreadcrumbItem className="min-w-0">
                    {item.type === 'page' ? (
                      <BreadcrumbPage className="block min-w-0 truncate">
                        {item.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        render={
                          <Link
                            className="text-foreground"
                            to={item.href ?? '/dashboard'}
                          />
                        }
                      >
                        {item.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </span>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
          {actions}
        </div>
      </div>
    </header>
  )
}
