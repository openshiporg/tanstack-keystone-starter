import { describe, expect, it } from 'vitest'

import {
  isStandaloneDashboardAuthPath,
  resolveDashboardRedirect,
  safeDashboardRedirectPath,
} from '../src/features/cms/dashboard-route-guards'

describe('dashboard route guard parity', () => {
  it('detects standalone dashboard auth paths', () => {
    expect(isStandaloneDashboardAuthPath('/dashboard/signin')).toBe(true)
    expect(isStandaloneDashboardAuthPath('/dashboard/reset?token=abc')).toBe(
      true,
    )
    expect(isStandaloneDashboardAuthPath('/dashboard/todos')).toBe(false)
  })

  it('redirects anonymous protected requests to signin with from', () => {
    expect(
      resolveDashboardRedirect({
        pathname: '/dashboard/todos',
        publicSignupsAllowed: false,
        authenticatedItem: null,
        redirectToInit: false,
      }),
    ).toEqual({ to: '/dashboard/signin', search: { from: '/dashboard/todos' } })
  })

  it('redirects signup to signin when public signups are disabled', () => {
    expect(
      resolveDashboardRedirect({
        pathname: '/dashboard/signup',
        publicSignupsAllowed: false,
        authenticatedItem: null,
        redirectToInit: false,
      }),
    ).toEqual({ to: '/dashboard/signin' })
  })

  it('redirects authenticated users away from public auth routes', () => {
    expect(
      resolveDashboardRedirect({
        pathname: '/dashboard/signin',
        searchFrom: '/dashboard/users',
        publicSignupsAllowed: true,
        authenticatedItem: {
          id: 'user_admin',
          isAccessAllowed: true,
        },
        redirectToInit: false,
      }),
    ).toEqual({ to: '/dashboard/users' })
  })

  it('sanitizes auth-route redirect targets to avoid signin/init loops', () => {
    expect(safeDashboardRedirectPath('/dashboard/signin')).toBe('/dashboard')
    expect(safeDashboardRedirectPath('/dashboard/init')).toBe('/dashboard')
    expect(safeDashboardRedirectPath('/dashboard/todos')).toBe(
      '/dashboard/todos',
    )
    expect(safeDashboardRedirectPath('/')).toBe('/dashboard')

    expect(
      resolveDashboardRedirect({
        pathname: '/dashboard/signin',
        searchFrom: '/dashboard/signin',
        publicSignupsAllowed: true,
        authenticatedItem: {
          id: 'user_admin',
          isAccessAllowed: true,
        },
        redirectToInit: false,
      }),
    ).toEqual({ to: '/dashboard' })
  })

  it('redirects first-item mode to init except for init/reset routes', () => {
    expect(
      resolveDashboardRedirect({
        pathname: '/dashboard',
        publicSignupsAllowed: true,
        authenticatedItem: null,
        redirectToInit: true,
      }),
    ).toEqual({ to: '/dashboard/init' })

    expect(
      resolveDashboardRedirect({
        pathname: '/dashboard/reset',
        publicSignupsAllowed: true,
        authenticatedItem: null,
        redirectToInit: true,
      }),
    ).toBeNull()
  })

  it('lets unauthenticated users visit no-access without a nested from redirect', () => {
    expect(
      resolveDashboardRedirect({
        pathname: '/dashboard/no-access',
        publicSignupsAllowed: true,
        authenticatedItem: null,
        redirectToInit: false,
      }),
    ).toEqual({ to: '/dashboard/signin' })
  })

  it('redirects users without dashboard access to no-access', () => {
    expect(
      resolveDashboardRedirect({
        pathname: '/dashboard/users',
        publicSignupsAllowed: true,
        authenticatedItem: {
          id: 'user_limited',
          isAccessAllowed: false,
        },
        redirectToInit: false,
      }),
    ).toEqual({ to: '/dashboard/no-access' })
  })
})
