import { ChevronRight, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'
import type {
  DashboardAuthUser,
  DashboardListSummary,
} from '@/features/cms/graphql-client'
import { cn } from '@/lib/utils'

import { DashboardProviders } from './dashboard-providers'
import { DashboardSidebar } from './dashboard-sidebar'
import { RightSidebar } from './right-sidebar'

function FloatingChatButton() {
  const { rightOpen, rightOpenMobile, isMobile, toggleSidebarWithSide } =
    useSidebar()
  const visible = isMobile ? rightOpenMobile : rightOpen
  const Icon = visible ? ChevronRight : Sparkles

  return (
    <Button
      id="dashboard-ai-assistant-trigger"
      type="button"
      size="icon"
      aria-label={visible ? 'Close AI assistant' : 'Open AI assistant'}
      aria-controls="dashboard-ai-assistant"
      aria-expanded={visible}
      onClick={() => toggleSidebarWithSide('right')}
      className={cn(
        'fixed right-3 bottom-3 z-40 h-12 w-12 rounded-full shadow-lg transition-all duration-300 hover:shadow-xl',
        visible &&
          !isMobile &&
          'right-[calc(30rem+1rem)] bg-background hover:bg-accent',
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
  return (
    <DashboardProviders user={user}>
      <a
        href="#dashboard-main-content"
        className="fixed top-2 left-2 z-[100] -translate-y-20 rounded-md bg-background px-3 py-2 text-sm font-medium shadow-lg ring-2 ring-ring transition-transform focus:translate-y-0"
      >
        Skip to dashboard content
      </a>
      <DashboardSidebar
        lists={lists.filter((list) => !list.hideNavigation)}
        user={user}
      />
      <div
        id="dashboard-main-content"
        className="relative flex w-full min-w-0 flex-1 flex-col bg-background"
        tabIndex={-1}
      >
        {children}
      </div>
      <FloatingChatButton />
      <RightSidebar side="right" />
    </DashboardProviders>
  )
}
