# Code Context

## Files Retrieved
1. `src/routes/dashboard/index.tsx` (lines 1-108) - dashboard overview route consumes `dashboardQueryKeys.overview` and renders singleton/non-singleton cards from overview data.
2. `src/features/cms/graphql-client.ts` (lines 193-219, 234-349, 413-447) - overview fetch includes `singletonItemId` and counts; list field/default selection and filter building live here.
3. `src/routes/dashboard/$listKey.create.tsx` (lines 50-84) - create flow navigates to new item but does not invalidate overview/list caches.
4. `src/routes/dashboard/$listKey.$id.tsx` (lines 90-147) - update/delete flows invalidate list/item queries, but not overview.
5. `src/components/dashboard/keystone-list-table.tsx` (lines 1-53) - bulk delete invalidates list queries only, not overview.
6. `../next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx` (lines 347-365 and 81-103 via grep/read) - reference implementation invalidates item/list-level queries after mutations; helpful baseline for mutation invalidation patterns.
7. `../next-keystone-starter/features/dashboard/components/ListTable.tsx` (lines 1-105) - reference bulk delete invalidates list item queries only; useful to compare where target diverges because target overview now carries singleton ids/counts.

## Key Code
Target overview data now drives dashboard cards, including singleton destination ids:

```ts
// src/features/cms/graphql-client.ts
const listsToCount = adminMeta.lists.filter((list) => !list.isSingleton)
const singletonLists = adminMeta.lists.filter((list) => list.isSingleton)
...
return {
  ...list,
  count: typeof overviewData[`count_${list.key}`] === 'number' ? overviewData[`count_${list.key}`] : 0,
  singletonItemId: Array.isArray(singletonItems) ? singletonItems[0]?.id ?? null : null,
}
```

Dashboard page depends on that cached overview query:

```ts
// src/routes/dashboard/index.tsx
useSuspenseQuery({
  queryKey: dashboardQueryKeys.overview,
  queryFn: () => fetchDashboardOverview(),
})
```

Create path currently skips invalidation entirely:

```ts
// src/routes/dashboard/$listKey.create.tsx
const created = result[mutationName]
if (!created?.id) throw new Error('Create succeeded but no item id was returned.')
await navigate({ to: '/dashboard/$listKey/$id', params: { listKey: list.path, id: created.id } })
```

Item page update/delete only invalidate list/item pages:

```ts
// src/routes/dashboard/$listKey.$id.tsx
await queryClient.invalidateQueries({ queryKey: ['dashboard', 'listPage', data.list.path] })
await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.itemPage(data.list.path, item.id) })
```

Bulk delete also omits overview:

```ts
// src/components/dashboard/keystone-list-table.tsx
await queryClient.invalidateQueries({
  predicate: (query) => Array.isArray(query.queryKey) && ... && query.queryKey[2] === data.list.path,
})
```

## Architecture
- `fetchDashboardOverview()` in `src/features/cms/graphql-client.ts` is now the single source for dashboard home cards.
- That overview payload contains:
  - non-singleton counts
  - singleton `singletonItemId`
- `src/routes/dashboard/index.tsx` reads only the overview query cache.
- Mutations happen in three places relevant to dashboard card freshness:
  - create: `src/routes/dashboard/$listKey.create.tsx`
  - update/delete: `src/routes/dashboard/$listKey.$id.tsx`
  - bulk delete: `src/components/dashboard/keystone-list-table.tsx`
- Those mutation handlers currently refresh list/item queries, but not `dashboardQueryKeys.overview`.
- Because overview is now richer than old Next parity (counts + singleton ids), stale overview cache causes visible mismatches after mutations:
  - creating a singleton can leave dashboard card on “Create singleton” until full reload
  - deleting a singleton can leave dashboard card linking to deleted id
  - bulk deleting non-singletons can leave counts stale

## Start Here
Open `src/routes/dashboard/$listKey.create.tsx` first. It is the clearest missing invalidation point and explains the broader pattern: create mutations now need to refresh the overview cache because dashboard cards depend on it.

## Next single concrete fixable parity gap
**Gap:** mutation flows do not invalidate `dashboardQueryKeys.overview`, so the dashboard home page can show stale singleton card links and stale counts after create/delete/bulk delete.

### Why this is the next parity gap
This became more important after the recent fixes because target dashboard cards now resolve real singleton ids from overview data. That means overview staleness is now user-visible and functionally wrong, not just cosmetic.

### Minimal implementation
Add `queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.overview })` in these exact places:

1. **`src/routes/dashboard/$listKey.create.tsx`**
   - import `useQueryClient` from `@tanstack/react-query`
   - import `dashboardQueryKeys` from `@/features/cms/graphql-client`
   - after successful create, before navigation, invalidate:
     - `dashboardQueryKeys.overview`
     - optionally the current list page key/predicate too, but overview is the parity-critical piece

2. **`src/routes/dashboard/$listKey.$id.tsx`**
   - in both `saveChanges()` and `deleteItem()`? **Delete is required**, save is optional.
   - minimum parity fix: add overview invalidation in `deleteItem()` because singleton card target/count can change.
   - pragmatic extension: also add it in `saveChanges()` only if you want label-driven dashboard metadata freshness, but it is not required for this specific gap.

3. **`src/components/dashboard/keystone-list-table.tsx`**
   - after successful bulk delete, also invalidate `dashboardQueryKeys.overview` so home counts refresh.

### Smallest safe diff shape
- Reuse existing `queryClient` where already present.
- Prefer exact query-key invalidation:

```ts
await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.overview })
```

### Risks / constraints
- None significant: this is cache invalidation only.
- The only behavioral change is fresher dashboard cards after mutations.
- No schema/runtime changes needed.
- If create route does not yet have a query client, that is the only extra plumbing required.
