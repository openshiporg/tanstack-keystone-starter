import { AlertCircle, Info } from 'lucide-react'

import { cn } from '@/lib/utils'

export function MutationErrorNotice({
  error,
  variant = 'destructive',
}: {
  error: { message: string; details: string | null }
  variant?: 'destructive' | 'neutral'
}) {
  const destructive = variant === 'destructive'
  const Icon = destructive ? AlertCircle : Info

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px]',
        destructive
          ? 'bg-[color-mix(in_oklab,var(--ks-red)_10%,transparent)] text-[var(--ks-danger)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--ks-red)_25%,transparent)]'
          : 'bg-[var(--ks-track)] text-[var(--ks-ink-2)] shadow-[inset_0_0_0_1px_var(--ks-line)]',
      )}
      role={destructive ? 'alert' : 'status'}
      aria-live={destructive ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="break-words whitespace-pre-line">{error.message}</p>
        {error.details ? (
          <details className="mt-1.5">
            <summary className="cursor-pointer text-[12px] font-medium">
              Error details
            </summary>
            <pre className="mt-1.5 overflow-auto rounded-[7px] bg-[var(--ks-surface)] p-2 font-mono text-[12px] whitespace-pre-wrap text-[var(--ks-ink-2)] shadow-[inset_0_0_0_1px_var(--ks-line)]">
              {error.details}
            </pre>
          </details>
        ) : null}
      </div>
    </div>
  )
}
