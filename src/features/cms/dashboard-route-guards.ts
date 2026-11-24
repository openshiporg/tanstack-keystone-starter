export type DashboardGuardUser = {
  id: string
  isAccessAllowed: boolean
}

export type DashboardRedirectDecision = {
  to: string
  search?: { from: string }
} | null

const standaloneDashboardPrefixes = [
  '/dashboard/init',
  '/dashboard/signin',
  '/dashboard/signup',
  '/dashboard/reset',
  '/dashboard/no-access',
]

export function isStandaloneDashboardAuthPath(pathname: string) {
  return standaloneDashboardPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  )
}

export function safeDashboardRedirectPath(value: string | undefined) {
  return value?.startsWith('/dashboard') &&
    !value.startsWith('/dashboard/signin') &&
    !value.startsWith('/dashboard/init')
    ? value
    : '/dashboard'
}

export function resolveDashboardRedirect({
  pathname,
  searchFrom,
  publicSignupsAllowed,
  authenticatedItem,
  redirectToInit,
}: {
  pathname: string
  searchFrom?: string
  publicSignupsAllowed: boolean
  authenticatedItem: DashboardGuardUser | null
  redirectToInit: boolean
}): DashboardRedirectDecision {
  const isInitRoute = pathname.startsWith('/dashboard/init')
  const isSigninRoute = pathname.startsWith('/dashboard/signin')
  const isSignupRoute = pathname.startsWith('/dashboard/signup')
  const isResetRoute = pathname.startsWith('/dashboard/reset')
  const isNoAccessRoute = pathname.startsWith('/dashboard/no-access')

  if (isSignupRoute && !publicSignupsAllowed) return { to: '/dashboard/signin' }

  const isPublicAuthRoute =
    isSigninRoute || isResetRoute || (isSignupRoute && publicSignupsAllowed)
  const isFirstItemRoute = isInitRoute || isResetRoute

  if (redirectToInit) {
    if (!isFirstItemRoute) return { to: '/dashboard/init' }
    return null
  }

  if (isInitRoute) return { to: '/dashboard' }

  if (!authenticatedItem && !isPublicAuthRoute) {
    return {
      to: '/dashboard/signin',
      ...(isNoAccessRoute ? {} : { search: { from: pathname } }),
    }
  }

  if (authenticatedItem && isPublicAuthRoute) {
    return {
      to: safeDashboardRedirectPath(searchFrom),
    }
  }

  if (
    authenticatedItem &&
    !isNoAccessRoute &&
    !authenticatedItem.isAccessAllowed
  ) {
    return { to: '/dashboard/no-access' }
  }

  return null
}
