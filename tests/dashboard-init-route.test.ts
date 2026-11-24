import { afterEach, describe, expect, it, vi } from 'vitest'

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

const arbitraryAuth = {
  listKey: 'Account',
  identityField: 'handle',
  secretField: 'secret',
  sessionData: 'id',
  initFirstItemFields: ['displayName', 'handle', 'secret'],
}

describe('dashboard init route auth contract', () => {
  it('creates the initial auth item and signs in from arbitrary auth metadata', async () => {
    const { createInitialUserAndSignIn } =
      await import('../src/routes/dashboard/init')

    executeDashboardGraphQL
      .mockResolvedValueOnce({
        createInitialAccount: {
          sessionToken: 'init-token',
          item: { id: 'account_admin' },
        },
      })
      .mockResolvedValueOnce({
        authenticateAccountWithPassword: {
          __typename: 'AccountAuthenticationWithPasswordSuccess',
          sessionToken: 'signin-token',
        },
      })

    await createInitialUserAndSignIn({
      auth: arbitraryAuth,
      data: {
        displayName: 'Ada Admin',
        handle: 'ada',
        secret: 'password',
      },
    })

    expect(executeDashboardGraphQL).toHaveBeenCalledTimes(2)

    const [createQuery, createVariables] =
      executeDashboardGraphQL.mock.calls[0] ?? []
    const [signInQuery, signInVariables] =
      executeDashboardGraphQL.mock.calls[1] ?? []

    expect(String(createQuery)).toContain('createInitialAccount(data: $data)')
    expect(String(createQuery)).toContain('$data: CreateInitialAccountInput!')
    expect(createVariables).toEqual({
      data: {
        displayName: 'Ada Admin',
        handle: 'ada',
        secret: 'password',
      },
    })

    expect(String(signInQuery)).toContain('authenticateAccountWithPassword')
    expect(String(signInQuery)).toContain('handle: $identity')
    expect(String(signInQuery)).toContain('secret: $secret')
    expect(signInVariables).toEqual({
      identity: 'ada',
      secret: 'password',
    })
  })

  it('throws when the follow-up sign in fails', async () => {
    const { createInitialUserAndSignIn } =
      await import('../src/routes/dashboard/init')

    executeDashboardGraphQL
      .mockResolvedValueOnce({
        createInitialAccount: {
          sessionToken: 'init-token',
          item: { id: 'account_admin' },
        },
      })
      .mockResolvedValueOnce({
        authenticateAccountWithPassword: {
          __typename: 'AccountAuthenticationWithPasswordFailure',
          message: 'Bad credentials',
        },
      })

    await expect(
      createInitialUserAndSignIn({
        auth: arbitraryAuth,
        data: {
          displayName: 'Ada Admin',
          handle: 'ada',
          secret: 'password',
        },
      }),
    ).rejects.toThrow('Bad credentials')
  })
})
