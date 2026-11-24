# Code Context

## Files Retrieved
1. `src/routes/dashboard/$listKey.tsx` (lines 1-157) - target list route; restores/saves per-list localStorage state and loads list page data via `fetchDashboardListPage`.
2. `src/components/dashboard/filter-bar.tsx` (lines 1-430) - target list UI; drives search/sort/column/filter query params and active filter pills.
3. `src/features/cms/graphql-client.ts` (lines 283-401) - target server/client list-data path; `buildWhere()` composes search + `!filters`, but ignores list `initialFilter`.
4. `src/features/cms/admin-meta-query.ts` (lines 1-40) - target admin meta query already fetches `initialFilter`.
5. `src/features/cms/admin-meta.ts` (lines 76-95) - target admin meta builder already normalizes/publishes `initialFilter` onto lists.
6. `src/features/cms/types.ts` (lines 230-247, 260-287) - target types already model `initialFilter` on admin-meta lists.
7. `../next-keystone-starter/features/dashboard/screens/ListPage/index.tsx` (lines 1-120) - source list page; builds `where` only from search/filter URL state and also ignores `initialFilter`.
8. `../next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx` (lines 1-140) - source client list path; same omission when rebuilding query variables.
9. `../next-keystone-starter/features/dashboard/lib/buildWhereClause.ts` (lines 261-401) - source filter builder; only uses `searchParams`, no merge with list-level `initialFilter`.
10. `../next-keystone-starter/features/dashboard/actions/getAdminMetaAction.ts` (lines 1-96) - source admin meta fetch includes `initialFilter` in GraphQL, proving metadata exists but is unused downstream.
11. `../next-keystone-starter/features/dashboard/types/index.ts` (lines 120-156) - source list metadata type already includes `initialFilter`.

## Key Code
Target already fetches and stores list-level initial filters in admin metadata:

```ts
// src/features/cms/admin-meta-query.ts
initialFilter
```

```ts
// src/features/cms/admin-meta.ts
initialFilter: list.initialFilter ?? null,
```

But target list fetching does not apply it:

```ts
// src/features/cms/graphql-client.ts
function buildWhere(list: DashboardList, search: string, filters: Record<string, unknown> = {}) {
  const conditions: Array<Record<string, unknown>> = []
  // ...search conditions...
  // ...URL !filters conditions...
  if (conditions.length === 0) return undefined
  if (conditions.length === 1) return conditions[0]
  return { AND: conditions }
}
```

And list page fetch simply passes that result through:

```ts
// src/features/cms/graphql-client.ts
const where = buildWhere(list, search, filters)
```

Source has the same gap. Its server page also builds `where` only from URL state:

```ts
// ../next-keystone-starter/features/dashboard/screens/ListPage/index.tsx
const filterWhere = buildWhereClause(list, searchParamsObj)
const searchWhere = buildWhereClause(list, searchParameters)
const whereConditions = []
if (Object.keys(searchWhere).length > 0) whereConditions.push(searchWhere)
if (Object.keys(filterWhere).length > 0) whereConditions.push(filterWhere)
const where = whereConditions.length > 0 ? { AND: whereConditions } : {}
```

So both apps expose `initialFilter` in metadata, but neither honors it during list queries.

## Architecture
- `admin-meta-query.ts` fetches list metadata from runtime GraphQL.
- `admin-meta.ts` shapes runtime/config metadata into `AdminMetaList`, including `initialFilter`.
- `fetchKeystoneAdminMeta()` in `graphql-client.ts` turns admin meta into `DashboardList` objects used by routes/components.
- `src/routes/dashboard/$listKey.tsx` calls `fetchDashboardListPage()` for every list request.
- `fetchDashboardListPage()` calls `buildWhere()` to generate the final GraphQL `where` clause.
- `buildWhere()` currently merges:
  - free-text search from `search`
  - structured filters from `!field_type` query params
  - but **not** `list.initialFilter`

Because `initialFilter` is absent at the final query-construction layer, lists configured with default filters will display unfiltered results despite metadata parity elsewhere.

## Start Here
Open `src/features/cms/graphql-client.ts` first. It is the single choke point for list filtering in the target app, and the smallest safe place to add list-level `initialFilter` support without touching route/component code.

## Next single concrete fixable parity gap
**Gap:** list-level `initialFilter` metadata is fetched and typed, but never applied to list-page queries.

**Why this is the next fix:**
- It is a real parity hole still present after the recent filter/sort/cache/localStorage fixes.
- It has a minimal implementation surface.
- It affects both initial load and subsequent refetches because all list data flows through `fetchDashboardListPage()`.

### Minimal implementation in target
1. **File:** `src/features/cms/graphql-client.ts`
   - Update `buildWhere()` so `list.initialFilter` is prepended into `conditions` when present and non-empty.
   - Keep existing search and `!filters` behavior unchanged.
   - Prefer wrapping all conditions in `AND`, e.g.:
     - `initialFilter`
     - search OR block
     - each structured filter condition

Suggested shape:

```ts
function buildWhere(list: DashboardList, search: string, filters: Record<string, unknown> = {}) {
  const conditions: Array<Record<string, unknown>> = []

  if (list.initialFilter && Object.keys(list.initialFilter).length > 0) {
    conditions.push(list.initialFilter)
  }

  // existing search logic...
  // existing !filter parsing logic...

  if (conditions.length === 0) return undefined
  if (conditions.length === 1) return conditions[0]
  return { AND: conditions }
}
```

2. **Optional safety check in same file:** if `initialFilter` can be non-object JSON at runtime, guard with:
   - `typeof list.initialFilter === 'object'`
   - `list.initialFilter !== null`
   - `!Array.isArray(list.initialFilter)`

### Why only this file
- `src/routes/dashboard/$listKey.tsx` already passes all search/filter state correctly.
- `src/components/dashboard/filter-bar.tsx` does not need changes; default filters are list config, not user URL state.
- Admin-meta layers already include `initialFilter`.
- Query keys/cache behavior automatically stays correct because the loader/query already keys off search state and list path; default filter is static metadata on the list.

## Risks / constraints
- `initialFilter` must combine with user search and URL filters via `AND`, not overwrite them.
- Do **not** serialize `initialFilter` into localStorage or URL params; it is config-driven, not user preference.
- If a list uses an empty object `{}` as `initialFilter`, treat it as absent.
- This parity gap also exists upstream in `next-keystone-starter`, but the requested target-side fix is still isolated and valid.