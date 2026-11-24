import type { ComponentProps } from 'react'

import { Sidebar, SidebarContent, useSidebar } from '@/components/ui/sidebar'

import { AiChatSidebar } from './ai-chat-sidebar'

export function RightSidebar(props: ComponentProps<typeof Sidebar>) {
  const { isMobile, rightOpen, rightOpenMobile } = useSidebar()
  const visible = isMobile ? rightOpenMobile : rightOpen

  return (
    <Sidebar {...props}>
      <SidebarContent
        id="dashboard-ai-assistant"
        role="complementary"
        aria-label="AI assistant"
        aria-hidden={visible ? undefined : true}
        inert={visible ? undefined : true}
      >
        <AiChatSidebar />
      </SidebarContent>
    </Sidebar>
  )
}
