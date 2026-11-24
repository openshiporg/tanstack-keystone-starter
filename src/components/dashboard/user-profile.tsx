import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowUpRight,
  ChevronsUpDown,
  Database,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Sun,
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useTheme } from '@/components/ui/theme-provider'
import { signOutDashboard } from '@/features/cms/dashboard-session'

import type { DashboardUser } from './dashboard-sidebar'

function initialsFor(user: DashboardUser) {
  const displayName = user.name || user.label
  if (displayName) {
    return displayName
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
  }
  return String(user.email ?? user.identity ?? 'US')
    .slice(0, 2)
    .toUpperCase()
}

export function UserProfile({ user }: { user: DashboardUser }) {
  const queryClient = useQueryClient()
  const { isMobile } = useSidebar()
  const { theme, setTheme } = useTheme()
  const initials = initialsFor(user)
  const displayName = user.name || user.label || 'Authenticated item'
  const identity = user.email || user.identity || user.id

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0"
              />
            }
          >
            <Avatar className="size-8 rounded-lg group-data-[collapsible=icon]:size-6">
              <AvatarFallback className="rounded-lg border bg-muted/80">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-semibold">{displayName}</span>
              <span className="truncate text-xs">{identity}</span>
            </div>
            <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <div className="p-0 font-normal">
              <Link
                to="/dashboard/$listKey/$id"
                params={{ listKey: user.listPath, id: user.id }}
                className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-left text-sm hover:bg-accent"
              >
                <Avatar className="size-8 rounded-lg">
                  <AvatarImage src="" alt={displayName} />
                  <AvatarFallback className="rounded-lg border bg-muted/40">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{displayName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {identity}
                  </span>
                </div>
                <ArrowUpRight className="size-4 text-muted-foreground" />
              </Link>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => window.open('/api/graphql', '_blank')}
              className="gap-3"
            >
              <Database className="size-4 text-muted-foreground" />
              <span className="text-sm">GraphQL API</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-between gap-3"
              onSelect={(event) => event.preventDefault()}
            >
              <div className="flex items-center gap-3">
                <Palette className="size-4 text-muted-foreground" />
                <span className="text-sm">Theme</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className={
                    theme === 'light'
                      ? 'rounded bg-accent p-1'
                      : 'rounded p-1 hover:bg-accent'
                  }
                  onClick={() => setTheme('light')}
                  aria-label="Light theme"
                >
                  <Sun className="size-3.5" />
                </button>
                <button
                  type="button"
                  className={
                    theme === 'dark'
                      ? 'rounded bg-accent p-1'
                      : 'rounded p-1 hover:bg-accent'
                  }
                  onClick={() => setTheme('dark')}
                  aria-label="Dark theme"
                >
                  <Moon className="size-3.5" />
                </button>
                <button
                  type="button"
                  className={
                    theme === 'system'
                      ? 'rounded bg-accent p-1'
                      : 'rounded p-1 hover:bg-accent'
                  }
                  onClick={() => setTheme('system')}
                  aria-label="System theme"
                >
                  <Monitor className="size-3.5" />
                </button>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              onClick={() => void signOutDashboard(queryClient)}
            >
              <LogOut className="size-4 text-muted-foreground" />
              <span className="text-sm">Log out</span>
            </button>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
