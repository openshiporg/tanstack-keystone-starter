import { Link } from '@tanstack/react-router'
import { ArrowLeft, Compass } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

import { PageContainer } from './page-container'

/** NotFoundPage: unknown list, record or route inside the dashboard shell. */
export function DashboardNotFound({ description = '404' }: { description?: string }) {
  return (
    <PageContainer
      title="Not found"
      breadcrumbs={[
        { type: 'link', label: 'Overview', href: '/dashboard' },
        { type: 'page', label: 'Not found' },
      ]}
    >
      <div className="mx-auto w-full max-w-[760px] px-4 pt-6 md:px-6 md:pt-10">
        <div className="ks-card">
          <EmptyState
            title="Page not found"
            description={description}
            icons={[Compass]}
          >
            <Link
              to="/dashboard"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <ArrowLeft />
              Overview
            </Link>
          </EmptyState>
        </div>
      </div>
    </PageContainer>
  )
}
