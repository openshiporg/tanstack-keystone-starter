import { describe, expect, it } from 'vitest'

import {
  buildOrderBy,
  resolveEffectiveSortToken,
} from '../src/features/cms/graphql-client'

const baseList = {
  fields: [
    { path: 'id', isOrderable: true },
    { path: 'label', isOrderable: true },
    { path: 'createdAt', isOrderable: true },
  ],
} as any

describe('dashboard sort semantics', () => {
  it('uses explicit sortBy when provided', () => {
    const list = { ...baseList, initialSort: null }
    expect(resolveEffectiveSortToken(list, '-label')).toBe('-label')
    expect(buildOrderBy(list, '-label')).toEqual([{ label: 'desc' }])
  })

  it('falls back to initialSort when no explicit sortBy exists', () => {
    const list = {
      ...baseList,
      initialSort: { field: 'createdAt', direction: 'DESC' },
    }
    expect(resolveEffectiveSortToken(list, '')).toBe('-createdAt')
    expect(buildOrderBy(list, '')).toEqual([{ createdAt: 'desc' }])
  })

  it('does not invent a fallback sort when neither sortBy nor initialSort exists', () => {
    const list = { ...baseList, initialSort: null }
    expect(resolveEffectiveSortToken(list, '')).toBe('')
    expect(buildOrderBy(list, '')).toBeUndefined()
  })

  it('does not apply an invalid explicit sort field', () => {
    const list = { ...baseList, initialSort: null }
    expect(resolveEffectiveSortToken(list, '-missing')).toBe('')
    expect(buildOrderBy(list, '-missing')).toBeUndefined()
  })
})
