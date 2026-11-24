import { afterEach, describe, expect, it, vi } from 'vitest'

import { dashboardQueryKeys } from '../src/features/cms/graphql-client'
import { signOutDashboard } from '../src/features/cms/dashboard-session'

const executeDashboardGraphQL = vi.fn()

vi.mock('../src/features/cms/graphql-client', async () => {
  const actual = await vi.importActual('../src/features/cms/graphql-client')
  return {
    ...actual,
    executeDashboardGraphQL: (...args: unknown[]) =>
      executeDashboardGraphQL(...args),
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  executeDashboardGraphQL.mockReset()
})

describe('dashboard sign out', () => {
  it('always redirects to signin and clears dashboard queries when signout succeeds', async () => {
    executeDashboardGraphQL.mockResolvedValue({ endSession: true })
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { assign } })
    const queryClient = {
      cancelQueries: vi.fn().mockResolvedValue(undefined),
      removeQueries: vi.fn(),
    }

    await signOutDashboard(queryClient as any)

    expect(executeDashboardGraphQL).toHaveBeenCalledWith(
      'mutation DashboardSignOut { endSession }',
    )
    expect(queryClient.cancelQueries).toHaveBeenCalledTimes(1)
    expect(queryClient.removeQueries).toHaveBeenCalledTimes(1)

    const cancelPredicate = queryClient.cancelQueries.mock.calls[0][0]
      .predicate as (query: { queryKey: unknown }) => boolean
    const removePredicate = queryClient.removeQueries.mock.calls[0][0]
      .predicate as (query: { queryKey: unknown }) => boolean
    expect(cancelPredicate({ queryKey: dashboardQueryKeys.overview })).toBe(
      true,
    )
    expect(removePredicate({ queryKey: dashboardQueryKeys.adminMeta })).toBe(
      true,
    )
    expect(removePredicate({ queryKey: ['unrelated'] })).toBe(false)

    expect(assign).toHaveBeenCalledWith('/dashboard/signin')
  })

  it('still redirects to signin and clears dashboard queries when endSession fails', async () => {
    executeDashboardGraphQL.mockRejectedValue(new Error('network down'))
    const assign = vi.fn()
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    vi.stubGlobal('window', { location: { assign } })
    const queryClient = {
      cancelQueries: vi.fn().mockResolvedValue(undefined),
      removeQueries: vi.fn(),
    }

    await signOutDashboard(queryClient as any)

    expect(errorSpy).toHaveBeenCalled()
    expect(queryClient.cancelQueries).toHaveBeenCalledTimes(1)
    expect(queryClient.removeQueries).toHaveBeenCalledTimes(1)
    expect(assign).toHaveBeenCalledWith('/dashboard/signin')
  })
})
