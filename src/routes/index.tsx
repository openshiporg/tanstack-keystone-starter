import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRightIcon, DatabaseIcon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <section className="mx-auto max-w-2xl space-y-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <DatabaseIcon className="size-7" />
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            TanStack Keystone Starter
          </h1>
          <p className="text-lg text-muted-foreground">
            A Keystone-compatible CMS runtime and dashboard built natively on
            TanStack Start, GraphQL Yoga, and Prisma.
          </p>
        </div>
        <Link to="/dashboard" className={buttonVariants({ size: 'lg' })}>
          Open dashboard
          <ArrowRightIcon />
        </Link>
      </section>
    </main>
  )
}
