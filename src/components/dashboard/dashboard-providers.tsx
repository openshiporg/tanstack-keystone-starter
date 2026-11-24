import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { SidebarProvider } from '@/components/ui/sidebar'
import { ThemeProvider } from '@/components/ui/theme-provider'
import { ToasterProvider } from '@/components/ui/toaster'
import type { DashboardAuthUser } from '@/features/cms/graphql-client'
import { dashboardQueryKeys } from '@/features/cms/graphql-client'

import { AiConfigProvider, useAiConfig } from './ai-config'
import { ChatModeProvider } from './chat-mode'
import { DashboardProvider } from './dashboard-provider'

function DashboardProvidersContent({
  children,
  user,
}: {
  children: React.ReactNode
  user: DashboardAuthUser | null
}) {
  const queryClient = useQueryClient()
  const { config } = useAiConfig()

  const invalidateDashboardQueries = useCallback(async () => {
    await queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === dashboardQueryKeys.adminMeta[0],
    })
  }, [queryClient])

  return (
    <ChatModeProvider
      user={user}
      completionEndpoint={config.completionEndpoint}
      onCrudComplete={invalidateDashboardQueries}
    >
      <SidebarProvider defaultOpen defaultOpenRight={false}>
        {children}
      </SidebarProvider>
    </ChatModeProvider>
  )
}

export function DashboardProviders({
  children,
  user,
}: {
  children: React.ReactNode
  user: DashboardAuthUser | null
}) {
  return (
    <DashboardProvider>
      <AiConfigProvider>
        <ThemeProvider>
          <ToasterProvider>
            <DashboardProvidersContent user={user}>
              {children}
            </DashboardProvidersContent>
          </ToasterProvider>
        </ThemeProvider>
      </AiConfigProvider>
    </DashboardProvider>
  )
}
