import type { DashboardList } from '@/features/cms/graphql-client'

type SearchState = Record<string, unknown>

export function defaultListSearchState(
  list: Pick<DashboardList, 'initialColumns' | 'pageSize'>,
): SearchState {
  return {
    page: 1,
    pageSize: list.pageSize,
    search: '',
    sortBy: '',
    fields: '',
  }
}

export function isAtDefaultListState(
  list: Pick<DashboardList, 'initialColumns' | 'pageSize'>,
  search: SearchState,
) {
  return (
    (typeof search.search !== 'string' || search.search === '') &&
    (typeof search.sortBy !== 'string' || search.sortBy === '') &&
    (typeof search.fields !== 'string' || search.fields === '') &&
    (!Number.isFinite(Number(search.page)) || Number(search.page) === 1) &&
    (!Number.isFinite(Number(search.pageSize)) ||
      Number(search.pageSize) === list.pageSize) &&
    Object.keys(search).every(
      (key) => !key.startsWith('!') || search[key] === undefined,
    )
  )
}
