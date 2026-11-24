# Code Context

## Files Retrieved
1. `src/components/dashboard/keystone-list-table.tsx` (lines 1-210, 281-332) - target list table handles bulk delete, table rendering, row/action links, and currently attempts refresh after delete via navigation instead of query invalidation.
2. `src/features/cms/graphql-client.ts` (lines 84-90, 221-331, 360-425) - target React Query key shape for list pages and selected field resolution.
3. `src/routes/dashboard/$listKey.tsx` (lines 1-106) - target list route uses `useQuery` keyed by `dashboardQueryKeys.listPage(params.listKey, search)` with `initialData`.
4. `../next-keystone-starter/features/dashboard/components/ListTable.tsx` (lines 1-120) - reference implementation invalidates the list items query cache after bulk delete.
5. `../next-keystone-starter/features/dashboard/hooks/useListItems.query.ts` (lines 1-44) - reference app’s list data is explicitly React Query-driven, confirming cache invalidation is the intended refresh mechanism.
6. `../next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx` (lines 1-226) - reference list page consumes the query hook and relies on query invalidation for list refresh.

## Key Code

### Target currently does not invalidate the list-page query after bulk delete
`src/components/dashboard/keystone-list-table.tsx:34-48`
```ts
async function deleteSelectedItems() {
  const ids = Array.from(selectedItemsState.selectedItems)
  if (ids.length === 0) return
  setDeleting(true)
  setBulkMessage(null)
  try {
    await executeDashboardGraphQL(
      `mutation DashboardBulkDelete($where: [${data.list.gqlNames.whereUniqueInputName}!]!) {
        ${data.list.gqlNames.deleteManyMutationName}(where: $where) { id }
      }`,
      { where: ids.map((id) => ({ id })) },
    )
    setSelectedItems({ itemsFromServer: undefined, selectedItems: new Set() })
    await navigate({ search: (previous) => ({ ...previous }) })
  } catch (error) {
```
This re-navigates to the same search state. Because the route/query key is unchanged, it is not a reliable parity-equivalent cache refresh.

### Target list data is cached under a stable React Query key
`src/features/cms/graphql-client.ts:84-89`
```ts
export const dashboardQueryKeys = {
  adminMeta: ['dashboard', 'adminMeta'] as const,
  overview: ['dashboard', 'overview'] as const,
  listPage: (listPath: string, searchState: Record<string, unknown>) =>
    ['dashboard', 'listPage', listPath, stableSearchState(searchState)] as const,
```
`src/routes/dashboard/$listKey.tsx:49-66`
```ts
const { data, isFetching, error } = useQuery({
  queryKey: dashboardQueryKeys.listPage(params.listKey, search),
  queryFn: () =>
    fetchDashboardListPage({
      listPath: params.listKey,
      page: search.page,
      pageSize: search.pageSize,
      search: search.search,
      sortBy: search.sortBy,
      fields: search.fields,
      filters: search,
    }),
  initialData: loaderData,
})
```
The correct refresh point is therefore the `dashboardQueryKeys.listPage(...)` cache entry, not same-URL navigation.

### Reference starter explicitly invalidates list query cache after delete
`../next-keystone-starter/features/dashboard/components/ListTable.tsx:105-109`
```ts
await queryClient.invalidateQueries({
  queryKey: ['lists', list.key, 'items']
});
```
The exact key shape differs in target, but the behavior gap is the same: explicit invalidation after mutation.

## Architecture
- In target, the list page is loaded by `src/routes/dashboard/$listKey.tsx`.
- That route hydrates a React Query entry keyed by `dashboardQueryKeys.listPage(listPath, searchState)`.
- `KeystoneListTable` receives the query result object and performs bulk deletion locally via `executeDashboardGraphQL`.
- After mutation, target currently tries to refresh by navigating to the same route/search.
- Since the list page is already backed by React Query, the parity-safe refresh path is to invalidate/refetch the matching `dashboardQueryKeys.listPage(...)` entries for the current list.

## Start Here
Open `src/components/dashboard/keystone-list-table.tsx` first. That is where the post-delete refresh logic lives, and it is the smallest, most concrete parity gap still visible in this area.

## Next single concrete fixable parity gap
**Gap:** Bulk delete in target does not explicitly invalidate the React Query list-page cache after mutation, unlike the reference app. This can leave stale rows/counts visible until some later navigation or remount.

### Minimal implementation
1. In `src/components/dashboard/keystone-list-table.tsx`:
   - import `useQueryClient` from `@tanstack/react-query`
   - import `dashboardQueryKeys` from `@/features/cms/graphql-client`
   - create `const queryClient = useQueryClient()` inside `KeystoneListTable`
2. Replace the current same-search navigation refresh in `deleteSelectedItems()`:
```ts
await navigate({ search: (previous) => ({ ...previous }) })
```
with targeted invalidation, for example:
```ts
await queryClient.invalidateQueries({
  predicate: (query) => Array.isArray(query.queryKey)
    && query.queryKey[0] === dashboardQueryKeys.listPage(data.list.path, {}).at(0)
    && query.queryKey[1] === dashboardQueryKeys.listPage(data.list.path, {}).at(1)
    && query.queryKey[2] === data.list.path,
})
```
or equivalent exact-prefix matching for `['dashboard', 'listPage', data.list.path]`.

### Why this is the next best parity fix
- It is narrow and self-contained.
- It directly matches an already-implemented behavior in the reference starter: mutation → invalidate cached list data.
- It prevents stale list rows and stale counts after delete without requiring route/search changes.
- It fits the target architecture better than forced self-navigation because list state is already React Query-backed.

### Risk / constraint
- Use list **path** for the key prefix because target `dashboardQueryKeys.listPage()` is keyed by `listPath`, not `list.key`.
- Do not invalidate unrelated dashboard queries unless you intentionally want a broader refresh.
