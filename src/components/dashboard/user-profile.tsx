/**
 * UserProfile: the account menu at the foot of the sidebar, plus UserAvatar (the assistant uses it too).
 */
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ChevronsUpDown,
  CircleUser,
  Database,
  LogOut,
  Monitor,
  Moon,
  Sun,
} from 'lucide-react'

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
import { cn } from '@/lib/utils'

import type { DashboardUser } from './dashboard-sidebar'

type AvatarUser = {
  name?: string | null
  label?: string | null
  email?: string | null
  identity?: string | null
}

export function initialsFor(user: AvatarUser) {
  const source =
    user.name?.trim() || user.label?.trim() || user.email || user.identity || '?'
  const parts = source.split(/\s+/).filter(Boolean)
  const letters =
    parts.length > 1
      ? parts[0][0] + parts[parts.length - 1][0]
      : source.slice(0, 2)
  return letters.toUpperCase()
}

export function UserAvatar({
  user,
  className = 'size-7 text-[12px]',
}: {
  user: AvatarUser
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'ks-raised grid shrink-0 place-items-center rounded-full font-mono font-medium text-[var(--ks-ink-2)]',
        className,
      )}
    >
      {initialsFor(user)}
    </span>
  )
}

const THEMES = [
  ['light', 'Light', Sun],
  ['dark', 'Dark', Moon],
  ['system', 'System', Monitor],
] as const

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  return (
    <div className="ks-seg" role="radiogroup" aria-label="Theme">
      {THEMES.map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={`${label} theme`}
          title={label}
          onClick={() => setTheme(value)}
          className="grid h-6 w-7 place-items-center"
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  )
}

export function UserProfile({ user }: { user: DashboardUser }) {
  const queryClient = useQueryClient()
  const { isMobile, setOpenMobile } = useSidebar()
  const displayName = user.name || user.label || user.email || 'Account'
  const identity = user.email || user.identity || user.id

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="gap-2.5 px-1.5 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0"
              />
            }
          >
            <UserAvatar user={user} />
            <span className="grid min-w-0 flex-1 text-left leading-4 group-data-[collapsible=icon]:hidden">
              <span className="truncate text-[13px] font-medium text-[var(--ks-ink)]">
                {displayName}
              </span>
              <span className="truncate text-[12px] text-[var(--ks-label)]">
                {identity}
              </span>
            </span>
            <ChevronsUpDown className="ml-auto !size-3.5 group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--anchor-width) min-w-60"
            side={isMobile ? 'top' : 'right'}
            align="end"
            sideOffset={6}
          >
            <div className="flex items-center gap-2.5 px-2 py-2">
              <UserAvatar user={user} className="size-8 text-[12px]" />
              <span className="grid min-w-0 leading-4">
                <span className="truncate text-[13px] font-medium text-[var(--ks-ink)]">
                  {displayName}
                </span>
                <span className="truncate text-[12px] text-[var(--ks-label)]">
                  {identity}
                </span>
              </span>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2.5"
              render={
                <Link
                  to="/dashboard/$listKey/$id"
                  params={{ listKey: user.listPath, id: user.id }}
                  onClick={() => setOpenMobile(false)}
                />
              }
            >
              <CircleUser className="text-[var(--ks-label)]" />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2.5"
              onClick={() => window.open('/api/graphql', '_blank')}
            >
              <Database className="text-[var(--ks-label)]" />
              GraphQL API
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between gap-3 px-2 py-1.5">
              <span className="text-[13px] text-[var(--ks-ink-2)]">Theme</span>
              <ThemeSwitcher />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2.5"
              onClick={() => void signOutDashboard(queryClient)}
            >
              <LogOut className="text-[var(--ks-label)]" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
