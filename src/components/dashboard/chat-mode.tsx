import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

import type { DashboardAssistantAction } from '@/features/cms/dashboard-completion'
import type { DashboardAuthUser } from '@/features/cms/graphql-client'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

type ChatModeContextValue = {
  user: DashboardAuthUser | null
  messages: ChatMessage[]
  sending: boolean
  error: string | null
  pendingAction: DashboardAssistantAction | null
  sendMessage: (text: string) => Promise<void>
  confirmPendingAction: () => Promise<void>
  cancelPendingAction: () => void
  clearError: () => void
}

const ChatModeContext = createContext<ChatModeContextValue | null>(null)

export function ChatModeProvider({
  children,
  user,
  completionEndpoint,
  onCrudComplete,
}: {
  children: React.ReactNode
  user: DashboardAuthUser | null
  completionEndpoint: string
  onCrudComplete?: () => Promise<void> | void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] =
    useState<DashboardAssistantAction | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || sending) return

      const userMessage: ChatMessage = {
        id: `${Date.now()}-user`,
        role: 'user',
        text: trimmed,
      }

      setMessages((previous) => [...previous, userMessage])
      setSending(true)
      setError(null)
      setPendingAction(null)

      try {
        const response = await fetch(completionEndpoint, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: trimmed,
            messages: [...messages, userMessage].map((message) => ({
              role: message.role,
              content: message.text,
            })),
          }),
        })

        const payload = (await response.json().catch(() => null)) as {
          data?: {
            message?: string
            invalidateDashboardQueries?: boolean
            pendingAction?: DashboardAssistantAction
          }
          error?: string
        } | null

        if (!response.ok) {
          throw new Error(
            payload?.error ||
              `Completion request failed with ${response.status}`,
          )
        }

        const assistantText =
          payload?.data?.message?.trim() || 'No response received.'
        setMessages((previous) => [
          ...previous,
          {
            id: `${Date.now()}-assistant`,
            role: 'assistant',
            text: assistantText,
          },
        ])
        setPendingAction(payload?.data?.pendingAction ?? null)

        if (payload?.data?.invalidateDashboardQueries) await onCrudComplete?.()
      } catch (submitError) {
        const message =
          submitError instanceof Error
            ? submitError.message
            : 'Unable to reach the AI assistant.'
        setError(message)
        setMessages((previous) =>
          previous
            .filter(
              (entry) => entry.id !== userMessage.id || entry.role !== 'user',
            )
            .concat(userMessage),
        )
      } finally {
        setSending(false)
      }
    },
    [completionEndpoint, messages, onCrudComplete, sending],
  )

  const confirmPendingAction = useCallback(async () => {
    if (!pendingAction || sending) return
    setSending(true)
    setError(null)
    try {
      const response = await fetch(completionEndpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: pendingAction, confirmed: true }),
      })
      const payload = (await response.json().catch(() => null)) as {
        data?: { message?: string; invalidateDashboardQueries?: boolean }
        error?: string
      } | null
      if (!response.ok)
        throw new Error(
          payload?.error || `Confirmed action failed with ${response.status}`,
        )
      setMessages((previous) => [
        ...previous,
        {
          id: `${Date.now()}-assistant-confirmed`,
          role: 'assistant',
          text: payload?.data?.message?.trim() || 'Action completed.',
        },
      ])
      setPendingAction(null)
      if (payload?.data?.invalidateDashboardQueries) await onCrudComplete?.()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to execute the confirmed action.',
      )
    } finally {
      setSending(false)
    }
  }, [completionEndpoint, onCrudComplete, pendingAction, sending])

  const cancelPendingAction = useCallback(() => {
    setPendingAction(null)
    setMessages((previous) => [
      ...previous,
      {
        id: `${Date.now()}-assistant-cancelled`,
        role: 'assistant',
        text: 'Action cancelled. No data was changed.',
      },
    ])
  }, [])

  const value = useMemo<ChatModeContextValue>(
    () => ({
      user,
      messages,
      sending,
      error,
      pendingAction,
      sendMessage,
      confirmPendingAction,
      cancelPendingAction,
      clearError,
    }),
    [
      user,
      messages,
      sending,
      error,
      pendingAction,
      sendMessage,
      confirmPendingAction,
      cancelPendingAction,
      clearError,
    ],
  )

  return (
    <ChatModeContext.Provider value={value}>
      {children}
    </ChatModeContext.Provider>
  )
}

export function useChatMode() {
  const context = useContext(ChatModeContext)
  if (!context)
    throw new Error('useChatMode must be used within ChatModeProvider')
  return context
}
