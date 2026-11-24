import type { ErrorInfo, ReactNode } from 'react'
import { Component } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'An unexpected error occurred in the dashboard.'
}

function errorStack(error: unknown) {
  return error instanceof Error ? error.stack : undefined
}

function DashboardErrorFallback({
  error,
  reset,
}: {
  error: unknown
  reset?: () => void
}) {
  const message = errorMessage(error)
  const accessWasDenied = message.includes('Access denied:')
  return (
    <main
      id="dashboard-main-content"
      aria-labelledby="dashboard-error-title"
      className="flex min-h-svh items-center justify-center bg-[var(--ks-page)] px-4 py-10"
      tabIndex={-1}
    >
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="ks-card w-full max-w-[440px] px-5 py-5 sm:px-6"
      >
        <div className="flex items-center gap-2.5">
          <span className="ks-dot" data-tone="red" aria-hidden="true" />
          <h1
            id="dashboard-error-title"
            className="text-[16px] leading-6 font-semibold tracking-[-0.01em] text-[var(--ks-ink)]"
          >
            {accessWasDenied
              ? 'Your session has expired'
              : 'Something went wrong'}
          </h1>
        </div>
        <p className="mt-1 text-[13px] leading-5 text-[var(--ks-dim)]">
          {accessWasDenied
            ? 'Sign in again to continue using the dashboard.'
            : 'An unexpected error occurred in the dashboard. Please try again or refresh the page.'}
        </p>
        <div className="mt-4 flex items-start gap-2.5 rounded-[10px] bg-[color-mix(in_oklab,var(--ks-red)_10%,transparent)] px-3 py-2.5 text-[13px] break-words text-[var(--ks-danger)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--ks-red)_25%,transparent)]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0">{message}</span>
        </div>
        <div className="mt-4 flex">
          <div className="ks-track">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => globalThis.location.reload()}
            >
              Refresh page
            </Button>
            {accessWasDenied ? (
              <Button
                type="button"
                size="sm"
                onClick={() => globalThis.location.assign('/dashboard/signin')}
              >
                Sign in again
              </Button>
            ) : null}
            {reset && !accessWasDenied ? (
              <Button type="button" size="sm" onClick={reset}>
                <RotateCcw aria-hidden="true" />
                Try again
              </Button>
            ) : null}
          </div>
        </div>
        {import.meta.env.DEV && errorStack(error) ? (
          <details className="mt-4 rounded-[10px] bg-[var(--ks-track)] p-3 text-[12px] shadow-[inset_0_0_0_1px_var(--ks-line)]">
            <summary className="cursor-pointer font-medium text-[var(--ks-ink-2)]">
              Error details
            </summary>
            <pre className="mt-2 max-h-72 overflow-auto font-mono whitespace-pre-wrap text-[var(--ks-dim)]">
              {errorStack(error)}
            </pre>
          </details>
        ) : null}
      </div>
    </main>
  )
}

type DashboardErrorBoundaryProps = {
  children: ReactNode
}

type DashboardErrorBoundaryState = {
  hasError: boolean
  error?: Error
}

export class DashboardErrorBoundary extends Component<
  DashboardErrorBoundaryProps,
  DashboardErrorBoundaryState
> {
  state: DashboardErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(error: Error): DashboardErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('DashboardErrorBoundary caught an error:', error, errorInfo)
  }

  private reset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  override render() {
    if (this.state.hasError) {
      return (
        <DashboardErrorFallback error={this.state.error} reset={this.reset} />
      )
    }

    return this.props.children
  }
}

export { DashboardErrorFallback }
