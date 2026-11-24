import { describe, expect, it } from 'vitest'

import { hasAnyDashboardFilters } from '../src/components/dashboard/filter-param-compat'

describe('dashboard filtered empty-state detection', () => {
  it('detects legacy !field_operator filters', () => {
    expect(hasAnyDashboardFilters({ '!status_matches': '"done"' })).toBe(true)
  })

  it('detects official-style filter params', () => {
    expect(
      hasAnyDashboardFilters({ filter: ['status_matches_["done"]'] }),
    ).toBe(true)
    expect(
      hasAnyDashboardFilters({ filter: 'label_contains_i_"Launch"' }),
    ).toBe(true)
  })

  it('ignores non-filter list state', () => {
    expect(hasAnyDashboardFilters({ search: 'launch' })).toBe(false)
    expect(
      hasAnyDashboardFilters({ page: 2, pageSize: 25, sortBy: '-createdAt' }),
    ).toBe(false)
    expect(hasAnyDashboardFilters({})).toBe(false)
  })
})
