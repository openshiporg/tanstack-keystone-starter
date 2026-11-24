import { describe, expect, it } from 'vitest'

import {
  officialFilterParamsFromSearch,
  parseOfficialFilterParam,
} from '../src/components/dashboard/filter-param-compat'

describe('dashboard filter pill compatibility', () => {
  it('can read official-style filter entries from search state for UI rendering', () => {
    const filters = officialFilterParamsFromSearch({
      filter: ['label_contains_i_"Launch"', 'status_matches_["done"]'],
    })

    expect(filters).toEqual([
      'label_contains_i_"Launch"',
      'status_matches_["done"]',
    ])
  })

  it('parses official-style filter entries into field/type/value triplets for UI compatibility', () => {
    expect(
      parseOfficialFilterParam('label_contains_i_"Launch"', [
        'contains_i',
        'is_i',
      ]),
    ).toEqual({
      fieldPath: 'label',
      filterType: 'contains_i',
      rawValue: '"Launch"',
    })

    expect(
      parseOfficialFilterParam('status_matches_["done"]', [
        'matches',
        'not_matches',
      ]),
    ).toEqual({
      fieldPath: 'status',
      filterType: 'matches',
      rawValue: '["done"]',
    })

    expect(
      parseOfficialFilterParam('status_empty', ['matches', 'empty']),
    ).toEqual({
      fieldPath: 'status',
      filterType: 'empty',
      rawValue: null,
    })
  })
})
