'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

type Toast = {
  id: string
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

type ToasterContextValue = {
  toast: (args: {
    title: string
    description?: string
    actionLabel?: string
    onAction?: () => void
  }) => void
}

const ToasterContext = createContext<ToasterContextValue | null>(null)

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback(
    ({
      title,
      description,
      actionLabel,
      onAction,
    }: {
      title: string
      description?: string
      actionLabel?: string
      onAction?: () => void
    }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setToasts((current) => [
        ...current,
        { id, title, description, actionLabel, onAction },
      ])
      window.setTimeout(() => {
        setToasts((current) => current.filter((entry) => entry.id !== id))
      }, 3500)
    },
    [],
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToasterContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4"
        aria-label="Notifications"
      >
        {toasts.map((entry) => (
          <div
            key={entry.id}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={cn(
              'pointer-events-auto w-full max-w-sm rounded-lg border bg-background p-4 shadow-lg',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold">{entry.title}</p>
                {entry.description ? (
                  <p className="text-sm text-muted-foreground">
                    {entry.description}
                  </p>
                ) : null}
                {entry.actionLabel && entry.onAction ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-primary hover:underline"
                    onClick={() => {
                      entry.onAction?.()
                      setToasts((current) =>
                        current.filter(
                          (toastEntry) => toastEntry.id !== entry.id,
                        ),
                      )
                    }}
                  >
                    {entry.actionLabel}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                aria-label={`Dismiss ${entry.title} notification`}
                className="text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setToasts((current) =>
                    current.filter((toastEntry) => toastEntry.id !== entry.id),
                  )
                }
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToasterContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToasterContext)
  if (!context) throw new Error('useToast must be used within ToasterProvider')
  return context
}
