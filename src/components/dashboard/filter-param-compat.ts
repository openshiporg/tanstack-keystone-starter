type SearchState = Record<string, unknown>

export type LegacyFilterEntry = {
  key: string
  fieldPath: string
  filterType: string
  rawValue: unknown
}

export function legacyFilterParamsFromSearch(search: SearchState) {
  return Object.entries(search)
    .filter(([key, value]) => key.startsWith('!') && value !== undefined)
    .map(([key, rawValue]) => {
      const match = /^!([^_]+)_(.+)$/.exec(key)
      if (!match) return null
      return {
        key,
        fieldPath: match[1],
        filterType: match[2],
        rawValue,
      }
    })
    .filter((entry): entry is LegacyFilterEntry => Boolean(entry))
}

export function officialFilterParamsFromSearch(search: SearchState) {
  const raw = search.filter
  const params = Array.isArray(raw)
    ? raw.map(String)
    : typeof raw === 'string'
      ? [raw]
      : []
  return params
}

export function hasAnyDashboardFilters(search: SearchState) {
  return (
    legacyFilterParamsFromSearch(search).length > 0 ||
    officialFilterParamsFromSearch(search).length > 0
  )
}

export function formatOfficialFilterParam(
  fieldPath: string,
  filterType: string,
  value: unknown,
  needsValue = true,
) {
  if (!needsValue) return `${fieldPath}_${filterType}`
  return `${fieldPath}_${filterType}_${JSON.stringify(value)}`
}

export function parseOfficialFilterParam(
  value: string,
  allowedFilterTypes: string[],
) {
  for (const filterType of allowedFilterTypes.sort(
    (left, right) => right.length - left.length,
  )) {
    const prefix = `_${filterType}`
    const index = value.indexOf(prefix)
    if (index === -1) continue
    const fieldPath = value.slice(0, index)
    const remainder = value.slice(index + prefix.length)
    if (!fieldPath) continue
    return {
      fieldPath,
      filterType,
      rawValue: remainder.startsWith('_')
        ? remainder.slice(1)
        : remainder || null,
    }
  }

  return null
}
