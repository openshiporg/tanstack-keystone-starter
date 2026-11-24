import { ChevronRight, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SidebarInset, useSidebar } from '@/components/ui/sidebar'
import type {
  DashboardAuthUser,
  DashboardListSummary,
} from '@/features/cms/graphql-client'
import { cn } from '@/lib/utils'

import { CommandPaletteProvider } from './command-palette'
import { DashboardProviders } from './dashboard-providers'
import { DashboardSidebar } from './dashboard-sidebar'
import { RightSidebar } from './right-sidebar'

function FloatingChatButton() {
  const { rightOpen, rightOpenMobile, isMobile, toggleSidebarWithSide } =
    useSidebar()
  const visible = isMobile ? rightOpenMobile : rightOpen
  const showChevron = visible && !isMobile
  const Icon = showChevron ? ChevronRight : Sparkles

  return (
    <Button
      id="dashboard-ai-assistant-trigger"
      type="button"
      size="icon"
      aria-label={showChevron ? 'Close AI assistant' : 'Open AI assistant'}
      aria-controls="dashboard-ai-assistant"
      aria-expanded={visible}
      data-assistant-floating=""
      onClick={() => toggleSidebarWithSide('right')}
      className={cn(
        // Hidden whenever the page top bar carries the assistant button, so it never covers rows or fields.
        'fixed bottom-3 z-40 size-11 rounded-full [body:has([data-assistant-header])_&]:hidden',
        showChevron ? 'right-[calc(30rem+1rem)]' : 'right-3',
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </Button>
  )
}

export function DashboardLayout({
  children,
  user,
  lists,
}: {
  children: React.ReactNode
  user: DashboardAuthUser | null
  lists: DashboardListSummary[]
}) {
  const navLists = lists.filter((list) => !list.hideNavigation)
  return (
    <DashboardProviders user={user}>
      <a
        href="#dashboard-main-content"
        className="fixed top-2 left-2 z-[100] -translate-y-20 ks-pop px-3 py-2 text-[13px] font-medium transition-transform focus:translate-y-0"
      >
        Skip to dashboard content
      </a>
      <CommandPaletteProvider lists={navLists}>
        <DashboardSidebar lists={navLists} user={user} />
        <SidebarInset
          id="dashboard-main-content"
          className="min-w-0"
          tabIndex={-1}
        >
          {children}
        </SidebarInset>
      </CommandPaletteProvider>
      <FloatingChatButton />
      <RightSidebar side="right" />
    </DashboardProviders>
  )
}
