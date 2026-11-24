import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Lock, Store } from 'lucide-react'

import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/dashboard/no-access')({
  component: NoAccessRoute,
})

function NoAccessRoute() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col items-center rounded-lg border bg-muted/40 p-6 shadow-lg">
        <div className="flex justify-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 border-rose-200 bg-rose-100 dark:border-rose-800 dark:bg-rose-900/10">
            <Lock className="h-6 w-6 text-rose-600 dark:text-rose-400" />
          </div>
        </div>

        <div className="mt-4 gap-0 text-center">
          <h1 className="text-center text-lg font-semibold">Access Denied</h1>
          <p className="mx-auto mt-2 text-center text-sm text-muted-foreground sm:max-w-[90%]">
            You don&apos;t have permission to access this page. If you believe
            this is an error, please contact your administrator for assistance.
          </p>
        </div>

        <div className="mt-8 flex w-full flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="size-3" />
            Go Back
          </Button>
          <Button className="flex-1" onClick={() => void navigate({ to: '/' })}>
            <Store className="size-3" />
            Home
          </Button>
        </div>
      </div>
    </div>
  )
}
