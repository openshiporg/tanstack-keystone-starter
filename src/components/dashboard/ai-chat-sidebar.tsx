import { PanelRightClose, SendHorizontal, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

import { useAiConfig } from './ai-config'
import { useChatMode } from './chat-mode'
import type { ChatMessage } from './chat-mode'

function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-base',
        isUser && 'justify-end',
      )}
    >
      <div
        className={cn(
          'max-w-[calc(100%-2rem)] overflow-hidden break-words',
          isUser
            ? 'rounded-md bg-black px-4 py-2 text-white dark:bg-white dark:text-black'
            : 'space-y-1 text-muted-foreground',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
      </div>
    </div>
  )
}

export function AiChatSidebar() {
  const { toggleSidebarWithSide } = useSidebar()
  const [input, setInput] = useState('')
  const pendingReviewRef = useRef<HTMLDivElement>(null)
  const { config, setConfig } = useAiConfig()
  const {
    user,
    messages,
    sendMessage,
    sending,
    error,
    pendingAction,
    confirmPendingAction,
    cancelPendingAction,
    clearError,
  } = useChatMode()
  const userName = user?.name

  useEffect(() => {
    if (pendingAction) pendingReviewRef.current?.focus()
  }, [pendingAction])

  async function submit() {
    const text = input.trim()
    if (!text || sending || !config.enabled) return
    setInput('')
    await sendMessage(text)
  }

  function closeAssistant() {
    toggleSidebarWithSide('right')
    requestAnimationFrame(() => {
      document.getElementById('dashboard-ai-assistant-trigger')?.focus()
    })
  }

  return (
    <div
      className="flex h-full flex-col bg-background text-foreground"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        event.stopPropagation()
        closeAssistant()
      }}
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
        <div>
          <h2 className="font-medium text-muted-foreground">AI Assistant</h2>
          <p className="text-xs text-muted-foreground/80">Mode: Server</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            aria-pressed={config.enabled}
            onClick={() =>
              setConfig((previous) => ({ enabled: !previous.enabled }))
            }
          >
            {config.enabled ? 'Disable' : 'Enable'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close AI assistant"
            onClick={closeAssistant}
            className="h-8 w-8"
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="relative flex-1 overflow-auto px-3 pt-3">
        <div
          className="space-y-3"
          role="log"
          aria-label="Assistant conversation"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {messages.length === 0 ? (
            <div className="flex h-full min-h-[18rem] flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              <Sparkles className="mb-3 h-8 w-8" />
              <p className="font-medium text-foreground">
                How can I help{userName ? `, ${userName}` : ''}?
              </p>
              <p className="mt-1">
                Ask about records, filters, content, or dashboard workflows.
              </p>
              {!config.enabled ? (
                <p className="mt-3 text-xs">
                  Enable the assistant below to start a real backend-backed
                  chat.
                </p>
              ) : null}
            </div>
          ) : (
            messages.map((message) => (
              <ChatMessageBubble key={message.id} message={message} />
            ))
          )}
          {pendingAction ? (
            <div
              ref={pendingReviewRef}
              role="alertdialog"
              aria-labelledby="assistant-action-title"
              aria-describedby="assistant-action-summary"
              tabIndex={-1}
              className="space-y-3 rounded-md border border-amber-500/50 bg-amber-500/5 p-3"
            >
              <h4 id="assistant-action-title" className="text-sm font-medium">
                Confirm data change
              </h4>
              <p
                id="assistant-action-summary"
                className="break-words text-xs text-muted-foreground"
              >
                {pendingAction.summary}
              </p>
              <p className="text-xs text-muted-foreground">
                Nothing changes until you confirm this exact action.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={cancelPendingAction}
                  disabled={sending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void confirmPendingAction()}
                  disabled={sending}
                >
                  Confirm
                </Button>
              </div>
            </div>
          ) : null}
          {sending ? (
            <div
              className="text-sm text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              Thinking...
            </div>
          ) : null}
          {error ? (
            <div
              className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
              role="alert"
              aria-live="assertive"
            >
              <div className="flex items-start justify-between gap-3">
                <span>{error}</span>
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={clearError}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-3 mb-3 space-y-3 rounded-lg border border-transparent bg-background p-3 shadow ring-1 ring-foreground/10">
        <textarea
          aria-label="Assistant prompt"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void submit()
            }
          }}
          placeholder={
            config.enabled ? 'Ask me anything...' : 'Assistant is disabled'
          }
          className="min-h-10 w-full resize-none border-0 bg-transparent text-base break-words placeholder:text-muted-foreground focus:outline-none"
          rows={1}
          disabled={!config.enabled || sending}
        />
        <div className="flex justify-end">
          <Button
            size="icon"
            aria-label="Send message"
            onClick={() => void submit()}
            disabled={!config.enabled || !input.trim() || sending}
            className="h-8 w-8"
          >
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
