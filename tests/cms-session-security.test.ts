import { afterEach, describe, expect, it } from 'vitest'

import type { CmsContext } from '../src/features/cms/adapters'
import { statelessSessions } from '../src/features/cms/auth/session'

const originalNodeEnv = process.env.NODE_ENV
const originalSessionSecret = process.env.SESSION_SECRET
const originalTrustProxy = process.env.CMS_TRUST_PROXY

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = originalNodeEnv
  if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET
  else process.env.SESSION_SECRET = originalSessionSecret
  if (originalTrustProxy === undefined) delete process.env.CMS_TRUST_PROXY
  else process.env.CMS_TRUST_PROXY = originalTrustProxy
})

function sessionContext() {
  return {
    __internal: { responseHeaders: new Headers() },
  } as unknown as CmsContext
}

describe('production session secret hardening', () => {
  it('refuses to create a production session without SESSION_SECRET', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.SESSION_SECRET
    const strategy = statelessSessions<{ itemId: string }>()

    await expect(
      strategy.start({ data: { itemId: 'user_1' }, context: sessionContext() }),
    ).rejects.toThrow('SESSION_SECRET is required in production')
  })

  it('derives Secure from a trusted proxy protocol in development', async () => {
    process.env.NODE_ENV = 'development'
    const strategy = statelessSessions<{ itemId: string }>({
      secret: 'a-session-secret-that-is-at-least-32-characters-long',
      trustProxy: true,
    })
    const httpsHeaders = new Headers()
    await strategy.start({
      data: { itemId: 'user_1' },
      context: {
        __internal: {
          request: new Request('http://internal.test', {
            headers: { 'x-forwarded-proto': 'https' },
          }),
          responseHeaders: httpsHeaders,
        },
      } as unknown as CmsContext,
    })
    expect(httpsHeaders.get('set-cookie')).toContain('Secure')

    const httpHeaders = new Headers()
    await strategy.start({
      data: { itemId: 'user_1' },
      context: {
        __internal: {
          request: new Request('http://internal.test', {
            headers: { 'x-forwarded-proto': 'http' },
          }),
          responseHeaders: httpHeaders,
        },
      } as unknown as CmsContext,
    })
    expect(httpHeaders.get('set-cookie')).not.toContain('Secure')
  })

  it('rejects a cookie signed with a rotated session secret', async () => {
    const oldStrategy = statelessSessions<{ itemId: string }>({
      secret: 'old-session-secret-that-is-at-least-32-characters-long',
    })
    const oldToken = await oldStrategy.start({
      data: { itemId: 'user_1' },
      context: sessionContext(),
    })
    const rotatedStrategy = statelessSessions<{ itemId: string }>({
      secret: 'new-session-secret-that-is-at-least-32-characters-long',
    })

    const rotatedContext = {
      __internal: {
        request: new Request('http://local.test', {
          headers: { cookie: `keystonejs-session=${oldToken}` },
        }),
      },
    } as unknown as CmsContext

    await expect(
      rotatedStrategy.get({ context: rotatedContext }),
    ).resolves.toBe(undefined)
  })

  it('accepts a strong production SESSION_SECRET at session start time', async () => {
    process.env.NODE_ENV = 'production'
    process.env.SESSION_SECRET =
      'a-production-session-secret-that-is-at-least-32-characters'
    const context = sessionContext()
    const strategy = statelessSessions<{ itemId: string }>()

    await expect(
      strategy.start({ data: { itemId: 'user_1' }, context }),
    ).resolves.toMatch(/^v1\./)
    expect(context.__internal.responseHeaders?.get('set-cookie')).toContain(
      'Secure',
    )
  })

  it('ignores forwarded protocol headers unless proxy trust is explicitly enabled', async () => {
    process.env.NODE_ENV = 'development'
    const strategy = statelessSessions<{ itemId: string }>({
      secret: 'a-session-secret-that-is-at-least-32-characters-long',
    })
    const headers = new Headers()
    await strategy.start({
      data: { itemId: 'user_1' },
      context: {
        __internal: {
          request: new Request('http://internal.test', {
            headers: { 'x-forwarded-proto': 'https' },
          }),
          responseHeaders: headers,
        },
      } as unknown as CmsContext,
    })

    expect(headers.get('set-cookie')).not.toContain('Secure')
  })
})
