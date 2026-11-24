import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  DashboardErrorBoundary,
  DashboardErrorFallback,
} from '../src/components/dashboard/error-boundary'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('dashboard error boundary', () => {
  it('renders children when there is no error', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        DashboardErrorBoundary,
        null,
        React.createElement('div', null, 'dashboard ok'),
      ),
    )

    expect(html).toContain('dashboard ok')
  })

  it('turns an expired admin session into a sign-in recovery state', () => {
    const html = renderToStaticMarkup(
      React.createElement(DashboardErrorFallback, {
        error: new Error('Access denied: admin UI (keystone.adminMeta)'),
      }),
    )

    expect(html).toContain('Your session has expired')
    expect(html).toContain('Sign in again')
    expect(html).not.toContain('Try again')
  })

  it('renders the fallback UI after a render error is captured', () => {
    const boundary = new DashboardErrorBoundary({
      children: React.createElement('div', null, 'ignored'),
    })
    const error = new Error('boom')

    const derived = DashboardErrorBoundary.getDerivedStateFromError(error)
    boundary.state = derived

    const html = renderToStaticMarkup(boundary.render())

    expect(html).toContain('Something went wrong')
    expect(html).toContain('boom')
    expect(html).toContain('Try again')
  })
})
