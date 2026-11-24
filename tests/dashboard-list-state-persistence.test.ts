import { describe, expect, it } from 'vitest'

import {
  hasExplicitListSearchState,
  hasExplicitListSearchStateInUrl,
  listStateStorageKey,
  mergeStoredListSearchState,
  pickPersistedListSearchState,
  stripPersistedListSearchState,
} from '../src/components/dashboard/list-state-persistence'

describe('dashboard list-state persistence helpers', () => {
  it('creates a stable per-list storage key', () => {
    expect(listStateStorageKey('todos')).toBe('dashboard-list-state:todos')
  })

  it('persists only list-state URL fields and filters', () => {
    expect(
      pickPersistedListSearchState({
        page: 2,
        pageSize: 50,
        search: 'launch',
        sortBy: '-createdAt',
        fields: 'label,status',
        column: ['label', 'status'],
        filter: ['label_contains_i_"Launch"'],
        '!status_matches': '"done"',
        unrelated: 'ignore-me',
      }),
    ).toEqual({
      page: 2,
      pageSize: 50,
      search: 'launch',
      sortBy: '-createdAt',
      fields: 'label,status',
      column: ['label', 'status'],
      filter: ['label_contains_i_"Launch"'],
      '!status_matches': '"done"',
    })
  })

  it('detects whether the current search object or raw URL already has explicit list state', () => {
    expect(hasExplicitListSearchState({})).toBe(false)
    expect(hasExplicitListSearchState({ unrelated: 'x' })).toBe(false)
    expect(hasExplicitListSearchState({ search: 'todos' })).toBe(true)
    expect(hasExplicitListSearchState({ '!status_matches': '"done"' })).toBe(
      true,
    )

    expect(hasExplicitListSearchStateInUrl('')).toBe(false)
    expect(hasExplicitListSearchStateInUrl('?foo=bar')).toBe(false)
    expect(hasExplicitListSearchStateInUrl('?search=todos')).toBe(true)
    expect(hasExplicitListSearchStateInUrl('?column=label')).toBe(true)
    expect(
      hasExplicitListSearchStateInUrl('?filter=label_contains_i_%22Launch%22'),
    ).toBe(true)
    expect(
      hasExplicitListSearchStateInUrl('?%21status_matches=%22done%22'),
    ).toBe(true)
  })

  it('strips persisted keys before merging stored state beneath explicit URL state', () => {
    expect(
      stripPersistedListSearchState({
        page: 1,
        search: 'url-search',
        '!status_matches': '"done"',
        unrelated: 'keep-me',
      }),
    ).toEqual({ unrelated: 'keep-me' })

    expect(
      mergeStoredListSearchState(
        {
          unrelated: 'keep-me',
          search: 'url-search',
          '!status_matches': '"done"',
        },
        {
          page: 3,
          pageSize: 100,
          search: 'stored-search',
          sortBy: '-createdAt',
          fields: 'label,status',
        },
      ),
    ).toEqual({
      unrelated: 'keep-me',
      search: 'stored-search',
      '!status_matches': '"done"',
      page: 3,
      pageSize: 100,
      sortBy: '-createdAt',
      fields: 'label,status',
    })
  })
})
