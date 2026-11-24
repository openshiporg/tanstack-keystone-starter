type SearchState = Record<string, unknown>

const SEARCH_STATE_KEYS = new Set([
  'page',
  'pageSize',
  'search',
  'sortBy',
  'fields',
  'column',
  'filter',
])

function isStoredFilterKey(key: string) {
  return key.startsWith('!')
}

function isPersistedListStateKey(key: string) {
  return SEARCH_STATE_KEYS.has(key) || isStoredFilterKey(key)
}

export function listStateStorageKey(listPath: string) {
  return `dashboard-list-state:${listPath}`
}

export function pickPersistedListSearchState(search: SearchState) {
  const entries = Object.entries(search).filter(([key, value]) => {
    if (value === undefined) return false
    return isPersistedListStateKey(key)
  })
  return Object.fromEntries(entries)
}

export function stripPersistedListSearchState(search: SearchState) {
  return Object.fromEntries(
    Object.entries(search).filter(([key]) => !isPersistedListStateKey(key)),
  )
}

export function mergeStoredListSearchState(
  currentWithoutPersistedState: SearchState,
  stored: SearchState,
) {
  const merged: SearchState = { ...currentWithoutPersistedState, ...stored }
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === '') delete merged[key]
  }
  return merged
}

export function hasExplicitListSearchState(search: SearchState) {
  return Object.entries(search).some(
    ([key, value]) =>
      value !== undefined && value !== '' && isPersistedListStateKey(key),
  )
}

export function hasExplicitListSearchStateInUrl(
  search: string | URLSearchParams,
) {
  const params =
    typeof search === 'string' ? new URLSearchParams(search) : search
  for (const key of params.keys()) {
    if (isPersistedListStateKey(key)) return true
  }
  return false
}
