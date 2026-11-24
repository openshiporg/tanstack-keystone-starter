import { describe, expect, it } from 'vitest'

import {
  defaultListSearchState,
  isAtDefaultListState,
} from '../src/components/dashboard/list-state-defaults'

describe('dashboard list-state defaults', () => {
  const list = { initialColumns: ['label'], pageSize: 50 }

  it('returns the canonical default list search state', () => {
    expect(defaultListSearchState(list as any)).toEqual({
      page: 1,
      pageSize: 50,
      search: '',
      sortBy: '',
      fields: '',
    })
  })

  it('detects default list state correctly', () => {
    expect(isAtDefaultListState(list as any, {})).toBe(true)
    expect(
      isAtDefaultListState(list as any, {
        page: 1,
        pageSize: 50,
        search: '',
        sortBy: '',
        fields: '',
      }),
    ).toBe(true)
    expect(
      isAtDefaultListState(list as any, { '!status_matches': undefined }),
    ).toBe(true)
  })

  it('detects when list state is dirty', () => {
    expect(isAtDefaultListState(list as any, { page: 2 })).toBe(false)
    expect(isAtDefaultListState(list as any, { pageSize: 25 })).toBe(false)
    expect(isAtDefaultListState(list as any, { search: 'todo' })).toBe(false)
    expect(isAtDefaultListState(list as any, { sortBy: '-createdAt' })).toBe(
      false,
    )
    expect(isAtDefaultListState(list as any, { fields: 'label,status' })).toBe(
      false,
    )
    expect(
      isAtDefaultListState(list as any, { '!status_matches': '"done"' }),
    ).toBe(false)
  })
})
