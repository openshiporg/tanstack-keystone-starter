import { describe, expect, it } from 'vitest'
import { filterBarSearchPlaceholder } from '../src/components/dashboard/filter-bar'

describe('dashboard filter bar', () => {
  it('builds a search placeholder from filterable field labels', () => {
    expect(filterBarSearchPlaceholder(['Title', 'Status', 'Assigned To'])).toBe(
      'Search by title, status, assigned to',
    )
  })

  it('falls back to id when there are no searchable labels', () => {
    expect(filterBarSearchPlaceholder([])).toBe('Search by id')
  })

  it('normalizes placeholder copy the same way FilterBar search UI expects', () => {
    expect(filterBarSearchPlaceholder(['Title', 'Status'])).toBe(
      'Search by title, status',
    )
    expect(filterBarSearchPlaceholder(['Assigned To'])).toBe(
      'Search by assigned to',
    )
  })
})
