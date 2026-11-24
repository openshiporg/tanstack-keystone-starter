// @vitest-environment jsdom

import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { DashboardErrorFallback } from '../src/components/dashboard/error-boundary'
import { MutationErrorNotice } from '../src/components/dashboard/mutation-error-notice'
import { BreadcrumbPage } from '../src/components/ui/breadcrumb'
import { ToasterProvider, useToast } from '../src/components/ui/toaster'

function ToastProbe() {
  const { toast } = useToast()
  return React.createElement(
    'button',
    {
      type: 'button',
      onClick: () =>
        toast({
          title: 'Changes saved',
          description: 'The item was updated.',
        }),
    },
    'Show notification',
  )
}

describe('dashboard accessibility contracts', () => {
  it('renders route-level failures as a named main landmark and assertive alert', () => {
    const html = renderToStaticMarkup(
      React.createElement(DashboardErrorFallback, {
        error: new Error('Resolver unavailable'),
      }),
    )

    expect(html).toContain('<main')
    expect(html).toContain('<h1')
    expect(html).toContain('role="alert"')
    expect(html).toContain('aria-live="assertive"')
  })

  it('announces destructive mutation failures and polite neutral results', () => {
    const destructive = renderToStaticMarkup(
      React.createElement(MutationErrorNotice, {
        error: { message: 'Save failed', details: 'Access denied' },
      }),
    )
    const neutral = renderToStaticMarkup(
      React.createElement(MutationErrorNotice, {
        variant: 'neutral',
        error: { message: 'Saved changes.', details: null },
      }),
    )

    expect(destructive).toContain('role="alert"')
    expect(destructive).toContain('aria-live="assertive"')
    expect(neutral).toContain('role="status"')
    expect(neutral).toContain('aria-live="polite"')
  })

  it('exposes the current breadcrumb as current text rather than a disabled link', () => {
    const html = renderToStaticMarkup(
      React.createElement(BreadcrumbPage, null, 'Projects'),
    )

    expect(html).toContain('aria-current="page"')
    expect(html).not.toContain('role="link"')
    expect(html).not.toContain('aria-disabled="true"')
  })

  it('announces toast additions and gives dismiss controls contextual names', () => {
    vi.useFakeTimers()
    render(
      React.createElement(
        ToasterProvider,
        null,
        React.createElement(ToastProbe),
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Show notification' }))

    expect(screen.getByRole('status').getAttribute('aria-atomic')).toBe('true')
    expect(
      screen.getByRole('button', {
        name: 'Dismiss Changes saved notification',
      }),
    ).toBeTruthy()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('defines executable reduced-motion and forced-colors safeguards', () => {
    const css = readFileSync(path.resolve('src/styles.css'), 'utf8')

    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('@media (forced-colors: active)')
    expect(css).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
    expect(css).toMatch(/outline:\s*3px solid Highlight\s*!important/)
  })
})
