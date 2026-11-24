import { graphql } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'

import { config, initialiseLists } from '../src/features/cms/config'
import { addAuthGraphQLSchema } from '../src/features/cms/auth/graphql'
import { createAuth } from '../src/features/cms/keystone/auth'
import { password, text } from '../src/features/cms/keystone/fields'
import {
  createCmsContext,
  generateCmsResolversForLists,
  generateCmsTypeDefsForLists,
  getCmsGraphQLSchema,
} from '../src/features/cms/runtime'
import { createPrismaCmsAdapter } from '../src/features/cms/adapters/prisma'
import { setCmsAdapterForTests } from '../src/features/cms/adapters'
import { statelessSessions } from '../src/features/cms/auth/session'
import { hashPassword } from '../src/features/cms/auth/password'
import { createCmsPrismaClient } from '../src/features/cms/prisma-client'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

async function main() {
  const mode = process.env.GAP09_MODE
  if (mode === 'legacy') {
    const encoder = new TextEncoder()
    const toBase64Url = (bytes: Uint8Array) => {
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '')
    }
    const payload = toBase64Url(
      encoder.encode(
        JSON.stringify({
          data: { listKey: 'User', itemId: 'user_admin' },
          exp: Date.now() + 60_000,
        }),
      ),
    )
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(process.env.SESSION_SECRET ?? ''),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const signature = toBase64Url(
      new Uint8Array(
        await crypto.subtle.sign('HMAC', key, encoder.encode(payload)),
      ),
    )
    const strategy = statelessSessions<{ listKey: string; itemId: string }>()
    const session = await strategy.get({
      context: {
        __internal: {
          request: new Request('http://cms.local', {
            headers: { cookie: `keystonejs-session=${payload}.${signature}` },
          }),
        },
      } as never,
    })
    assert(
      session?.itemId === 'user_admin',
      'legacy Keystone session token was not accepted',
    )
    console.log(JSON.stringify({ mode, itemId: session.itemId }))
    return
  }

  if (mode === 'proxy') {
    const strategy = statelessSessions<{ itemId: string }>({ trustProxy: true })
    const secureHeaders = new Headers()
    const insecureHeaders = new Headers()
    const base = (protocol: string, headers: Headers) => ({
      __internal: {
        request: new Request('http://internal.cms', {
          headers: { 'x-forwarded-proto': protocol },
        }),
        responseHeaders: headers,
      },
    })
    await strategy.start({
      data: { itemId: 'user_admin' },
      context: base('https', secureHeaders) as never,
    })
    await strategy.start({
      data: { itemId: 'user_admin' },
      context: base('http', insecureHeaders) as never,
    })
    assert(
      secureHeaders.get('set-cookie')?.includes('Secure'),
      'trusted HTTPS proxy should set Secure',
    )
    assert(
      !insecureHeaders.get('set-cookie')?.includes('Secure'),
      'trusted HTTP proxy should not set Secure',
    )
    console.log(JSON.stringify({ mode, httpsSecure: true, httpSecure: false }))
    return
  }

  if (mode === 'arbitrary') {
    const { withAuth } = createAuth({
      listKey: 'Account',
      identityField: 'handle',
      secretField: 'credential',
      sessionData: 'id handle',
    })
    const customConfig = withAuth(
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
          get: async () => undefined,
          start: async () => 'arbitrary-session-token',
          end: async () => undefined,
        },
      }),
    )
    const lists = initialiseLists(customConfig)
    const baseSchema = makeExecutableSchema({
      typeDefs: generateCmsTypeDefsForLists(lists),
      resolvers: generateCmsResolversForLists(lists),
    })
    const schema = addAuthGraphQLSchema(baseSchema, lists, customConfig.auth)
    const result = await graphql({
      schema,
      source: /* GraphQL */ `
        mutation ArbitraryAuth {
          authenticateAccountWithPassword(
            handle: "operator"
            credential: "account-secret"
          ) {
            __typename
            ... on AccountAuthenticationWithPasswordSuccess {
              item {
                handle
              }
            }
          }
        }
      `,
      contextValue: {
        adapter: {
          findUnique: async () => ({
            id: 'account_1',
            handle: 'operator',
            credential: await hashPassword('account-secret'),
          }),
        },
        __internal: { sudo: true, lists },
        sessionStrategy: customConfig.session,
        sudo() {
          return this
        },
      },
    })
    if (result.errors?.length)
      throw new Error(result.errors.map((error) => error.message).join('\n'))
    const auth = record(record(result.data).authenticateAccountWithPassword)
    assert(
      auth.__typename === 'AccountAuthenticationWithPasswordSuccess',
      'arbitrary Account.handle/credential authentication failed',
    )
    console.log(
      JSON.stringify({
        mode,
        listKey: 'Account',
        identityField: 'handle',
        secretField: 'credential',
        authenticated: true,
      }),
    )
    return
  }

  if (mode === 'reset-enumeration') {
    const sentTokens: string[] = []
    const updates: Array<Record<string, unknown>> = []
    const { withAuth } = createAuth({
      listKey: 'Account',
      identityField: 'handle',
      secretField: 'credential',
      passwordResetLink: {
        sendToken: async ({ token }) => {
          sentTokens.push(token)
        },
      },
    })
    const customConfig = withAuth(
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
          get: async () => undefined,
          start: async () => 'reset-enumeration-session',
          end: async () => undefined,
        },
      }),
    )
    const lists = initialiseLists(customConfig)
    const baseSchema = makeExecutableSchema({
      typeDefs: generateCmsTypeDefsForLists(lists),
      resolvers: generateCmsResolversForLists(lists),
    })
    const schema = addAuthGraphQLSchema(baseSchema, lists, customConfig.auth)
    const account = {
      id: 'account_known',
      handle: 'known-account',
      credential: await hashPassword('known-secret'),
    }
    const adapter = {
      findUnique: async (_listKey: string, where: Record<string, unknown>) =>
        where.handle === account.handle ? account : null,
      update: async (
        _listKey: string,
        args: { data: Record<string, unknown> },
      ) => {
        updates.push(args.data)
        return { ...account, ...args.data }
      },
    }
    const context = {
      adapter,
      __internal: { sudo: true, lists },
      sessionStrategy: customConfig.session,
      sudo() {
        return this
      },
    }
    const send = async (handle: string) => {
      const result = await graphql({
        schema,
        source: `mutation SendReset { sendAccountPasswordResetLink(handle: "${handle}") }`,
        contextValue: context,
      })
      if (result.errors?.length)
        throw new Error(result.errors.map((error) => error.message).join('\n'))
      return record(result.data).sendAccountPasswordResetLink
    }
    const unknownResponse = await send('missing-account')
    const knownResponse = await send(account.handle)
    assert(unknownResponse === true, 'unknown reset response was not generic')
    assert(knownResponse === true, 'known reset response was not generic')
    assert(sentTokens.length === 1, 'known reset did not invoke the token hook')
    const knownUpdate = updates[0] ?? {}
    assert(
      typeof knownUpdate.passwordResetToken === 'string' &&
        typeof knownUpdate.passwordResetIssuedAt === 'string' &&
        knownUpdate.passwordResetRedeemedAt === null,
      'known reset did not store reset state',
    )
    assert(updates.length === 1, 'unknown reset unexpectedly changed state')
    console.log(
      JSON.stringify({
        mode,
        unknownResponse,
        knownResponse,
        hookCalls: sentTokens.length,
        knownTokenStored: true,
        unknownTokenStored: false,
      }),
    )
    return
  }

  const prisma = createCmsPrismaClient()
  setCmsAdapterForTests(createPrismaCmsAdapter({ prisma }))
  const schema = getCmsGraphQLSchema()

  async function execute(
    request: Request,
    source: string,
    responseHeaders?: Headers,
  ) {
    const context = await createCmsContext(request, schema, responseHeaders)
    const result = await graphql({ schema, source, contextValue: context })
    if (result.errors?.length)
      throw new Error(result.errors.map((error) => error.message).join('\n'))
    return record(result.data)
  }

  try {
    if (mode === 'login') {
      const headers = new Headers()
      const data = await execute(
        new Request('http://cms.local/api/graphql', {
          headers: { 'x-cms-anonymous': 'true' },
        }),
        /* GraphQL */ `
          mutation ContinuityLogin {
            authenticateUserWithPassword(
              email: "ada@example.com"
              password: "password"
            ) {
              __typename
              ... on UserAuthenticationWithPasswordSuccess {
                sessionToken
                item {
                  id
                }
              }
              ... on UserAuthenticationWithPasswordFailure {
                message
              }
            }
          }
        `,
        headers,
      )
      const auth = record(data.authenticateUserWithPassword)
      assert(
        auth.__typename === 'UserAuthenticationWithPasswordSuccess',
        'first process login failed',
      )
      const cookie = headers.get('set-cookie') ?? ''
      assert(
        cookie.includes('keystonejs-session='),
        'first process did not issue the session cookie',
      )
      console.log(
        JSON.stringify({
          mode,
          cookie,
          token: auth.sessionToken,
          itemId: record(auth.item).id,
        }),
      )
      return
    }

    if (mode === 'init') {
      const headers = new Headers()
      const data = await execute(
        new Request('http://cms.local/api/graphql', {
          headers: { 'x-cms-anonymous': 'true' },
        }),
        /* GraphQL */ `
          mutation Init {
            createInitialUser(
              data: {
                name: "Initial Admin"
                email: "init@example.com"
                password: "init-password"
              }
            ) {
              item {
                id
                email
              }
            }
          }
        `,
        headers,
      )
      const item = record(record(data.createInitialUser).item)
      assert(
        typeof item.id === 'string' && item.id.length > 0,
        'initial user id was not persisted',
      )
      assert(
        headers.get('set-cookie')?.includes('keystonejs-session='),
        'initial user creation did not issue a cookie',
      )
      console.log(JSON.stringify({ mode, itemId: item.id }))
      return
    }

    if (mode === 'signout') {
      const cookie = process.env.GAP09_COOKIE
      assert(cookie, 'GAP09_COOKIE is required for signout')
      const headers = new Headers()
      const data = await execute(
        new Request('http://cms.local/api/graphql', { headers: { cookie } }),
        'mutation { endSession }',
        headers,
      )
      assert(data.endSession === true, 'endSession did not return true')
      assert(
        headers.get('set-cookie')?.includes('Max-Age=0'),
        'signout did not clear the cookie',
      )
      const anonymous = await execute(
        new Request('http://cms.local/api/graphql'),
        'query { authenticatedItem { __typename } }',
      )
      assert(
        anonymous.authenticatedItem === null,
        'signout did not leave an anonymous request',
      )
      console.log(JSON.stringify({ mode, ended: true, anonymous: true }))
      return
    }

    if (mode === 'read' || mode === 'rotated') {
      const cookie = process.env.GAP09_COOKIE
      assert(cookie, 'GAP09_COOKIE is required for a second-process read')
      const data = await execute(
        new Request('http://cms.local/api/graphql', { headers: { cookie } }),
        /* GraphQL */ `
          query ContinuityRead {
            authenticatedItem {
              ... on User {
                id
                email
              }
            }
          }
        `,
      )
      const item = record(data.authenticatedItem)
      if (mode === 'read')
        assert(
          item.id === 'user_admin',
          'second process could not hydrate the shared-cookie session',
        )
      else
        assert(!item.id, 'rotated secret unexpectedly accepted the old cookie')
      console.log(JSON.stringify({ mode, itemId: item.id ?? null }))
      return
    }

    if (mode === 'reset') {
      const resetToken = 'gap09-reset-token'
      await prisma.user.update({
        where: { id: 'user_admin' },
        data: {
          passwordResetToken: await hashPassword(resetToken),
          passwordResetIssuedAt: new Date(),
          passwordResetRedeemedAt: null,
        },
      })
      const request = new Request('http://cms.local/api/graphql', {
        headers: { 'x-cms-anonymous': 'true' },
      })
      const redeemed = await execute(
        request,
        /* GraphQL */ `mutation Reset { redeemUserPasswordResetToken(email: "ada@example.com", token: "${resetToken}", password: "continuity-new-password") { code message } }`,
      )
      assert(
        redeemed.redeemUserPasswordResetToken === null,
        'valid reset token did not redeem',
      )
      const oldPassword = await execute(
        request,
        /* GraphQL */ `
          mutation OldPassword {
            authenticateUserWithPassword(
              email: "ada@example.com"
              password: "password"
            ) {
              __typename
            }
          }
        `,
      )
      assert(
        record(oldPassword.authenticateUserWithPassword).__typename ===
          'UserAuthenticationWithPasswordFailure',
        'old password remained valid after reset',
      )
      const newPassword = await execute(
        request,
        /* GraphQL */ `
          mutation NewPassword {
            authenticateUserWithPassword(
              email: "ada@example.com"
              password: "continuity-new-password"
            ) {
              __typename
            }
          }
        `,
      )
      assert(
        record(newPassword.authenticateUserWithPassword).__typename ===
          'UserAuthenticationWithPasswordSuccess',
        'new password did not authenticate after reset',
      )
      const replay = await execute(
        request,
        /* GraphQL */ `mutation Replay { redeemUserPasswordResetToken(email: "ada@example.com", token: "${resetToken}", password: "another-password") { code message } }`,
      )
      assert(
        record(replay.redeemUserPasswordResetToken).code === 'TOKEN_REDEEMED',
        'reset token replay was not rejected',
      )
      await prisma.user.update({
        where: { id: 'user_admin' },
        data: {
          password: await hashPassword('password'),
          passwordResetToken: await hashPassword('expired-token'),
          passwordResetIssuedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
          passwordResetRedeemedAt: null,
        },
      })
      const expired = await execute(
        request,
        /* GraphQL */ `
          mutation Expired {
            redeemUserPasswordResetToken(
              email: "ada@example.com"
              token: "expired-token"
              password: "another-password"
            ) {
              code
              message
            }
          }
        `,
      )
      assert(
        record(expired.redeemUserPasswordResetToken).code === 'TOKEN_EXPIRED',
        'expired reset token was not rejected',
      )
      console.log(
        JSON.stringify({
          mode,
          redeemed: true,
          replay: 'TOKEN_REDEEMED',
          expired: 'TOKEN_EXPIRED',
        }),
      )
      return
    }

    if (mode === 'rate') {
      const request = new Request('http://cms.local/api/graphql', {
        headers: { 'x-cms-anonymous': 'true' },
      })
      const failures = []
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const result = await execute(
          request,
          /* GraphQL */ `mutation Failure${attempt} { authenticateUserWithPassword(email: "ada@example.com", password: "wrong-${attempt}") { __typename ... on UserAuthenticationWithPasswordFailure { message } } }`,
        )
        const failure = record(result.authenticateUserWithPassword)
        failures.push({ type: failure.__typename, message: failure.message })
      }
      assert(
        failures.every(
          (failure) =>
            failure.type === 'UserAuthenticationWithPasswordFailure' &&
            failure.message === 'Authentication failed.',
        ),
        'auth failures must remain generic under rate limiting',
      )
      const blockedSuccess = await execute(
        request,
        /* GraphQL */ `
          mutation BlockedSuccess {
            authenticateUserWithPassword(
              email: "ada@example.com"
              password: "password"
            ) {
              __typename
            }
          }
        `,
      )
      assert(
        record(blockedSuccess.authenticateUserWithPassword).__typename ===
          'UserAuthenticationWithPasswordFailure',
        'rate limiter did not block a credential after repeated failures',
      )
      console.log(
        JSON.stringify({
          mode,
          attempts: failures.length,
          genericFailure: true,
          blocked: true,
        }),
      )
      return
    }

    throw new Error(`Unknown GAP09 mode: ${mode}`)
  } finally {
    await prisma.$disconnect()
  }
}

await main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
