import { describe, expect, it } from 'vitest'

import { normalizeListSearchForUrl } from '../src/components/dashboard/list-search-url'

describe('dashboard list search URL normalization', () => {
  it('removes default page and pageSize values from the URL state', () => {
    expect(
      normalizeListSearchForUrl(
        {
          page: 1,
          pageSize: 50,
          search: '',
          sortBy: '',
          fields: '',
          column: [],
          filter: [],
        },
        { defaultPageSize: 50 },
      ),
    ).toEqual({})
  })

  it('preserves meaningful non-default list state', () => {
    expect(
      normalizeListSearchForUrl(
        {
          page: 2,
          pageSize: 25,
          search: 'launch',
          sortBy: '-createdAt',
          fields: 'label,status',
          column: ['label', 'status'],
          filter: ['label_contains_i_"Launch"'],
        },
        { defaultPageSize: 50 },
      ),
    ).toEqual({
      page: 2,
      pageSize: 25,
      search: 'launch',
      sortBy: '-createdAt',
      fields: 'label,status',
      column: ['label', 'status'],
      filter: ['label_contains_i_"Launch"'],
    })
  })
})
