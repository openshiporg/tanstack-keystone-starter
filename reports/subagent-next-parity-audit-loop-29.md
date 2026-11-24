# Code Context

## Files Retrieved
1. `src/routes/dashboard/$listKey.tsx` (lines 1-98) - target list route wiring; passes raw `search.sortBy` into data fetch and renders the shared filter/table UI.
2. `src/features/cms/graphql-client.ts` (lines 110-160, 241-309, 361-370) - target admin-meta normalization and list-page data pipeline; `buildOrderBy()` correctly falls back to `list.initialSort` when `sortBy` is absent, but returned `sortBy` stays `sortBy ?? ''`.
3. `src/components/dashboard/filter-bar.tsx` (lines 1-214, 215-356) - target sort control UI; it only considers explicit `searchParams.sortBy`, so no active sort is shown when initial sort is applied implicitly.
4. `src/components/dashboard/keystone-list-table.tsx` (lines 1-220) - target table headers also derive active sort state solely from `data.sortBy`, so header arrows are inactive when initial sort is in effect.
5. `../next-keystone-starter/features/dashboard/lib/sort.ts` (lines 1-53) - source app helper that resolves effective sort from URL, then `list.initialSort`, then fallback fields.
6. `../next-keystone-starter/features/dashboard/lib/buildOrderByClause.ts` (lines 1-8) - source app query builder always uses resolved effective sort, not just URL sort.
7. `../next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx` (lines 1-229) - source app list page builds queries through `buildOrderByClause`, so effective initial sort is consistently applied.
8. `../next-keystone-starter/features/dashboard/components/SortSelection.tsx` (lines 1-155) - source app sort UI still keys off URL state only, which helps explain why this parity gap remains visible after backend/query fixes.

## Key Code

Target data pipeline already applies initial sort at query time:

```ts
// src/features/cms/graphql-client.ts
function buildOrderBy(list: DashboardList, sortBy?: string) {
  const rawSort = sortBy || ''
  const legacyParts = rawSort.split(':')
  const explicitFieldPath = legacyParts.length === 2 ? legacyParts[0] : rawSort.startsWith('-') ? rawSort.slice(1) : rawSort
  const explicitDirection = legacyParts.length === 2 ? legacyParts[1] : rawSort.startsWith('-') ? 'desc' : 'asc'
  const explicitField = list.fields.find((candidate) => candidate.path === explicitFieldPath)
  if (explicitField?.isOrderable && (explicitDirection === 'asc' || explicitDirection === 'desc')) return [{ [explicitFieldPath]: explicitDirection }]

  const configuredInitialSort: { field: string; direction: 'ASC' | 'DESC' } | null = list.initialSort
  if (configuredInitialSort !== null) {
    const initialDirection = configuredInitialSort.direction === 'DESC' ? 'desc' : 'asc'
    const initialField = list.fields.find((field) => field.path === configuredInitialSort.field && field.isOrderable)
    if (initialField) return [{ [initialField.path]: initialDirection }]
  }
  // ...fallbacks...
}
```

But the same fetch returns an empty sort token to the UI when the URL is unset:

```ts
// src/features/cms/graphql-client.ts
return {
  list,
  items: data.items,
  count: data.count,
  page: safePage,
  pageSize: safePageSize,
  selectedFields,
  selectedFieldPaths: selectedFields.map((field) => field.path),
  sortBy: sortBy ?? ''
}
```

So both target sort affordances miss the effective sort:

```ts
// src/components/dashboard/filter-bar.tsx
function SortSelection({ list, sortBy, onSortChange }: { list: DashboardList; sortBy: string; onSortChange: (sortBy: string) => void }) {
  const orderableFields = list.fields.filter((field) => field.isOrderable && field.listView.fieldMode !== 'hidden')
  const activeFieldPath = sortBy.startsWith('-') ? sortBy.slice(1) : sortBy
  const activeField = orderableFields.find((field) => field.path === activeFieldPath)
  const direction = sortBy.startsWith('-') ? 'DESC' : 'ASC'

  if (!sortBy || !activeField) {
    return /* inactive SORT button */
  }
}
```

```ts
// src/components/dashboard/keystone-list-table.tsx
function TableHeaderField({ field, sortBy }: { field: DashboardField; sortBy: string }) {
  const descending = sortBy.startsWith('-')
  const sortField = descending ? sortBy.slice(1) : sortBy
  const isActive = sortField === field.path
  const nextSort = isActive && !descending ? `-${field.path}` : field.path
}
```

Source app has the effective-sort helper already:

```ts
// ../next-keystone-starter/features/dashboard/lib/sort.ts
if (list.initialSort) {
  const { field, direction } = list.initialSort;
  const fieldConfig = list.fields?.[field];
  if (fieldConfig?.isOrderable) {
    return { field, direction: direction.toLowerCase() as 'asc' | 'desc' };
  }
}
```

## Architecture
- Route layer (`src/routes/dashboard/$listKey.tsx`) reads URL search params and calls `fetchDashboardListPage()`.
- Data layer (`src/features/cms/graphql-client.ts`) resolves the actual GraphQL `orderBy`, including `list.initialSort` fallback.
- UI layer (`src/components/dashboard/filter-bar.tsx`, `src/components/dashboard/keystone-list-table.tsx`) renders sort state from `sortBy` only.
- Result: backend/query ordering is correct, but the visible sort controls and header arrows are out of sync whenever ordering comes from `initialSort` rather than `?sortBy=`.

## Start Here
Open `src/features/cms/graphql-client.ts` first. It is the narrowest place to compute and expose the effective sort that both the filter bar and table headers can consume.

## Next single concrete parity gap
**Gap:** effective `initialSort` is applied to the query but not exposed to the UI, so the list appears unsorted in controls/header state until the user explicitly sets `sortBy` in the URL.

This is the next fixable parity issue because:
- the underlying query behavior is already correct,
- only sort-state propagation/display is missing,
- the fix is small and localized.

## Minimal implementation
1. **In `src/features/cms/graphql-client.ts`**
   - Extract or add a helper that returns the effective sort token/string, using the same precedence as `buildOrderBy()`:
     - explicit `sortBy` from URL,
     - `list.initialSort`,
     - fallback orderable field.
   - Use that helper both for:
     - building `orderBy`, and
     - returning `sortBy` in `DashboardListPageData`.
   - Suggested returned token format for existing UI compatibility:
     - ascending: `fieldPath`
     - descending: `-fieldPath`

2. **No schema/type redesign needed**
   - `DashboardListPageData.sortBy` can stay a `string`.
   - `src/components/dashboard/filter-bar.tsx` and `src/components/dashboard/keystone-list-table.tsx` should then work without structural changes because they already understand `field` / `-field` tokens.

## Exact files likely needing changes
- `src/features/cms/graphql-client.ts` — required
- `src/components/dashboard/filter-bar.tsx` — optional only if you want the sort pill/button to distinguish implicit vs explicit state; not required for basic parity
- `src/components/dashboard/keystone-list-table.tsx` — likely no code change required once `data.sortBy` becomes the effective sort token

## Risk / constraint
- Keep URL behavior unchanged: clearing sort should still remove `sortBy` from the URL, while the UI falls back to showing the configured `initialSort`.
- If you refactor `buildOrderBy()`, make sure legacy `field:direction` parsing still works because target currently accepts that form.
