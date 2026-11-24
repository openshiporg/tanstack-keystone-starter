import { describe, expect, it } from 'vitest'

import { getPasswordResetIssuedAtMs } from '../src/features/cms/auth/graphql'

describe('password reset timestamp compatibility', () => {
  it('accepts Prisma Date values and memory/string values', () => {
    const issuedAt = new Date('2026-01-02T03:04:05.000Z')

    expect(getPasswordResetIssuedAtMs(issuedAt)).toBe(issuedAt.getTime())
    expect(getPasswordResetIssuedAtMs(issuedAt.toISOString())).toBe(
      issuedAt.getTime(),
    )
  })

  it('rejects missing and malformed timestamps', () => {
    expect(getPasswordResetIssuedAtMs(undefined)).toBeUndefined()
    expect(getPasswordResetIssuedAtMs('not-a-date')).toBeUndefined()
  })
})
