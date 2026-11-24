// Chat thread, composer and primitives ported from TUFFUI ai-chat, chat-thread, agent-composer,
// action-button and loader (https://tuffui.com)
// MIT License · Copyright (c) 2026 TUFFUI contributors
// Markup and metrics follow the originals; Phosphor → lucide, motion → CSS, colours → --ks-* tokens.
import {
  CircleAlert,
  LoaderCircle,
  MessageSquare,
  Power,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

import { useAiConfig } from './ai-config'
import { useChatMode } from './chat-mode'
import { UserAvatar } from './user-profile'

const AGENT_NAME = 'Assistant'

/** TUFFUI IconButton, quiet variant, size sm. */
function IconButton({
  icon: Icon,
  label,
  className,
  ...props
}: Omit<React.ComponentProps<'button'>, 'children'> & {
  icon: LucideIcon
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--ks-dim)] transition-[background-color,color,scale,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] select-none hover:bg-foreground/[0.06] hover:text-[var(--ks-ink)] focus-visible:ring-2 focus-visible:ring-[var(--ks-focus)] focus-visible:outline-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 aria-pressed:text-[var(--ks-accent-ink)]',
        className,
      )}
      {...props}
    >
      <Icon strokeWidth={2.5} className="size-3.5" aria-hidden="true" />
    </button>
  )
}

/** TUFFUI Thinking, size md: three dots in a wave. */
function Thinking({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-2 text-[var(--ks-dim)]',
        className,
      )}
    >
      <span aria-hidden="true" className="flex items-center gap-1">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-[ks-think_1s_ease-in-out_infinite] rounded-full bg-current opacity-30 motion-reduce:animate-none motion-reduce:opacity-60"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
      <span className="sr-only">Thinking</span>
    </span>
  )
}

/** The assistant's mark: TUFFUI chat-thread assistant avatar (tinted circle, filled sparkle). */
function AgentMark() {
  return (
    <span
      aria-hidden="true"
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--ks-accent)_15%,transparent)] text-[var(--ks-accent-ink)]"
    >
      <Sparkles fill="currentColor" strokeWidth={1.5} className="size-3.5" />
    </span>
  )
}

/** One turn, TUFFUI chat-thread article markup (default density). */
function Turn({
  role,
  name,
  avatar,
  first,
  children,
}: {
  role: 'user' | 'assistant'
  name: string
  avatar: React.ReactNode
  first: boolean
  children: React.ReactNode
}) {
  const user = role === 'user'
  return (
    <article
      aria-label={name}
      className={cn(
        'group flex gap-2.5',
        user && 'flex-row-reverse',
        !first && 'mt-4',
      )}
    >
      {avatar}
      <div
        className={cn(
          'flex min-w-0 flex-col gap-1',
          user ? 'max-w-[80%] items-end' : 'max-w-[92%] flex-1 items-stretch',
        )}
      >
        <p
          className={cn(
            'flex items-baseline gap-2 text-[0.8125rem]',
            user && 'flex-row-reverse',
          )}
        >
          <span className="font-medium text-[var(--ks-ink)]">{name}</span>
        </p>
        <div
          className={cn(
            'max-w-full text-sm leading-relaxed break-words whitespace-pre-wrap text-[var(--ks-ink)]',
            user && 'ks-raised rounded-2xl rounded-se-md px-3.5 py-2',
          )}
        >
          {children}
        </div>
      </div>
    </article>
  )
}

export function AiChatSidebar() {
  const { toggleSidebarWithSide } = useSidebar()
  const [input, setInput] = useState('')
  const pendingReviewRef = useRef<HTMLDivElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    if (pendingAction) pendingReviewRef.current?.focus()
  }, [pendingAction])

  // Composer grows with its content, up to 180px
  useLayoutEffect(() => {
    const element = textarea.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 180)}px`
  }, [input])

  // Keep the newest turn in view
  useEffect(() => {
    const element = scroller.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages.length, sending, pendingAction, error])

  async function submit() {
    const text = input.trim()
    if (!text || sending || !config.enabled) return
    setInput('')
    await sendMessage(text)
  }

  function closeAssistant() {
    toggleSidebarWithSide('right')
    requestAnimationFrame(() => {
      const trigger =
        document.querySelector<HTMLElement>('[data-assistant-header]') ??
        document.getElementById('dashboard-ai-assistant-trigger')
      trigger?.focus()
    })
  }

  const userName = user?.name || user?.label || user?.email || 'You'
  const userAvatar = (
    <UserAvatar
      user={{ name: user?.name ?? user?.label, email: user?.email }}
    />
  )
  const empty = messages.length === 0

  return (
    <div
      className="@container flex h-full flex-col bg-[var(--ks-page)] text-[var(--ks-ink)]"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        event.stopPropagation()
        closeAssistant()
      }}
    >
      <header className="flex h-14 shrink-0 items-center gap-2 px-3 pt-2 @md:px-5">
        <AgentMark />
        <h2 className="min-w-0 truncate text-[0.9375rem] font-medium">
          {AGENT_NAME}
        </h2>
        <div className="ms-auto flex items-center gap-1.5">
          <IconButton
            icon={Power}
            label={config.enabled ? 'Turn assistant off' : 'Turn assistant on'}
            aria-pressed={config.enabled}
            onClick={() =>
              setConfig((previous) => ({ enabled: !previous.enabled }))
            }
          />
          <IconButton
            icon={X}
            label="Close AI assistant"
            onClick={closeAssistant}
          />
        </div>
      </header>

      <div
        ref={scroller}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
        aria-busy={sending || undefined}
      >
        <div
          className={cn(
            'flex min-h-full flex-col gap-1.5 px-4 py-5 @md:px-5',
            empty && 'justify-center',
          )}
          role="log"
          aria-label="Assistant conversation"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {empty ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <div
                aria-hidden="true"
                className="mb-4 flex size-12 shrink-0 items-center justify-center rounded-2xl bg-foreground/[0.06] text-[var(--ks-dim)]"
              >
                <MessageSquare
                  fill="currentColor"
                  strokeWidth={1.5}
                  className="size-5"
                />
              </div>
              <p className="text-[0.9375rem] font-medium">
                {config.enabled ? 'No messages' : 'Assistant is off'}
              </p>
            </div>
          ) : (
            messages.map((message, index) =>
              message.role === 'user' ? (
                <Turn
                  key={message.id}
                  role="user"
                  name={userName}
                  avatar={userAvatar}
                  first={index === 0}
                >
                  <p dir="auto">{message.text}</p>
                </Turn>
              ) : (
                <Turn
                  key={message.id}
                  role="assistant"
                  name={AGENT_NAME}
                  avatar={<AgentMark />}
                  first={index === 0}
                >
                  <p dir="auto" className="leading-6 text-pretty">
                    {message.text}
                  </p>
                </Turn>
              ),
            )
          )}

          {pendingAction ? (
            <div
              ref={pendingReviewRef}
              role="alertdialog"
              aria-labelledby="assistant-action-title"
              aria-describedby="assistant-action-summary"
              tabIndex={-1}
              className="mt-3 flex flex-col gap-2 rounded-2xl bg-[color-mix(in_oklab,var(--ks-amber)_10%,transparent)] p-3.5 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--ks-amber)_28%,transparent)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ks-focus)]"
            >
              <h4
                id="assistant-action-title"
                className="flex items-center gap-2 text-[0.8125rem] font-medium text-[var(--ks-ink)]"
              >
                <span className="ks-dot" data-tone="amber" aria-hidden="true" />
                Confirm data change
              </h4>
              <p
                id="assistant-action-summary"
                className="text-[0.8125rem] leading-5 break-words text-[var(--ks-ink-2)]"
              >
                {pendingAction.summary}
              </p>
              <p className="text-[12px] text-[var(--ks-dim)]">
                Nothing changes until you confirm this exact action.
              </p>
              <div className="flex justify-end">
                <div className="ks-track">
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
            </div>
          ) : null}

          {sending ? (
            <Turn
              role="assistant"
              name={AGENT_NAME}
              avatar={<AgentMark />}
              first={false}
            >
              <Thinking className="h-6" />
            </Turn>
          ) : null}

          {error ? (
            <div
              role="alert"
              aria-live="assertive"
              className="mt-3 flex items-start gap-2.5 rounded-2xl bg-[color-mix(in_oklab,var(--ks-red)_10%,transparent)] py-2 ps-3.5 pe-2"
            >
              <CircleAlert
                className="mt-0.5 size-4 shrink-0 text-[var(--ks-red)]"
                aria-hidden="true"
              />
              <p className="min-w-0 flex-1 text-[0.8125rem] font-medium break-words text-[var(--ks-danger)]">
                {error}
              </p>
              <IconButton
                icon={X}
                label="Dismiss"
                className="size-6"
                onClick={clearError}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="relative z-10 shrink-0 px-3 pt-1 pb-3 before:pointer-events-none before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-gradient-to-t before:from-[var(--ks-page)] before:to-transparent @md:px-5 @md:pb-5">
        <div className="relative rounded-[1.375rem] bg-[var(--ks-track)] p-1.5 shadow-[var(--ks-recess)]">
          <div className="relative rounded-2xl bg-[var(--ks-surface)] shadow-[var(--ks-raised-shadow)]">
            <textarea
              ref={textarea}
              id="assistant-input"
              aria-label="Assistant prompt"
              dir="auto"
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault()
                  void submit()
                }
              }}
              placeholder={
                !config.enabled
                  ? 'Assistant is off'
                  : empty
                    ? 'Ask anything'
                    : 'Reply'
              }
              disabled={!config.enabled || sending}
              className="block max-h-[180px] min-h-16 w-full resize-none bg-transparent px-4 pt-3 pb-1 text-sm leading-6 text-[var(--ks-ink)] outline-none placeholder:text-[var(--ks-label)] disabled:opacity-60"
            />
            <div className="flex items-center gap-2 ps-4 pe-2 pb-2">
              <p className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-xs text-[var(--ks-dim)]">
                {sending ? (
                  <>
                    <LoaderCircle
                      strokeWidth={2.5}
                      aria-hidden="true"
                      className="size-3.5 shrink-0 animate-spin text-[var(--ks-accent-ink)] [animation-duration:700ms] motion-reduce:animate-none"
                    />
                    Working
                  </>
                ) : null}
              </p>
              <button
                type="button"
                data-variant="primary"
                aria-label="Send message"
                onClick={() => void submit()}
                disabled={!config.enabled || sending || !input.trim()}
                className="ks-pill h-8 gap-2 rounded-full px-3.5 text-[0.8125rem] focus-visible:ring-2 focus-visible:ring-[var(--ks-focus)] focus-visible:outline-none"
              >
                Send
                <kbd
                  aria-hidden="true"
                  className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-current/15 px-1 font-sans text-[12px] font-medium opacity-80"
                >
                  ↵
                </kbd>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
