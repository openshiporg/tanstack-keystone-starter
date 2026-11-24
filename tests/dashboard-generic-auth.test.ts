import { describe, expect, it } from 'vitest'

import {
  buildDashboardAuthQuery,
  buildDashboardPasswordAuthContract,
  buildDashboardPublicAuthOperations,
} from '../src/features/cms/graphql-client'

describe('generic dashboard auth metadata', () => {
  it('derives auth list, label, identity, path, and session selection from config metadata', () => {
    const result = buildDashboardAuthQuery({
      auth: {
        listKey: 'Account',
        identityField: 'handle',
        secretField: 'secret',
        sessionData: 'displayName team { id title }',
        initFirstItemFields: ['displayName', 'handle', 'secret'],
      },
      lists: [
        {
          key: 'Account',
          path: 'accounts',
          labelField: 'displayName',
          fields: [
            { path: 'id' },
            { path: 'handle' },
            { path: 'displayName' },
            { path: 'team' },
          ],
        },
      ],
    })

    expect(result?.listPath).toBe('accounts')
    expect(result?.query).toContain('... on Account')
    expect(result?.query).toContain('label: displayName')
    expect(result?.query).toContain('identity: handle')
    expect(result?.query).toContain('displayName team { id title }')
    expect(result?.query).not.toContain('... on Member')
  })

  it('derives password mutation names and argument fields from arbitrary auth metadata', () => {
    expect(
      buildDashboardPasswordAuthContract({
        listKey: 'Account',
        identityField: 'handle',
        secretField: 'secret',
        initFirstItemFields: ['displayName', 'handle', 'secret'],
      }),
    ).toEqual({
      authenticateMutationName: 'authenticateAccountWithPassword',
      authenticationFailureType: 'AccountAuthenticationWithPasswordFailure',
      authenticationSuccessType: 'AccountAuthenticationWithPasswordSuccess',
      createInitialInputName: 'CreateInitialAccountInput',
      createInitialMutationName: 'createInitialAccount',
      identityField: 'handle',
      initFirstItemFields: ['displayName', 'handle', 'secret'],
      listKey: 'Account',
      secretField: 'secret',
    })
  })

  it('derives public signup and password-reset operations from arbitrary auth metadata', () => {
    const operations = buildDashboardPublicAuthOperations({
      listKey: 'Account',
      identityField: 'handle',
      secretField: 'secret',
      initFirstItemFields: ['displayName', 'handle', 'secret'],
    })

    expect(operations).toMatchObject({
      createInputName: 'AccountCreateInput',
      createMutationName: 'createAccount',
      authenticateMutationName: 'authenticateAccountWithPassword',
      sendPasswordResetMutationName: 'sendAccountPasswordResetLink',
      redeemPasswordResetMutationName: 'redeemAccountPasswordResetToken',
    })
  })

  it.each([
    ['listKey', 'Account mutation Evil { x'],
    ['identityField', 'bad-name'],
    ['secretField', '9secret'],
    ['initFirstItemFields', ['displayName', 'bad-name']],
  ] as const)('rejects invalid %s GraphQL names', (key, value) => {
    expect(() =>
      buildDashboardPasswordAuthContract({
        listKey: 'Account',
        identityField: 'handle',
        secretField: 'secret',
        initFirstItemFields: ['displayName', 'handle', 'secret'],
        [key]: value,
      }),
    ).toThrow(/Invalid .+ GraphQL name/)
  })

  it('returns no auth query when auth is not configured', () => {
    expect(buildDashboardAuthQuery({ auth: null, lists: [] })).toBeNull()
  })
})
