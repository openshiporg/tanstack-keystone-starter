import type { ErrorInfo, ReactNode } from 'react'
import { Component } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'

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
      className="flex min-h-screen items-center justify-center bg-muted/20 p-4"
      tabIndex={-1}
    >
      <Card
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="w-full max-w-lg border-destructive/30 shadow-lg"
      >
        <CardHeader className="space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1
              id="dashboard-error-title"
              className="text-base leading-snug font-medium"
            >
              {accessWasDenied
                ? 'Your session has expired'
                : 'Something went wrong'}
            </h1>
            <CardDescription className="mt-2">
              {accessWasDenied
                ? 'Sign in again to continue using the dashboard.'
                : 'An unexpected error occurred in the dashboard. Please try again or refresh the page.'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {message}
          </div>
          <div className="flex flex-wrap gap-2">
            {accessWasDenied ? (
              <Button
                type="button"
                onClick={() => globalThis.location.assign('/dashboard/signin')}
              >
                Sign in again
              </Button>
            ) : null}
            {reset && !accessWasDenied ? (
              <Button type="button" onClick={reset}>
                <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                Try again
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => globalThis.location.reload()}
            >
              Refresh page
            </Button>
          </div>
          {import.meta.env.DEV && errorStack(error) ? (
            <details className="rounded-md border bg-muted/40 p-3 text-xs">
              <summary className="cursor-pointer font-medium">
                Error details
              </summary>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-muted-foreground">
                {errorStack(error)}
              </pre>
            </details>
          ) : null}
        </CardContent>
      </Card>
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
