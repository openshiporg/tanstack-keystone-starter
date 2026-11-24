# Next parity audit loop 23

## Next single concrete fixable parity gap

**Gap:** the TanStack target still does **not include active `!filter_*` URL params in the React Query cache key for list pages**, so filter-only URL changes can resolve against the same cached `listPage` query entry. The Next reference does not have this issue because its list page is driven directly from `searchParams` on navigation/server fetch rather than a client cache key that drops filter state.

This is now the next parity gap after the recent filter/sort/popover/sidebar fixes.

## Why this is a parity bug

In the target app, list data fetches do pass `filters: deps` / `filters: search` into `fetchDashboardListPage(...)`, but the **query key** only includes:
- `listPath`
- `page`
- `pageSize`
- `search`
- `sortBy`
- `fields`

So two URLs that differ only by active filters share the same React Query cache key.

Example:
- `/dashboard/posts?page=1&sortBy=title`
- `/dashboard/posts?page=1&sortBy=title&!status_equals="draft"`

Both map to the same key today.

That creates cache collisions/stale reuse risk and breaks parity with the Next reference behavior, where changing filter params always changes the fetched result set.

## Evidence

### Target: query key omits filters
1. `src/features/cms/graphql-client.ts:67-73`
   - `dashboardQueryKeys.listPage(...)` accepts only `(listPath, page, pageSize, search, sortBy, fields)`.

2. `src/routes/dashboard/$listKey.tsx:18-40`
   - loader uses `dashboardQueryKeys.listPage(params.listKey, deps.page, deps.pageSize ?? 0, deps.search, deps.sortBy, deps.fields)`
   - but fetches with `filters: deps`

3. `src/routes/dashboard/$listKey.tsx:52-65`
   - component `useQuery(...)` repeats the same key omission
   - but fetches with `filters: search`

### Target: filters really do live in URL search
4. `src/components/dashboard/filter-bar.tsx:76-110`
   - `activeFilters` are taken from `searchParams` keys beginning with `!`
   - `addFilter()` writes `!${fieldPath}_${type}` params into route search

5. `src/features/cms/graphql-client.ts:280-296`
   - `buildWhere(...)` consumes those `!` keys from `filters`

### Next reference behavior
6. `../next-keystone-starter/features/dashboard/components/FilterBar.tsx:39-59`
   - URL search params are rebuilt/pushed when controls change

7. `../next-keystone-starter/features/dashboard/components/FilterList.tsx:214-240`
   - edited filters are written back into URL search params

In the Next app, the route is re-fetched from URL state directly, so there is no equivalent client query-key omission for list filtering.

## Minimal implementation

### Files to change
1. `src/features/cms/graphql-client.ts`
2. `src/routes/dashboard/$listKey.tsx`

### Exact change

#### 1) Extend the list-page query key to include normalized filters
In `src/features/cms/graphql-client.ts`, change `dashboardQueryKeys.listPage(...)` so it also accepts a filter signature, for example:
- either the full normalized filter object
- or a stable serialized string derived from only `!` keys

Minimal safe shape:
- add a final `filtersKey: string`
- include it in the returned tuple

#### 2) Build a stable filter signature in the route and pass it into both query-key call sites
In `src/routes/dashboard/$listKey.tsx`:
- derive a stable string from search/deps entries whose keys start with `!`
- sort keys before serializing
- pass that string into both:
  - loader `ensureQueryData({ queryKey: ... })`
  - component `useQuery({ queryKey: ... })`

## Minimal implementation sketch

```ts
// src/features/cms/graphql-client.ts
listPage: (
  listPath: string,
  page: number,
  pageSize: number,
  search: string,
  sortBy: string,
  fields: string,
  filtersKey: string,
) => ['dashboard', 'listPage', listPath, page, pageSize, search, sortBy, fields, filtersKey] as const
```

```ts
// src/routes/dashboard/$listKey.tsx
function getFiltersKey(search: Record<string, unknown>) {
  return JSON.stringify(
    Object.entries(search)
      .filter(([key, value]) => key.startsWith('!') && value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  )
}
```

Then use `getFiltersKey(deps)` and `getFiltersKey(search)` in the two `dashboardQueryKeys.listPage(...)` calls.

## Why this is the best next fix

- It is **small and isolated**.
- It directly affects list-page correctness.
- It is a true parity issue introduced by the TanStack caching layer, not a cosmetic difference.
- It preserves the existing filter UI and fetch logic; only cache identity changes.

## Risk / note

- The filter signature should use only `!` keys so unrelated search params do not churn the cache.
- Sorting keys before serialization is important so equivalent filter sets produce the same key.