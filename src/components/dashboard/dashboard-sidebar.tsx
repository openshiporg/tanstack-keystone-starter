/**
 * Sidebar: overview, every list the session can see (labels only), search, and the account menu.
 */
import { Link, useLocation } from '@tanstack/react-router'
import { LayoutGrid, Search } from 'lucide-react'

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
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import type { DashboardListSummary } from '@/features/cms/graphql-client'

import { useCommandPalette } from './command-palette'
import { LogoIcon } from './logo'
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
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function DashboardSidebar({
  lists,
  user,
}: {
  lists: DashboardListSummary[]
  user?: DashboardUser | null
}) {
  const { setOpenMobile } = useSidebar()
  const pathname = useLocation().pathname
  const palette = useCommandPalette()
  const close = () => setOpenMobile(false)
  const sidebarLinks = lists.map((list) => ({
    key: list.key,
    title: list.label,
    href: `/dashboard/${list.path}`,
  }))

  return (
    <SidebarComponent collapsible="icon" variant="inset">
      <SidebarHeader className="gap-2 px-2 pt-2.5 pb-1">
        <Link
          to="/dashboard"
          onClick={close}
          className="flex h-8 items-center gap-2 rounded-[8px] px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ks-focus)] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <span className="ks-raised grid size-6 shrink-0 place-items-center rounded-[7px]">
            <LogoIcon className="size-3.5" suffix="-nav" />
          </span>
          <span className="truncate text-[13px] font-semibold tracking-[-0.01em] text-[var(--ks-ink)] group-data-[collapsible=icon]:hidden">
            Keystone
          </span>
        </Link>
        <button
          type="button"
          onClick={() => {
            close()
            palette.open()
          }}
          className="ks-field flex h-8 w-full items-center gap-2 px-2 text-left text-[13px] text-[var(--ks-label)] outline-none hover:text-[var(--ks-dim)] group-data-[collapsible=icon]:hidden"
        >
          <Search className="size-3.5" />
          <span className="flex-1">Search</span>
          <span className="ks-kbd max-md:hidden">⌘K</span>
        </button>
      </SidebarHeader>

      <SidebarContent
        id="dashboard-primary-navigation"
        role="navigation"
        aria-label="Primary navigation"
        className="no-scrollbar"
      >
        <SidebarGroup className="py-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={
                  <Link
                    to="/dashboard"
                    aria-current={
                      isLinkActive(pathname, '/dashboard') ? 'page' : undefined
                    }
                    onClick={close}
                  />
                }
                isActive={isLinkActive(pathname, '/dashboard')}
                tooltip="Overview"
              >
                <LayoutGrid />
                <span>Overview</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {sidebarLinks.length > 0 ? (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel>Lists</SidebarGroupLabel>
            <SidebarMenu>
              {sidebarLinks.map((link) => {
                const active = isLinkActive(pathname, link.href)
                return (
                  <SidebarMenuItem
                    key={link.href}
                    className="group-data-[collapsible=icon]:hidden"
                  >
                    <SidebarMenuButton
                      render={
                        <Link
                          to={link.href}
                          aria-current={active ? 'page' : undefined}
                          onClick={close}
                        />
                      }
                      isActive={active}
                    >
                      <span>{link.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="p-2">
        {user ? <UserProfile user={user} /> : null}
      </SidebarFooter>
      <SidebarRail />
    </SidebarComponent>
  )
}
