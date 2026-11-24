type SearchState = Record<string, unknown>

export function normalizeListSearchForUrl(
  search: SearchState,
  options: { defaultPageSize: number },
) {
  const next = { ...search }

  if (Number(next.page) <= 1 || !Number.isFinite(Number(next.page)))
    delete next.page
  if (
    Number(next.pageSize) === options.defaultPageSize ||
    !Number.isFinite(Number(next.pageSize))
  )
    delete next.pageSize

  if (next.search === '') delete next.search
  if (next.sortBy === '') delete next.sortBy
  if (next.fields === '') delete next.fields

  if (Array.isArray(next.column) && next.column.length === 0) delete next.column
  if (Array.isArray(next.filter) && next.filter.length === 0) delete next.filter

  return next
}
