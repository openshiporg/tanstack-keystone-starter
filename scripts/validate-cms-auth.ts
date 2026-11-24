import { graphql } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'

import cmsConfig from '../cms.config'
import {
  memoryCmsAdapter,
  resetMemoryAdapter,
  setCmsAdapterForTests,
} from '../src/features/cms/adapters'
import type { CmsContext } from '../src/features/cms/adapters'
import { config, initialiseLists } from '../src/features/cms/config'
import { createAuth } from '../src/features/cms/keystone/auth'
import { text, password } from '../src/features/cms/keystone/fields'
import { addAuthGraphQLSchema } from '../src/features/cms/auth/graphql'
import { hashPassword } from '../src/features/cms/auth/password'
import {
  statelessSessions,
  storedSessions,
} from '../src/features/cms/auth/session'
import { cmsLists } from '../src/features/cms/registry'
import {
  createCmsContext,
  generateCmsResolversForLists,
  generateCmsTypeDefsForLists,
  getCmsGraphQLSchema,
} from '../src/features/cms/runtime'

const schema = getCmsGraphQLSchema()

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function emptySeed() {
  return Object.fromEntries(cmsLists.map((list) => [list.key, []]))
}

async function execute(
  source: string,
  variableValues?: Record<string, unknown>,
  contextValue?: Awaited<ReturnType<typeof createCmsContext>>,
) {
  const cmsContext =
    contextValue ??
    (await createCmsContext(
      new Request('http://local.test/api/graphql', {
        headers: { 'x-cms-anonymous': 'true' },
      }),
    ))
  const result = await graphql({
    schema,
    source,
    variableValues,
    contextValue: cmsContext,
  })
  if (result.errors?.length)
    throw new Error(result.errors.map((error) => error.message).join('\n'))
  return result.data as Record<string, unknown>
}

async function main() {
  process.env.CMS_ADAPTER = 'memory'
  setCmsAdapterForTests(memoryCmsAdapter)
  resetMemoryAdapter()

  const anonymousContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { 'x-cms-anonymous': 'true' },
    }),
  )
  const anonymous = await execute(
    /* GraphQL */ `
      query ValidateAnonymousAuthState {
        authenticatedItem {
          ... on User {
            id
          }
        }
        redirectToInit
      }
    `,
    undefined,
    anonymousContext,
  )
  assert(
    anonymous.authenticatedItem === null,
    'anonymous requests should not have authenticatedItem',
  )
  assert(
    anonymous.redirectToInit === false,
    'redirectToInit should be false when seeded users exist',
  )

  const previousNodeEnv = process.env.NODE_ENV
  const previousDevFallback = process.env.CMS_DEV_AUTH_FALLBACK
  const previousDevAuthItemId = process.env.CMS_DEV_AUTH_ITEM_ID
  process.env.NODE_ENV = 'production'
  try {
    const productionContext = await createCmsContext(
      new Request('http://local.test/api/graphql'),
    )
    const productionAuthState = await execute(
      /* GraphQL */ `
        query ValidateProductionNoDevFallback {
          authenticatedItem {
            ... on User {
              id
            }
          }
        }
      `,
      undefined,
      productionContext,
    )
    assert(
      productionAuthState.authenticatedItem === null,
      'production requests without a real session should not receive the dev fallback session',
    )
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousNodeEnv
  }

  delete process.env.CMS_DEV_AUTH_FALLBACK
  const defaultFallbackContext = await createCmsContext(
    new Request('http://local.test/api/graphql'),
  )
  const defaultFallbackAuthState = await execute(
    /* GraphQL */ `
      query ValidateDefaultNoDevFallback {
        authenticatedItem {
          ... on User {
            id
          }
        }
      }
    `,
    undefined,
    defaultFallbackContext,
  )
  assert(
    defaultFallbackAuthState.authenticatedItem === null,
    'development auth fallback should be disabled by default',
  )

  process.env.CMS_DEV_AUTH_FALLBACK = 'true'
  delete process.env.CMS_DEV_AUTH_ITEM_ID
  const unconfiguredFallbackContext = await createCmsContext(
    new Request('http://local.test/api/graphql'),
  )
  const unconfiguredFallbackAuthState = await execute(
    /* GraphQL */ `
      query ValidateUnconfiguredDevFallback {
        authenticatedItem {
          ... on User {
            id
          }
        }
      }
    `,
    undefined,
    unconfiguredFallbackContext,
  )
  assert(
    unconfiguredFallbackAuthState.authenticatedItem === null,
    'development auth fallback must not assume a hard-coded auth item ID',
  )

  process.env.CMS_DEV_AUTH_ITEM_ID = 'user_admin'
  const enabledFallbackContext = await createCmsContext(
    new Request('http://local.test/api/graphql'),
  )
  const enabledFallbackAuthState = await execute(
    /* GraphQL */ `
      query ValidateOptInDevFallback {
        authenticatedItem {
          ... on User {
            id
          }
        }
      }
    `,
    undefined,
    enabledFallbackContext,
  )
  assert(
    asRecord(enabledFallbackAuthState.authenticatedItem).id === 'user_admin',
    'development auth fallback should only work when explicitly enabled',
  )
  if (previousDevFallback === undefined)
    delete process.env.CMS_DEV_AUTH_FALLBACK
  else process.env.CMS_DEV_AUTH_FALLBACK = previousDevFallback
  if (previousDevAuthItemId === undefined)
    delete process.env.CMS_DEV_AUTH_ITEM_ID
  else process.env.CMS_DEV_AUTH_ITEM_ID = previousDevAuthItemId

  const failed = await execute(
    /* GraphQL */ `
      mutation ValidateFailedPasswordAuth {
        authenticateUserWithPassword(
          email: "ada@example.com"
          password: "wrong-password"
        ) {
          __typename
          ... on UserAuthenticationWithPasswordFailure {
            message
          }
        }
      }
    `,
    undefined,
    anonymousContext,
  )
  const failedAuth = asRecord(failed.authenticateUserWithPassword)
  assert(
    failedAuth.__typename === 'UserAuthenticationWithPasswordFailure',
    'wrong password should return auth failure union member',
  )

  const successful = await execute(
    /* GraphQL */ `
      mutation ValidatePasswordAuth {
        authenticateUserWithPassword(
          email: "ada@example.com"
          password: "password"
        ) {
          __typename
          ... on UserAuthenticationWithPasswordSuccess {
            sessionToken
            item {
              id
              email
              password {
                isSet
              }
            }
          }
          ... on UserAuthenticationWithPasswordFailure {
            message
          }
        }
      }
    `,
    undefined,
    anonymousContext,
  )
  const successAuth = asRecord(successful.authenticateUserWithPassword)
  assert(
    successAuth.__typename === 'UserAuthenticationWithPasswordSuccess',
    'correct password should return auth success union member',
  )
  assert(
    typeof successAuth.sessionToken === 'string' &&
      successAuth.sessionToken.length > 20,
    'auth success should return a session token',
  )
  assert(
    String(successAuth.sessionToken).startsWith('v1.'),
    'stateless session tokens should use the sealed v1 format',
  )
  assert(
    !String(successAuth.sessionToken).includes('user_admin'),
    'sealed session tokens should not expose session payload contents directly',
  )
  assert(
    asRecord(successAuth.item).id === 'user_admin',
    'auth success should return the authenticated item',
  )
  assert(
    asRecord(successAuth.item).password === null,
    'auth success should still respect password field read access',
  )

  const tokenContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { authorization: `Bearer ${String(successAuth.sessionToken)}` },
    }),
  )
  const authenticated = await execute(
    /* GraphQL */ `
      query ValidateAuthenticatedItem {
        authenticatedItem {
          ... on User {
            id
            email
            role {
              id
              name
            }
          }
        }
      }
    `,
    undefined,
    tokenContext,
  )
  assert(
    asRecord(authenticated.authenticatedItem).id === 'user_admin',
    'Bearer session token should hydrate context.session and authenticatedItem',
  )
  assert(
    tokenContext.session,
    'Bearer session token should hydrate context.session',
  )
  assert(
    tokenContext.session.listKey === 'User',
    'authenticated sessions should preserve the auth listKey on the hydrated session',
  )

  const internalContext = tokenContext.internal()
  const internalResult = await graphql({
    schema: internalContext.graphql.schema,
    source: /* GraphQL */ `
      query ValidateInternalSchema {
        users {
          id
          email
        }
      }
    `,
    contextValue: internalContext,
  })
  if (internalResult.errors?.length)
    throw new Error(
      internalResult.errors.map((error) => error.message).join('\n'),
    )
  assert(
    internalContext.__internal.internal === true,
    'context.internal() should mark the context as internal',
  )

  const anonymousInternalContext = anonymousContext.internal()
  const anonymousInternalResult = await graphql({
    schema: anonymousInternalContext.graphql.schema,
    source: /* GraphQL */ `
      query ValidateInternalDoesNotBypassAccess {
        users {
          id
          email
        }
      }
    `,
    contextValue: anonymousInternalContext,
  })
  assert(
    !anonymousInternalResult.errors?.length &&
      Array.isArray(anonymousInternalResult.data?.users) &&
      anonymousInternalResult.data.users.length === 0,
    'context.internal() should preserve Keystone read-hiding semantics without bypassing access',
  )
  assert(
    tokenContext.session.data.email === 'ada@example.com',
    'sessionData should materialize selected scalar fields into context.session.data',
  )
  assert(
    asRecord(tokenContext.session.data.role).name === 'Administrator',
    'sessionData should materialize selected nested role fields into context.session.data',
  )
  assert(
    !('password' in tokenContext.session.data),
    'sessionData should not expose unselected fields in context.session.data',
  )

  const reboundContext = await anonymousContext.withRequest(
    new Request('http://local.test/api/graphql', {
      headers: { authorization: `Bearer ${String(successAuth.sessionToken)}` },
    }),
  )
  const reboundAuthenticated = await execute(
    /* GraphQL */ `
      query ValidateWithRequestSession {
        authenticatedItem {
          ... on User {
            id
            email
          }
        }
      }
    `,
    undefined,
    reboundContext,
  )
  assert(
    asRecord(reboundAuthenticated.authenticatedItem).id === 'user_admin',
    'context.withRequest should re-evaluate the session from the replacement request',
  )

  const originalSessionStrategy = cmsConfig.session
  const strategyCalls = {
    get: [] as string[],
    start: [] as Array<Record<string, unknown>>,
    end: 0,
  }
  try {
    cmsConfig.session = {
      async get({ context }) {
        strategyCalls.get.push(
          context.__internal.request?.headers.get('authorization') ??
            'NO_AUTH_HEADER',
        )
        const authHeader =
          context.__internal.request?.headers.get('authorization')
        if (authHeader === 'Bearer strategy-rebound-token')
          return { listKey: 'User', itemId: 'user_admin' }
        return undefined
      },
      async start({ data }) {
        strategyCalls.start.push(asRecord(data))
        return 'strategy-session-token'
      },
      async end() {
        strategyCalls.end += 1
      },
    }

    const strategyBaseContext = await createCmsContext(
      new Request('http://local.test/api/graphql', {
        headers: { 'x-cms-anonymous': 'true' },
      }),
    )
    const strategyReboundContext = await strategyBaseContext.withRequest(
      new Request('http://local.test/api/graphql', {
        headers: { authorization: 'Bearer strategy-rebound-token' },
      }),
    )
    assert(
      strategyCalls.get.includes('Bearer strategy-rebound-token'),
      'context.withRequest should invoke sessionStrategy.get for the replacement request',
    )
    assert(
      strategyReboundContext.session?.itemId === 'user_admin',
      'context.withRequest should hydrate the replacement session from sessionStrategy.get',
    )
    assert(
      asRecord(strategyReboundContext.session.data).email === 'ada@example.com',
      'context.withRequest should materialize configured sessionData for replacement sessions',
    )

    const strategyAuthContext = await createCmsContext(
      new Request('http://local.test/api/graphql', {
        headers: { 'x-cms-anonymous': 'true' },
      }),
    )
    const strategyAuthSuccess = await execute(
      /* GraphQL */ `
        mutation ValidateSpyStrategyPasswordAuth {
          authenticateUserWithPassword(
            email: "ada@example.com"
            password: "password"
          ) {
            __typename
            ... on UserAuthenticationWithPasswordSuccess {
              sessionToken
            }
            ... on UserAuthenticationWithPasswordFailure {
              message
            }
          }
        }
      `,
      undefined,
      strategyAuthContext,
    )
    assert(
      asRecord(strategyAuthSuccess.authenticateUserWithPassword).__typename ===
        'UserAuthenticationWithPasswordSuccess',
      'password auth should succeed when sessionStrategy.start returns a non-empty string',
    )
    assert(
      strategyCalls.start.length > 0,
      'password auth should call sessionStrategy.start',
    )
    const latestStartArgs = strategyCalls.start.at(-1) ?? {}
    assert(
      latestStartArgs.listKey === 'User',
      'password auth should pass auth listKey into sessionStrategy.start',
    )
    assert(
      latestStartArgs.itemId === 'user_admin',
      'password auth should pass authenticated itemId into sessionStrategy.start',
    )

    cmsConfig.session = {
      async get() {
        return undefined
      },
      async start() {
        return 123 as never
      },
      async end() {
        strategyCalls.end += 1
      },
    }
    const nonStringStartContext = await createCmsContext(
      new Request('http://local.test/api/graphql', {
        headers: { 'x-cms-anonymous': 'true' },
      }),
    )
    const nonStringStartResult = await execute(
      /* GraphQL */ `
        mutation ValidateNonStringStartFailure {
          authenticateUserWithPassword(
            email: "ada@example.com"
            password: "password"
          ) {
            __typename
            ... on UserAuthenticationWithPasswordFailure {
              message
            }
          }
        }
      `,
      undefined,
      nonStringStartContext,
    )
    assert(
      asRecord(nonStringStartResult.authenticateUserWithPassword).__typename ===
        'UserAuthenticationWithPasswordFailure',
      'password auth should fail when sessionStrategy.start returns a non-string token',
    )

    cmsConfig.session = {
      async get() {
        return undefined
      },
      async start() {
        return ''
      },
      async end() {
        strategyCalls.end += 1
      },
    }
    const emptyStartContext = await createCmsContext(
      new Request('http://local.test/api/graphql', {
        headers: { 'x-cms-anonymous': 'true' },
      }),
    )
    const emptyStartResult = await execute(
      /* GraphQL */ `
        mutation ValidateEmptyStartFailure {
          authenticateUserWithPassword(
            email: "ada@example.com"
            password: "password"
          ) {
            __typename
            ... on UserAuthenticationWithPasswordFailure {
              message
            }
          }
        }
      `,
      undefined,
      emptyStartContext,
    )
    assert(
      asRecord(emptyStartResult.authenticateUserWithPassword).__typename ===
        'UserAuthenticationWithPasswordFailure',
      'password auth should fail when sessionStrategy.start returns an empty token',
    )

    cmsConfig.session = {
      async get() {
        return undefined
      },
      async start() {
        return 'unused-token'
      },
      async end() {
        strategyCalls.end += 1
      },
    }
    const endSessionContext = await createCmsContext(
      new Request('http://local.test/api/graphql', {
        headers: { 'x-cms-anonymous': 'true' },
      }),
    )
    const endSessionResult = await execute(
      /* GraphQL */ `
        mutation ValidateEndSession {
          endSession
        }
      `,
      undefined,
      endSessionContext,
    )
    assert(
      endSessionResult.endSession === true,
      'endSession should return true',
    )
    assert(strategyCalls.end > 0, 'endSession should call sessionStrategy.end')
  } finally {
    cmsConfig.session = originalSessionStrategy
  }

  const responseHeaders = new Headers()
  const cookieContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { 'x-cms-anonymous': 'true' },
    }),
    schema,
    responseHeaders,
  )
  await execute(
    /* GraphQL */ `
      mutation ValidateSessionCookieWritten {
        authenticateUserWithPassword(
          email: "ada@example.com"
          password: "password"
        ) {
          __typename
          ... on UserAuthenticationWithPasswordSuccess {
            sessionToken
          }
        }
      }
    `,
    undefined,
    cookieContext,
  )
  assert(
    Boolean(responseHeaders.get('set-cookie')?.includes('keystonejs-session=')),
    'password auth should write an httpOnly session cookie when response headers are available',
  )

  const statelessStrategy = statelessSessions<{ itemId: string }>({
    secret: '12345678901234567890123456789012',
    maxAge: 60,
  })
  const statelessHeaders = new Headers()
  const statelessTestContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { 'x-cms-anonymous': 'true' },
    }),
    schema,
    statelessHeaders,
  )
  const sealedToken = await statelessStrategy.start({
    data: { itemId: 'user_admin' },
    context: statelessTestContext,
  })
  assert(
    typeof sealedToken === 'string' && sealedToken.startsWith('v1.'),
    'statelessSessions.start should return a sealed v1 token',
  )
  const statelessReadContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { authorization: `Bearer ${String(sealedToken)}` },
    }),
  )
  const statelessSession = await statelessStrategy.get({
    context: statelessReadContext,
  })
  assert(
    asRecord(statelessSession).itemId === 'user_admin',
    'statelessSessions.get should decrypt sealed bearer tokens',
  )
  const statelessCookieReadContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { cookie: `keystonejs-session=${String(sealedToken)}` },
    }),
  )
  const statelessCookieSession = await statelessStrategy.get({
    context: statelessCookieReadContext,
  })
  assert(
    asRecord(statelessCookieSession).itemId === 'user_admin',
    'statelessSessions.get should decrypt sealed cookie tokens',
  )

  const wrappedAuthConfig = createAuth({
    listKey: 'User',
    identityField: 'email',
    secretField: 'password',
    sessionData: 'id email',
  }).withAuth(
    config({
      lists: {
        User: {
          fields: {
            email: text({
              validation: { isRequired: true },
              isIndexed: 'unique',
            }),
            password: password(),
          },
        },
      },
      session: {
        get: async () => ({
          listKey: 'ExplicitWrappedList',
          itemId: 'user_admin',
        }),
        start: async () => undefined,
        end: async () => undefined,
      },
    }),
  )
  const wrappedStrategySession = await wrappedAuthConfig.session?.get({
    context: anonymousContext,
  })
  assert(
    asRecord(wrappedStrategySession).listKey === 'ExplicitWrappedList',
    'withAuth session wrapper should preserve an explicit upstream session listKey',
  )
  assert(
    asRecord(asRecord(wrappedStrategySession).data).email === 'ada@example.com',
    'withAuth session wrapper should still materialize configured sessionData',
  )

  const arbitraryAuthConfig = createAuth({
    listKey: 'Account',
    identityField: 'handle',
    secretField: 'credential',
    sessionData: 'id handle',
    passwordResetLink: {
      sendToken: async () => undefined,
    },
  }).withAuth(
    config({
      lists: {
        Account: {
          fields: {
            handle: text({
              validation: { isRequired: true },
              isIndexed: 'unique',
            }),
            credential: password(),
          },
        },
      },
      session: {
        get: async () => ({ itemId: 'account_1' }),
        start: async () => undefined,
        end: async () => undefined,
      },
    }),
  )
  assert(
    [
      'passwordResetToken',
      'passwordResetIssuedAt',
      'passwordResetRedeemedAt',
    ].every(
      (fieldPath) => fieldPath in arbitraryAuthConfig.lists.Account.fields,
    ),
    'createAuth must inject password-reset storage fields into any configured auth list instead of relying on User model fields',
  )

  const arbitraryStrategySession = await arbitraryAuthConfig.session?.get({
    context: {
      sudo: () => ({
        query: {
          Account: {
            findOne: async () => ({ id: 'account_1', handle: 'operator' }),
          },
        },
      }),
    } as unknown as CmsContext,
  })
  assert(
    asRecord(arbitraryStrategySession).listKey === 'Account' &&
      asRecord(asRecord(arbitraryStrategySession).data).handle === 'operator',
    'createAuth session hydration must derive arbitrary auth list and identity names from configuration',
  )

  const arbitraryAuthLists = initialiseLists(arbitraryAuthConfig)
  const arbitraryBaseSchema = makeExecutableSchema({
    typeDefs: generateCmsTypeDefsForLists(arbitraryAuthLists),
    resolvers: generateCmsResolversForLists(arbitraryAuthLists),
  })
  const arbitraryAuthSchema = addAuthGraphQLSchema(
    arbitraryBaseSchema,
    arbitraryAuthLists,
    arbitraryAuthConfig.auth,
  )
  const accountCredential = await hashPassword('account-secret')
  const arbitraryGraphQLContext = {
    adapter: {
      findUnique: async (listKey: string) =>
        listKey === 'Account'
          ? {
              id: 'account_1',
              handle: 'operator',
              credential: accountCredential,
            }
          : null,
    },
    __internal: { sudo: true, lists: arbitraryAuthLists },
    sessionStrategy: {
      start: async () => 'arbitrary-session-token',
      get: async () => undefined,
      end: async () => undefined,
    },
    sudo() {
      return this
    },
  } as unknown as CmsContext
  const arbitraryGraphQLAuth = await graphql({
    schema: arbitraryAuthSchema,
    source: /* GraphQL */ `
      mutation ValidateArbitraryAuthGraphQL {
        authenticateAccountWithPassword(
          handle: "operator"
          credential: "account-secret"
        ) {
          __typename
          ... on AccountAuthenticationWithPasswordSuccess {
            sessionToken
            item {
              id
              handle
            }
          }
          ... on AccountAuthenticationWithPasswordFailure {
            message
          }
        }
      }
    `,
    contextValue: arbitraryGraphQLContext,
  })
  if (arbitraryGraphQLAuth.errors?.length)
    throw new Error(
      arbitraryGraphQLAuth.errors
        .map((error) => error.originalError?.stack ?? error.message)
        .join('\n'),
    )
  const arbitraryGraphQLResult = asRecord(
    asRecord(arbitraryGraphQLAuth.data).authenticateAccountWithPassword,
  )
  assert(
    arbitraryGraphQLResult.__typename ===
      'AccountAuthenticationWithPasswordSuccess' &&
      asRecord(arbitraryGraphQLResult.item).handle === 'operator',
    'auth GraphQL generation and password verification must derive arbitrary list, identity, and secret names from configuration',
  )

  const storedSessionMap = new Map<string, { itemId: string }>()
  const storedStrategy = storedSessions<{ itemId: string }>({
    secret: '12345678901234567890123456789012',
    maxAge: 60,
    store: () => ({
      get: async (sessionId) => storedSessionMap.get(sessionId),
      set: async (sessionId, data) => {
        storedSessionMap.set(sessionId, data)
      },
      delete: async (sessionId) => {
        storedSessionMap.delete(sessionId)
      },
    }),
  })
  const storedHeaders = new Headers()
  const storedContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { 'x-cms-anonymous': 'true' },
    }),
    schema,
    storedHeaders,
  )
  const storedToken = await storedStrategy.start({
    data: { itemId: 'user_admin' },
    context: storedContext,
  })
  assert(
    typeof storedToken === 'string' && storedToken.startsWith('v1.'),
    'storedSessions.start should return a sealed cookie token',
  )
  assert(
    storedSessionMap.size === 1,
    'storedSessions.start should persist the session payload in the backing store',
  )
  const persistedSessionId = Array.from(storedSessionMap.keys())[0]
  assert(
    typeof persistedSessionId === 'string' && persistedSessionId.length > 0,
    'storedSessions.start should create a backing-store session id',
  )
  const storedReadContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { authorization: `Bearer ${String(storedToken)}` },
    }),
  )
  const storedPayload = await storedStrategy.get({ context: storedReadContext })
  assert(
    asRecord(storedPayload).itemId === 'user_admin',
    'storedSessions.get should resolve sealed session ids through the backing store',
  )
  const storedCookieReadContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { cookie: `keystonejs-session=${String(storedToken)}` },
    }),
  )
  const storedCookiePayload = await storedStrategy.get({
    context: storedCookieReadContext,
  })
  assert(
    asRecord(storedCookiePayload).itemId === 'user_admin',
    'storedSessions.get should resolve sealed cookie session ids through the backing store',
  )
  const storedEndHeaders = new Headers()
  const storedEndContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { cookie: `keystonejs-session=${String(storedToken)}` },
    }),
    schema,
    storedEndHeaders,
  )
  await storedStrategy.end({ context: storedEndContext })
  assert(
    !storedSessionMap.has(persistedSessionId),
    'storedSessions.end should delete the backing store session',
  )
  assert(
    Boolean(
      storedEndHeaders.get('set-cookie')?.includes('keystonejs-session='),
    ),
    'storedSessions.end should clear the session cookie when response headers are available',
  )

  resetMemoryAdapter(emptySeed())
  const initContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { 'x-cms-anonymous': 'true' },
    }),
  )
  const redirectToInit = await execute(
    /* GraphQL */ `
      query ValidateInitRedirect {
        redirectToInit
      }
    `,
    undefined,
    initContext,
  )
  assert(
    redirectToInit.redirectToInit === true,
    'redirectToInit should be true when there are no users',
  )

  const initAdminMeta = await execute(
    /* GraphQL */ `
      query ValidateInitAdminMetaAccess {
        keystone {
          adminMeta {
            lists {
              key
            }
          }
        }
      }
    `,
    undefined,
    initContext,
  )
  assert(
    (
      (asRecord(asRecord(initAdminMeta.keystone).adminMeta).lists ??
        []) as Array<unknown>
    ).length > 0,
    'withAuth ui access should allow adminMeta during init-first-item mode',
  )

  const initial = await execute(
    /* GraphQL */ `
      mutation ValidateCreateInitialUser {
        createInitialUser(
          data: {
            name: "Initial Admin"
            email: "initial@example.com"
            password: "password"
          }
        ) {
          sessionToken
          item {
            id
            email
            role {
              id
              name
              canManagePeople
              canManageRoles
              canAccessDashboard
            }
            password {
              isSet
            }
          }
        }
      }
    `,
    undefined,
    initContext,
  )
  const initialResult = asRecord(initial.createInitialUser)
  assert(
    typeof initialResult.sessionToken === 'string' &&
      initialResult.sessionToken.length > 20,
    'createInitialUser should return a session token',
  )
  assert(
    asRecord(initialResult.item).email === 'initial@example.com',
    'createInitialUser should create the configured auth list item',
  )
  assert(
    asRecord(initialResult.item).role === null,
    'createInitialUser should apply target-list query access while resolving nested relationships in the anonymous init request',
  )
  const createdInitialUser = await initContext.sudo().db.User.findOne({
    where: { id: String(asRecord(initialResult.item).id) },
  })
  const createdInitialRole = await initContext
    .sudo()
    .adapter.resolveRelationship(
      'User',
      createdInitialUser as { id: string; [key: string]: unknown },
      cmsLists
        .find((entry) => entry.key === 'User')!
        .fields.find((field) => field.path === 'role')!,
      initContext.sudo(),
    )
  assert(
    asRecord(createdInitialRole[0]).canManagePeople === true,
    'createInitialUser should merge configured initFirstItem.itemData in persistence',
  )
  assert(
    asRecord(initialResult.item).password === null,
    'createInitialUser should respect password field read access in its returned item',
  )

  const noLongerRedirect = await execute(
    /* GraphQL */ `
      query ValidateInitComplete {
        redirectToInit
      }
    `,
    undefined,
    initContext,
  )
  assert(
    noLongerRedirect.redirectToInit === false,
    'redirectToInit should be false after createInitialUser creates the first user',
  )

  resetMemoryAdapter({
    ...emptySeed(),
    Role: [
      {
        id: 'role_reset',
        name: 'Reset Test Role',
        canAccessDashboard: true,
      },
    ],
    User: [
      {
        id: 'user_reset',
        name: 'Reset User',
        email: 'reset@example.com',
        password: await hashPassword('old-password'),
        role: 'role_reset',
        passwordResetToken: await hashPassword('valid-reset-token'),
        passwordResetIssuedAt: new Date().toISOString(),
        passwordResetRedeemedAt: null,
      },
    ],
  })
  const resetContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { 'x-cms-anonymous': 'true' },
    }),
  )
  const redeemed = await execute(
    /* GraphQL */ `
      mutation ValidateRedeemPasswordResetToken {
        redeemUserPasswordResetToken(
          email: "reset@example.com"
          token: "valid-reset-token"
          password: "new-password"
        ) {
          code
          message
        }
      }
    `,
    undefined,
    resetContext,
  )
  assert(
    redeemed.redeemUserPasswordResetToken === null,
    'valid password reset token should redeem successfully',
  )

  const oldPassword = await execute(
    /* GraphQL */ `
      mutation ValidateOldPasswordRejectedAfterReset {
        authenticateUserWithPassword(
          email: "reset@example.com"
          password: "old-password"
        ) {
          __typename
        }
      }
    `,
    undefined,
    resetContext,
  )
  assert(
    asRecord(oldPassword.authenticateUserWithPassword).__typename ===
      'UserAuthenticationWithPasswordFailure',
    'password reset should replace the old password',
  )

  const newPassword = await execute(
    /* GraphQL */ `
      mutation ValidateNewPasswordWorksAfterReset {
        authenticateUserWithPassword(
          email: "reset@example.com"
          password: "new-password"
        ) {
          __typename
          ... on UserAuthenticationWithPasswordSuccess {
            item {
              id
              email
            }
          }
        }
      }
    `,
    undefined,
    resetContext,
  )
  assert(
    asRecord(newPassword.authenticateUserWithPassword).__typename ===
      'UserAuthenticationWithPasswordSuccess',
    'password reset should allow authentication with the new password',
  )

  const replay = await execute(
    /* GraphQL */ `
      mutation ValidateRedeemedPasswordResetTokenRejected {
        redeemUserPasswordResetToken(
          email: "reset@example.com"
          token: "valid-reset-token"
          password: "replay-password"
        ) {
          code
          message
        }
      }
    `,
    undefined,
    resetContext,
  )
  assert(
    asRecord(replay.redeemUserPasswordResetToken).code === 'TOKEN_REDEEMED',
    'redeemed password reset token should return TOKEN_REDEEMED on replay',
  )

  resetMemoryAdapter({
    ...emptySeed(),
    User: [
      {
        id: 'user_expired_reset',
        name: 'Expired Reset User',
        email: 'expired-reset@example.com',
        password: await hashPassword('old-password'),
        passwordResetToken: await hashPassword('expired-reset-token'),
        passwordResetIssuedAt: new Date(
          Date.now() - 1000 * 60 * 11,
        ).toISOString(),
        passwordResetRedeemedAt: null,
      },
    ],
  })
  const expiredContext = await createCmsContext(
    new Request('http://local.test/api/graphql', {
      headers: { 'x-cms-anonymous': 'true' },
    }),
  )
  const expired = await execute(
    /* GraphQL */ `
      mutation ValidateExpiredPasswordResetTokenRejected {
        redeemUserPasswordResetToken(
          email: "expired-reset@example.com"
          token: "expired-reset-token"
          password: "new-password"
        ) {
          code
          message
        }
      }
    `,
    undefined,
    expiredContext,
  )
  assert(
    asRecord(expired.redeemUserPasswordResetToken).code === 'TOKEN_EXPIRED',
    'expired password reset token should return TOKEN_EXPIRED',
  )

  resetMemoryAdapter()
  console.info('CMS auth/session validation passed.')
}

await main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
