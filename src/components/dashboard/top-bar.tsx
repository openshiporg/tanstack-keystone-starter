import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Search, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

import { SidebarTrigger, useSidebarWithSide } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

import { useCommandPalette } from './command-palette'

export interface Crumb {
  label: string
  href?: string
}

/**
 * Assistant trigger in the page top bar. While it is on screen the floating corner
 * button stays hidden (see DashboardLayout), so nothing covers rows or fields.
 */
export function AssistantHeaderButton({ className }: { className?: string }) {
  const { toggleSidebar, open, openMobile, isMobile } =
    useSidebarWithSide('right')
  const isOpen = isMobile ? openMobile : open
  return (
    <button
      type="button"
      data-assistant-header=""
      onClick={toggleSidebar}
      aria-label="Assistant"
      aria-pressed={isOpen}
      aria-controls="dashboard-ai-assistant"
      title="Assistant"
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-[7px] text-[var(--ks-dim)] transition-colors hover:bg-[var(--ks-hover)] hover:text-[var(--ks-ink)] focus-visible:ring-2 focus-visible:ring-[var(--ks-focus)] focus-visible:outline-none aria-pressed:bg-[var(--ks-hover)] aria-pressed:text-[var(--ks-accent-ink)]',
        className,
      )}
    >
      <Sparkles className="size-4" aria-hidden="true" />
    </button>
  )
}

/**
 * The one sticky bar every dashboard page uses: sidebar toggle, trail, page actions, search, assistant.
 * Phones show only the current page with a back link to its parent.
 */
export function TopBar({
  crumbs,
  actions,
}: {
  crumbs: Crumb[]
  actions?: ReactNode
}) {
  const palette = useCommandPalette()
  const current = crumbs[crumbs.length - 1]
  const parent = [...crumbs.slice(0, -1)].reverse().find((c) => c.href)

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-[var(--ks-line)] bg-[color-mix(in_oklab,var(--ks-surface)_88%,transparent)] px-3 backdrop-blur-md md:rounded-t-[12px] md:px-4">
      <SidebarTrigger className="-ml-1 size-8 shrink-0 text-[var(--ks-dim)]" />
      <span
        aria-hidden="true"
        className="h-4 w-px shrink-0 bg-[var(--ks-line)]"
      />

      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center">
        <div className="flex min-w-0 items-center gap-1 md:hidden">
          {parent?.href && crumbs.length > 2 ? (
            <Link
              to={parent.href}
              aria-label={parent.label}
              className="-ml-1 grid size-7 shrink-0 place-items-center rounded-[7px] text-[var(--ks-dim)] hover:bg-[var(--ks-hover)]"
            >
              <ChevronLeft className="size-4" />
            </Link>
          ) : null}
          <span className="truncate text-[13px] font-medium text-[var(--ks-ink)]">
            {current?.label}
          </span>
        </div>
        <ol className="hidden min-w-0 items-center gap-1 md:flex">
          {crumbs.map((crumb, i) => {
            const last = i === crumbs.length - 1
            return (
              <li
                key={`${crumb.label}-${i}`}
                className="flex min-w-0 items-center gap-1"
              >
                {i > 0 ? (
                  <ChevronRight
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-[var(--ks-label)]"
                  />
                ) : null}
                {last || !crumb.href ? (
                  <span
                    aria-current={last ? 'page' : undefined}
                    className="truncate text-[13px] font-medium text-[var(--ks-ink)]"
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    to={crumb.href}
                    className="truncate rounded-[6px] px-1 text-[13px] text-[var(--ks-dim)] hover:text-[var(--ks-ink)]"
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={palette.open}
          aria-label="Search"
          className="grid size-8 place-items-center rounded-[7px] text-[var(--ks-dim)] hover:bg-[var(--ks-hover)] hover:text-[var(--ks-ink)] md:hidden"
        >
          <Search className="size-4" />
        </button>
        <AssistantHeaderButton />
      </div>
    </header>
  )
}
