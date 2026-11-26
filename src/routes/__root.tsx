/// <reference types="vite/client" />
import type { QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Link,
  Outlet,
  ScriptOnce,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import appCss from '../../app/globals.css?url'
import { AuthShell } from '@/components/dashboard/auth-shell'
import { buttonVariants } from '@/components/ui/button'
import { dashboardThemeScript } from '@/components/ui/theme-script'

type RouterContext = {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        name: 'description',
        content: 'Schema-driven content management dashboard.',
      },
      { name: 'color-scheme', content: 'light dark' },
      {
        name: 'theme-color',
        content: '#ffffff',
        media: '(prefers-color-scheme: light)',
      },
      {
        name: 'theme-color',
        content: '#09090b',
        media: '(prefers-color-scheme: dark)',
      },
      { title: 'TanStack CMS Dashboard' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
      { rel: 'apple-touch-icon', href: '/logo192.png' },
      { rel: 'manifest', href: '/manifest.json' },
    ],
  }),
  component: RootComponent,
  notFoundComponent: RootNotFound,
})

/** Unknown URL outside the dashboard: the same card as the auth pages, one way back. */
function RootNotFound() {
  return (
    <AuthShell title="Page not found" description="404">
      <div className="ks-track flex w-full">
        <Link
          to="/dashboard"
          className={buttonVariants({
            variant: 'outline',
            size: 'sm',
            className: 'h-8 flex-1',
          })}
        >
          <ArrowLeft />
          Overview
        </Link>
      </div>
    </AuthShell>
  )
}

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ScriptOnce children={dashboardThemeScript} />
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
