import { describe, expect, it } from 'vitest'

import {
  DASHBOARD_PAGE_SIZES,
  normalizeDashboardPageSize,
  snapPageSizeToClosest,
} from '../src/components/dashboard/page-size'

describe('dashboard page-size semantics', () => {
  it('uses the Keystone-style supported page sizes', () => {
    expect(DASHBOARD_PAGE_SIZES).toEqual([10, 25, 50, 100])
  })

  it('snaps arbitrary values to the closest supported page size', () => {
    expect(snapPageSizeToClosest(1)).toBe(10)
    expect(snapPageSizeToClosest(11)).toBe(10)
    expect(snapPageSizeToClosest(24)).toBe(25)
    expect(snapPageSizeToClosest(40)).toBe(50)
    expect(snapPageSizeToClosest(80)).toBe(100)
  })

  it('normalizes invalid or missing input to the fallback size', () => {
    expect(normalizeDashboardPageSize(undefined, 50)).toBe(50)
    expect(normalizeDashboardPageSize('not-a-number', 25)).toBe(25)
    expect(normalizeDashboardPageSize(0, 25)).toBe(25)
  })

  it('normalizes valid input through the closest supported page size', () => {
    expect(normalizeDashboardPageSize('26', 50)).toBe(25)
    expect(normalizeDashboardPageSize(49, 25)).toBe(50)
    expect(normalizeDashboardPageSize(101, 25)).toBe(100)
  })
})
