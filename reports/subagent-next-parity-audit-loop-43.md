# Code Context

## Files Retrieved
1. `src/routes/dashboard/$listKey.$id.tsx` (lines 1-184) - target item page route; save/delete/copy-ID behavior and current cache handling live here.
2. `src/features/cms/graphql-client.ts` (lines 68-80, 220-287, 400-447) - target React Query key shapes and item-page fetch/runtime metadata flow.
3. `../next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx` (lines 1-107, 345-349) - reference implementation already invalidates caches after item mutations.
4. `../next-keystone-starter/features/dashboard/lib/queryKeys.ts` (grep hits only) - confirms the reference app has dedicated item/list cache keys used for invalidation.

## Key Code

### Target currently only refetches the current item page
From `src/routes/dashboard/$listKey.$id.tsx`:
```tsx
const { data, error, refetch } = useQuery({
  queryKey: dashboardQueryKeys.itemPage(params.listKey, params.id),
  queryFn: () => fetchDashboardItemPage({ listPath: params.listKey, id: params.id }),
  initialData: loaderData,
})
...
const result = await executeDashboardGraphQL(...update...)
if (!result[data.list.gqlNames.updateMutationName]) throw new Error('Update returned no item.')
await refetch()
setMessage('Saved changes.')
```

Delete also mutates without invalidating any cached list queries:
```tsx
await executeDashboardGraphQL(...delete...)
await navigate({ to: '/dashboard/$listKey', params: { listKey: data.list.path } })
```

### Target query keys are list-path scoped and support partial invalidation
From `src/features/cms/graphql-client.ts`:
```ts
export const dashboardQueryKeys = {
  adminMeta: ['dashboard', 'adminMeta'] as const,
  overview: ['dashboard', 'overview'] as const,
  listPage: (listPath: string, searchState: Record<string, unknown>) =>
    ['dashboard', 'listPage', listPath, stableSearchState(searchState)] as const,
  itemPage: (listPath: string, id: string) => ['dashboard', 'itemPage', listPath, id] as const,
}
```
This means `['dashboard', 'listPage', data.list.path]` is a safe partial invalidation prefix for all cached list-page variants for that list, including filtered/sorted pages.

### Reference app already invalidates caches after mutations
From `../next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx`:
```tsx
await queryClient.invalidateQueries({
  queryKey: ['lists', list.key, 'items']
})
await queryClient.invalidateQueries({
  queryKey: queryKeys.items.item(list.key, itemId)
})
```
And on save:
```tsx
await queryClient.invalidateQueries({
  queryKey: queryKeys.items.item(list.key, itemId)
})
```
The exact key shapes differ between apps, but the parity point is that the reference app invalidates caches after mutations while the target mostly does not.

## Architecture
- The target dashboard uses React Query directly from route components.
- Item route data comes from `fetchDashboardItemPage()` and is cached under `dashboardQueryKeys.itemPage(listPath, id)`.
- List pages are cached under `dashboardQueryKeys.listPage(listPath, searchState)`, where `searchState` includes filters/sort/page.
- After update/delete, the target item page only refreshes the current item via `refetch()` or navigates away.
- Because list pages are cached separately, any previously visited filtered/sorted list view can remain stale after an item mutation.
- The reference app explicitly invalidates mutation-related caches, so its list/item views converge after save/delete.

## Start Here
Open `src/routes/dashboard/$listKey.$id.tsx` first. It contains the missing parity behavior and can be fixed locally without changing the data layer shape.

## Next single concrete parity gap
**Gap:** item-page mutations do not invalidate cached list-page queries in the target app, so previously visited list views can stay stale after save/delete. This is the next concrete parity gap against `next-keystone-starter`'s mutation-cache behavior.

## Minimal implementation
1. In `src/routes/dashboard/$listKey.$id.tsx`, get the React Query client:
```tsx
import { useQuery, useQueryClient } from '@tanstack/react-query'
...
const queryClient = useQueryClient()
```
2. After a successful save, invalidate all cached list pages for the current list, and optionally the current item-page key too:
```tsx
await queryClient.invalidateQueries({
  queryKey: ['dashboard', 'listPage', data.list.path],
})
await queryClient.invalidateQueries({
  queryKey: dashboardQueryKeys.itemPage(data.list.path, data.item.id),
})
await refetch()
```
3. After a successful delete, invalidate the same list-page prefix before navigation:
```tsx
await queryClient.invalidateQueries({
  queryKey: ['dashboard', 'listPage', data.list.path],
})
await queryClient.invalidateQueries({
  queryKey: dashboardQueryKeys.itemPage(data.list.path, data.item.id),
})
await navigate({ to: '/dashboard/$listKey', params: { listKey: data.list.path } })
```

## Why this is the best next fix
- It is narrow: one file, no schema changes.
- It directly addresses stale filtered/sorted list caches.
- It matches the reference app’s mutation-cache intent even though the key names differ.
- It complements the already-fixed parity work around item runtime metadata, itemView overrides, and list filter/sort behavior.