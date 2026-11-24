export type AuthRateLimitOptions = {
  maxAttempts: number
  windowMs: number
  now?: () => number
}

export type AuthRateLimitDecision = {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

type Window = { count: number; expiresAt: number }

export function createAuthRateLimiter(options: AuthRateLimitOptions) {
  if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1)
    throw new TypeError(
      'auth rate-limit maxAttempts must be a positive integer',
    )
  if (!Number.isFinite(options.windowMs) || options.windowMs <= 0)
    throw new TypeError('auth rate-limit windowMs must be positive')

  const now = options.now ?? Date.now
  const windows = new Map<string, Window>()

  function consume(key: string): AuthRateLimitDecision {
    const currentTime = now()
    const current = windows.get(key)
    const window =
      current && current.expiresAt > currentTime
        ? current
        : { count: 0, expiresAt: currentTime + options.windowMs }
    window.count += 1
    windows.set(key, window)
    const allowed = window.count <= options.maxAttempts
    return {
      allowed,
      remaining: Math.max(0, options.maxAttempts - window.count),
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((window.expiresAt - currentTime) / 1000),
      ),
    }
  }

  function reset(key: string) {
    windows.delete(key)
  }

  return { consume, reset }
}
