import { describe, expect, it } from 'vitest'

import { createAuthRateLimiter } from '../src/features/cms/auth/rate-limit'

describe('auth rate limiter', () => {
  it('allows the configured window then blocks without leaking account state', () => {
    let now = 1_000
    const limiter = createAuthRateLimiter({
      maxAttempts: 2,
      windowMs: 10_000,
      now: () => now,
    })

    expect(limiter.consume('login:account').allowed).toBe(true)
    expect(limiter.consume('login:account').allowed).toBe(true)
    expect(limiter.consume('login:account')).toMatchObject({
      allowed: false,
      remaining: 0,
    })
    expect(limiter.consume('login:other-account').allowed).toBe(true)

    now += 10_000
    expect(limiter.consume('login:account').allowed).toBe(true)
  })

  it('resets a successful identity window', () => {
    const limiter = createAuthRateLimiter({ maxAttempts: 1, windowMs: 10_000 })

    expect(limiter.consume('login:account').allowed).toBe(true)
    expect(limiter.consume('login:account').allowed).toBe(false)
    limiter.reset('login:account')
    expect(limiter.consume('login:account').allowed).toBe(true)
  })
})
