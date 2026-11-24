export const DASHBOARD_PAGE_SIZES = [10, 25, 50, 100] as const

export function snapPageSizeToClosest(
  input: number,
  range: readonly number[] = DASHBOARD_PAGE_SIZES,
) {
  return range.reduce((previous, current) =>
    Math.abs(current - input) < Math.abs(previous - input) ? current : previous,
  )
}

export function normalizeDashboardPageSize(value: unknown, fallback: number) {
  const parsed =
    typeof value === 'string' ? Number.parseInt(value, 10) : Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return snapPageSizeToClosest(parsed)
}
