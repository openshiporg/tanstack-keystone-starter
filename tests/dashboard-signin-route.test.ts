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
  executeDashboardGraphQL.mockReset()
})

const auth = {
  listKey: 'Account',
  identityField: 'handle',
  secretField: 'secret',
  sessionData: 'id',
  initFirstItemFields: ['displayName', 'handle', 'secret'],
}

describe('dashboard sign-in auth contract', () => {
  it('derives the mutation and arguments from arbitrary auth metadata', async () => {
    const { authenticateDashboardWithPassword } =
      await import('../src/routes/dashboard/signin')
    executeDashboardGraphQL.mockResolvedValue({
      authenticateAccountWithPassword: {
        __typename: 'AccountAuthenticationWithPasswordSuccess',
        sessionToken: 'token',
      },
    })

    await authenticateDashboardWithPassword({
      auth,
      identity: 'ada',
      secret: 'correct horse battery staple',
    })

    const [query, variables] = executeDashboardGraphQL.mock.calls[0] ?? []
    expect(String(query)).toContain('authenticateAccountWithPassword')
    expect(String(query)).toContain('handle: $identity')
    expect(String(query)).toContain('secret: $secret')
    expect(String(query)).toContain(
      '... on AccountAuthenticationWithPasswordSuccess',
    )
    expect(variables).toEqual({
      identity: 'ada',
      secret: 'correct horse battery staple',
    })
  })

  it('preserves authentication failure messages', async () => {
    const { authenticateDashboardWithPassword } =
      await import('../src/routes/dashboard/signin')
    executeDashboardGraphQL.mockResolvedValue({
      authenticateAccountWithPassword: {
        __typename: 'AccountAuthenticationWithPasswordFailure',
        message: 'Bad handle or secret',
      },
    })

    await expect(
      authenticateDashboardWithPassword({
        auth,
        identity: 'ada',
        secret: 'wrong',
      }),
    ).rejects.toThrow('Bad handle or secret')
  })
})
