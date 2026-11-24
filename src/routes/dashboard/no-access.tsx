import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Home, Lock, LogOut } from 'lucide-react'

import { AuthShell } from '@/components/dashboard/auth-shell'
import { Button } from '@/components/ui/button'
import { signOutDashboard } from '@/features/cms/dashboard-session'

export const Route = createFileRoute('/dashboard/no-access')({
  component: NoAccessRoute,
})

function NoAccessRoute() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return (
    <AuthShell title="No access">
      <div className="-mt-2 mb-5 flex items-center gap-2 text-[13px] text-[var(--ks-dim)]">
        <span className="ks-dot" data-tone="red" aria-hidden="true" />
        <Lock className="size-3.5" aria-hidden="true" />
        <span>Role without dashboard access</span>
      </div>
      <div className="flex flex-col gap-2">
        <div className="ks-track flex w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 flex-1"
            onClick={() => window.history.back()}
          >
            <ArrowLeft />
            Back
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 flex-1"
            onClick={() => void navigate({ to: '/' })}
          >
            <Home />
            Home
          </Button>
        </div>
        <div className="ks-track flex w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-variant="danger"
            className="h-8 w-full"
            onClick={() => void signOutDashboard(queryClient)}
          >
            <LogOut />
            Sign out
          </Button>
        </div>
      </div>
    </AuthShell>
  )
}
