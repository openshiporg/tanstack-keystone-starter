# Code Context

## Files Retrieved
1. `src/components/dashboard/filter-bar.tsx` (lines 60-120, 138-177, 220-283) - target list toolbar/filter/sort UI; shows current sort UI and how URL search params are mutated.
2. `src/features/cms/graphql-client.ts` (lines 77-83, 297-323, 375-380) - target effective sort token resolution, orderBy generation, and returned normalized `sortBy`.
3. `src/routes/dashboard/$listKey.tsx` (lines 9-18, 28-39, 56-68) - target route loader/query wiring; query key still uses raw `search.sortBy`.
4. `../next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx` (lines 78-100, 147-156) - reference client computes effective sort for fetching via `buildOrderByClause`, independent of whether URL has `sortBy`.
5. `../next-keystone-starter/features/dashboard/hooks/useSort.ts` (lines 1-18) - reference UI only reflects explicit URL sort, not fallback sort.
6. `../next-keystone-starter/features/dashboard/components/SortSelection.tsx` (lines 68-165) - reference sort control reads explicit URL state only.
7. `../next-keystone-starter/features/dashboard/components/FilterAdd.tsx` (lines 1-118) - reference filter add flow, useful only to confirm the no-filterable-fields work is already covered elsewhere.
8. `src/components/dashboard/enhance-fields.tsx` (lines 1-70) and `../next-keystone-starter/features/dashboard/utils/enhanceFields.ts` (lines 1-72) - confirms custom-view merge parity work is already addressed.

## Key Code

Target already normalizes/falls back sort on the data layer:

`src/features/cms/graphql-client.ts:297-317`
```ts
function resolveEffectiveSortToken(list: DashboardList, sortBy?: string) {
  const rawSort = sortBy || ''
  ...
  if (explicitField?.isOrderable && ...) return ...

  const configuredInitialSort = list.initialSort
  if (configuredInitialSort !== null) {
    const initialField = list.fields.find((field) => field.path === configuredInitialSort.field && field.isOrderable)
    if (initialField) return configuredInitialSort.direction === 'DESC' ? `-${initialField.path}` : initialField.path
  }

  const orderableFields = list.fields.filter((field) => field.isOrderable)
  const preferredField = ['createdAt', 'updatedAt', 'timestamp', 'date', 'id']
    .map((path) => orderableFields.find((field) => field.path === path))
    .find((field) => field !== undefined)
  const fallbackField = preferredField ?? orderableFields[0]
  const fallbackDirection = fallbackField.path === 'id' ? 'asc' : 'desc'
  return fallbackDirection === 'desc' ? `-${fallbackField.path}` : fallbackField.path
}
```

That normalized token is returned to the page data:

`src/features/cms/graphql-client.ts:379`
```ts
return { ..., sortBy: resolveEffectiveSortToken(list, sortBy) }
```

But the route query key still uses raw URL sort, not effective sort:

`src/routes/dashboard/$listKey.tsx:28-39`
```ts
queryKey: dashboardQueryKeys.listPage(
  params.listKey,
  deps.page,
  deps.pageSize ?? 0,
  deps.search,
  deps.sortBy,
  deps.fields,
),
queryFn: () => fetchDashboardListPage({ ..., sortBy: deps.sortBy, ... })
```

`src/routes/dashboard/$listKey.tsx:56-68`
```ts
queryKey: dashboardQueryKeys.listPage(
  params.listKey,
  search.page,
  search.pageSize ?? 0,
  search.search,
  search.sortBy,
  search.fields,
),
queryFn: () => fetchDashboardListPage({ ..., sortBy: search.sortBy, ... })
```

The query-key helper itself only accepts raw `sortBy`:

`src/features/cms/graphql-client.ts:77-81`
```ts
listPage: (listPath: string, page: number, pageSize: number, search: string, sortBy: string, fields: string) =>
  ['dashboard', 'listPage', listPath, page, pageSize, search, sortBy, fields] as const,
```

UI mutation also clears sort back to `undefined`, which means the same visual list state can oscillate between two cache keys (`''` vs effective fallback only known in data):

`src/components/dashboard/filter-bar.tsx:90-91`
```ts
void navigate({ search: (previous) => ({ ...previous, sortBy: sortBy || undefined, page: 1 }) })
```

## Architecture
- `src/routes/dashboard/$listKey.tsx` owns loader + React Query cache identity for list pages.
- It calls `fetchDashboardListPage()` in `src/features/cms/graphql-client.ts`.
- `fetchDashboardListPage()` computes the real sort actually used for GraphQL via `resolveEffectiveSortToken()` and returns that normalized token in `data.sortBy`.
- `FilterBar`/`SortSelection` operate from URL search params, while the table data is fetched from the normalized sort.
- Because query keys are still built from raw `search.sortBy`, two equivalent states can be cached separately:
  - no explicit URL sort (`''` / undefined)
  - an explicit token equal to the effective fallback (for example `-createdAt`)
- This is now the clearest remaining parity gap after the earlier fixes because the app has an “effective sort” concept in data/UI, but cache identity has not been updated to match it.

## Start Here
Open `src/routes/dashboard/$listKey.tsx` first. It is the narrowest place where fetch/cache parity diverges from the new effective-sort pipeline.

## Next single concrete fixable parity gap
**Gap:** list-page React Query keys still use raw `search.sortBy` instead of the normalized/effective sort token that the fetcher actually uses.

**Why this matters:**
- Causes duplicate cache entries for the same server result.
- Makes the new effective-sort pipeline incomplete: data normalizes sort, but cache identity does not.
- Can produce unnecessary refetches when toggling between “no explicit sort” and an explicit token equal to the fallback/initial sort.

**Minimal implementation:**
1. In `src/features/cms/graphql-client.ts`, export a small helper from the existing logic, e.g. `resolveEffectiveSortToken(list, sortBy?)`.
2. Update `dashboardQueryKeys.listPage(...)` to accept an already-normalized sort token, or rename the parameter to make that explicit.
3. In `src/routes/dashboard/$listKey.tsx`, compute the effective sort token from the resolved `list` before building both loader and component `queryKey`s, and pass that normalized token into `dashboardQueryKeys.listPage(...)`.
4. Keep the actual fetch call unchanged except for continuing to pass raw `sortBy` into `fetchDashboardListPage(...)`; the fetcher already normalizes internally.

**Exact files to change:**
- `src/features/cms/graphql-client.ts`
- `src/routes/dashboard/$listKey.tsx`

**Suggested shape:**
- Export `resolveEffectiveSortToken` from `graphql-client.ts`.
- In the route, after `const list = findDashboardListByPath(...)`, derive:
  - loader: `const effectiveSortBy = resolveEffectiveSortToken(list, deps.sortBy)`
  - component: `const effectiveSortBy = resolveEffectiveSortToken(loaderData.list, search.sortBy)`
- Use `effectiveSortBy` in `dashboardQueryKeys.listPage(...)` instead of raw `deps.sortBy` / `search.sortBy`.

This is the next smallest fix that closes a real parity hole without broad refactoring.