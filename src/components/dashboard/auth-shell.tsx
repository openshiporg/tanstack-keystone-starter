import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { LogoIcon } from './logo'

/**
 * AuthShell: the one frame for sign-in, sign-up, reset, first-run and no-access.
 * A single calm card on the page tone, the product mark above it and an optional foot link below.
 */
export function AuthShell({
  title,
  description,
  children,
  foot,
  className,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  foot?: ReactNode
  className?: string
}) {
  return (
    <main className="flex min-h-svh w-full flex-col items-center justify-center bg-[var(--ks-page)] px-4 py-10">
      <div className={cn('w-full max-w-[360px]', className)}>
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="ks-raised grid size-8 place-items-center rounded-[9px]">
            <LogoIcon className="size-4" suffix="-auth" />
          </span>
          <span className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--ks-ink)]">
            Keystone
          </span>
        </div>
        <div className="ks-card px-5 pt-5 pb-5 sm:px-6 sm:pb-6">
          <h1 className="text-[16px] leading-6 font-semibold tracking-[-0.01em] text-[var(--ks-ink)]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-[13px] leading-5 text-[var(--ks-dim)]">
              {description}
            </p>
          ) : null}
          <div className="mt-5">{children}</div>
        </div>
        {foot ? (
          <div className="mt-4 text-center text-[12px] text-[var(--ks-dim)]">
            {foot}
          </div>
        ) : null}
      </div>
    </main>
  )
}

/** Label + control stack used by every auth form. */
export function AuthField({
  id,
  label,
  aside,
  children,
}: {
  id: string
  label: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="text-[12px] font-medium text-[var(--ks-ink-2)]"
        >
          {label}
        </label>
        {aside}
      </div>
      {children}
    </div>
  )
}

/** Inline form message: danger for failures, green for sent links, neutral for notices. */
export function AuthMessage({
  tone = 'danger',
  className,
  children,
}: {
  tone?: 'danger' | 'success' | 'neutral'
  className?: string
  children: ReactNode
}) {
  const color =
    tone === 'danger'
      ? 'var(--ks-red)'
      : tone === 'success'
        ? 'var(--ks-green)'
        : 'var(--ks-gray)'
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      aria-live={tone === 'danger' ? 'assertive' : 'polite'}
      className={cn(
        'mt-4 rounded-[10px] px-3 py-2.5 text-[13px] leading-5 break-words',
        className,
      )}
      style={{
        color:
          tone === 'danger'
            ? 'var(--ks-danger)'
            : tone === 'success'
              ? color
              : 'var(--ks-ink-2)',
        background: `color-mix(in oklab, ${color} 9%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 26%, transparent)`,
      }}
    >
      {children}
    </div>
  )
}

/** Password field with an inline show/hide toggle. */
export function PasswordInput(
  props: Omit<React.ComponentProps<typeof Input>, 'type'>,
) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        {...props}
        type={show ? 'text' : 'password'}
        className={cn('h-9 pr-9', props.className)}
      />
      <button
        type="button"
        onClick={() => setShow((previous) => !previous)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 grid w-9 place-items-center rounded-r-[8px] text-[var(--ks-label)] hover:text-[var(--ks-ink)] focus-visible:text-[var(--ks-ink)] focus-visible:outline-none"
      >
        {show ? (
          <EyeOff className="size-3.5" aria-hidden="true" />
        ) : (
          <Eye className="size-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}

/** Full-width primary submit in a track; shows the pending label while the form action runs. */
export function AuthSubmit({
  children,
  pendingLabel,
  pending: pendingOverride,
}: {
  children: ReactNode
  pendingLabel: string
  pending?: boolean
}) {
  const status = useFormStatus()
  const pending = pendingOverride ?? status.pending
  return (
    <div className="ks-track mt-1 flex w-full">
      <Button type="submit" className="h-9 w-full text-[13px]" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {pending ? pendingLabel : children}
      </Button>
    </div>
  )
}

export const authLinkClass =
  'font-medium text-[var(--ks-accent-ink)] underline-offset-4 hover:underline'

export function AuthNotConfigured() {
  return (
    <AuthShell title="Sign-in unavailable">
      <AuthMessage tone="neutral" className="mt-0">
        Dashboard authentication is not configured.
      </AuthMessage>
    </AuthShell>
  )
}
