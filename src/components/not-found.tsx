import { Link } from '@tanstack/react-router'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md space-y-4 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">
          404
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="text-sm text-muted-foreground">
          The page you requested does not exist or is not available in this
          dashboard.
        </p>
        <div className="flex justify-center gap-2">
          <Link to="/" className={cn(buttonVariants({ variant: 'outline' }))}>
            Home
          </Link>
          <Link to="/dashboard" className={cn(buttonVariants())}>
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
