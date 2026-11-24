import { Collapsible } from '@base-ui/react/collapsible'
import { Link, useLocation } from '@tanstack/react-router'
import { ChevronRight, Home, Package } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar as SidebarComponent,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import type { DashboardListSummary } from '@/features/cms/graphql-client'

import { Logo, LogoIcon } from './logo'
import { UserProfile } from './user-profile'

export type DashboardUser = {
  id: string
  listPath: string
  label?: string | null
  identity?: string | null
  name?: string | null
  email?: string | null
}

function isLinkActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname.startsWith(href)
}

export function DashboardSidebar({
  lists,
  user,
}: {
  lists: DashboardListSummary[]
  user?: DashboardUser | null
}) {
  const { isMobile, setOpenMobile } = useSidebar()
  const pathname = useLocation().pathname
  const sidebarLinks = lists.map((list) => ({
    title: list.label,
    href: `/dashboard/${list.path}`,
  }))
  const modelsAreActive = sidebarLinks.some((link) =>
    isLinkActive(pathname, link.href),
  )

  return (
    <SidebarComponent collapsible="icon">
      <SidebarHeader>
        <SidebarMenuButton render={<div />}>
          <div className="p-2 group-has-[[data-collapsible=icon]]/sidebar-wrapper:hidden">
            <Logo aria-hidden="true" />
          </div>
        </SidebarMenuButton>
        <SidebarMenuButton render={<div />}>
          <div className="hidden group-has-[[data-collapsible=icon]]/sidebar-wrapper:block">
            <LogoIcon className="size-6" />
          </div>
        </SidebarMenuButton>
      </SidebarHeader>

      <SidebarContent
        id="dashboard-primary-navigation"
        role="navigation"
        aria-label="Primary navigation"
        className="no-scrollbar"
      >
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={
                  <Link
                    to="/dashboard"
                    aria-current={
                      isLinkActive(pathname, '/dashboard') ? 'page' : undefined
                    }
                    onClick={() => setOpenMobile(false)}
                  />
                }
                isActive={isLinkActive(pathname, '/dashboard')}
              >
                <Home className="size-4" />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarMenu>
            <SidebarGroupLabel>Models</SidebarGroupLabel>
            <div className="max-h-full overflow-y-auto group-has-[[data-collapsible=icon]]/sidebar-wrapper:hidden">
              <Collapsible.Root
                defaultOpen={modelsAreActive}
                className="group/collapsible"
                render={<SidebarMenuItem />}
              >
                <Collapsible.Trigger render={<SidebarMenuButton />}>
                  <Package className="size-4" />
                  <span>Models</span>
                  <ChevronRight
                    className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90"
                    aria-hidden="true"
                  />
                </Collapsible.Trigger>
                <Collapsible.Panel>
                  <SidebarMenuSub>
                    {sidebarLinks.map((link) => (
                      <SidebarMenuSubItem key={link.href}>
                        <SidebarMenuSubButton
                          render={
                            <Link
                              to={link.href}
                              aria-current={
                                isLinkActive(pathname, link.href)
                                  ? 'page'
                                  : undefined
                              }
                              onClick={() => setOpenMobile(false)}
                            />
                          }
                          isActive={isLinkActive(pathname, link.href)}
                        >
                          <span>{link.title}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </Collapsible.Panel>
              </Collapsible.Root>
            </div>

            <div className="hidden group-has-[[data-collapsible=icon]]/sidebar-wrapper:block">
              <DropdownMenu>
                <SidebarMenuItem>
                  <DropdownMenuTrigger
                    render={
                      <SidebarMenuButton className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground" />
                    }
                  >
                    <Package className="size-4" />
                    <span className="sr-only">Models</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side={isMobile ? 'bottom' : 'right'}
                    align={isMobile ? 'end' : 'start'}
                    className="min-w-56"
                  >
                    <div className="max-h-[calc(100vh-16rem)] overflow-y-auto py-1">
                      {sidebarLinks.map((link) => {
                        const active = isLinkActive(pathname, link.href)
                        return (
                          <DropdownMenuItem
                            key={link.href}
                            render={
                              <Link
                                to={link.href}
                                aria-current={active ? 'page' : undefined}
                                onClick={() => setOpenMobile(false)}
                              />
                            }
                            className={active ? 'bg-blue-50 text-blue-600' : ''}
                          >
                            <span>{link.title}</span>
                            {active ? (
                              <span
                                className="ml-auto size-2 rounded-full bg-blue-600"
                                aria-hidden="true"
                              />
                            ) : null}
                          </DropdownMenuItem>
                        )
                      })}
                    </div>
                  </DropdownMenuContent>
                </SidebarMenuItem>
              </DropdownMenu>
            </div>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>{user ? <UserProfile user={user} /> : null}</SidebarFooter>
      <SidebarRail />
    </SidebarComponent>
  )
}
