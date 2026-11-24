# Code Context

## Files Retrieved
1. `src/features/cms/graphql-client.ts` (lines 300-315) - current TanStack list sort fallback logic.
2. `src/features/cms/admin-meta.ts` (lines 73-94) - current admin meta serialization hard-codes `initialSort: null`.
3. `src/features/cms/types.ts` (lines 208-233) - `CmsList` type currently has no `initialSort` field.
4. `src/features/cms/types.ts` (lines 276-284) - `AdminMetaList` expects `initialSort`, so the runtime shape already supports it.
5. `src/features/cms/config.ts` (lines 177-206) - list normalization currently copies many list options but not `initialSort`.
6. `src/routes/dashboard/$listKey.tsx` (lines 9-68) - list route passes `sortBy` through to data loading, so backend fallback directly affects list behavior.
7. `../next-keystone-starter/features/dashboard/lib/sort.ts` (lines 1-60) - reference implementation for sort fallback behavior.
8. `../next-keystone-starter/features/dashboard/types/index.ts` (lines 129-137) - reference admin metadata includes `initialSort`.

## Key Code
Reference sort fallback in Next app:

```ts
// ../next-keystone-starter/features/dashboard/lib/sort.ts:21-45
if (list.initialSort) {
  const { field, direction } = list.initialSort;
  const fieldConfig = list.fields?.[field];
  if (fieldConfig?.isOrderable) {
    return {
      field,
      direction: direction.toLowerCase() as 'asc' | 'desc'
    };
  }
}

const preferredFields = ['createdAt', 'updatedAt', 'timestamp', 'date', 'id'];
for (const fieldName of preferredFields) {
  const fieldConfig = list.fields?.[fieldName];
  if (fieldConfig?.isOrderable) {
    return {
      field: fieldName,
      direction: fieldName === 'id' ? 'asc' : 'desc'
    };
  }
}
```

Current TanStack fallback partially ports this, but cannot actually honor configured `initialSort` because admin meta always drops it:

```ts
// src/features/cms/graphql-client.ts:305-314
const initialDirection = list.initialSort?.direction.toLowerCase() === 'desc' ? 'desc' : 'asc'
const initialField = list.initialSort ? list.fields.find((field) => field.path === list.initialSort?.field && field.isOrderable) : undefined
if (initialField) return [{ [initialField.path]: initialDirection }]

const orderableFields = list.fields.filter((field) => field.isOrderable)
const preferredField = ['createdAt', 'updatedAt', 'timestamp', 'date', 'id']
  .map((path) => orderableFields.find((field) => field.path === path))
  .find((field) => field !== undefined)
const fallbackField = preferredField ?? orderableFields[0]
return [{ [fallbackField.path]: 'asc' }]
```

But admin meta serialization forces null:

```ts
// src/features/cms/admin-meta.ts:76-81
return {
  ...list,
  itemQueryName: gqlNames.itemQueryName,
  listQueryName: gqlNames.listQueryName,
  initialSort: null,
  pageSize: list.pageSize ?? 50,
```

And the normalized list type/config does not currently carry `initialSort` at all:

```ts
// src/features/cms/types.ts:208-233
export type CmsList = {
  key: string
  path: string
  label: string
  singular: string
  plural: string
  description?: string
  initialColumns: string[]
  initialSearchFields?: string[]
  pageSize?: number
  labelField: string
  isSingleton?: boolean
  isHidden?: boolean
  ...
}
```

```ts
// src/features/cms/config.ts:191-199
initialColumns: ...,
initialSearchFields: listConfig.initialSearchFields ?? [],
pageSize: listConfig.pageSize ?? 50,
labelField: ...,
isSingleton: listConfig.isSingleton,
isHidden: listConfig.isHidden,
hideCreate: listConfig.hideCreate ?? listConfig.ui?.hideCreate,
hideDelete: listConfig.hideDelete ?? listConfig.ui?.hideDelete,
```

## Architecture
List pages load admin metadata first, then list page data:

- `src/routes/dashboard/$listKey.tsx` resolves the list from admin meta and calls `fetchDashboardListPage()`.
- `src/features/cms/graphql-client.ts` computes `orderBy` in `buildOrderBy()` using `list.initialSort` when no valid URL sort exists.
- `src/features/cms/admin-meta.ts` creates the `AdminMetaList` objects sent to the client.
- `src/features/cms/config.ts` normalizes developer list config into internal `CmsList` objects.
- Because `admin-meta.ts` hard-codes `initialSort: null` and `CmsList` lacks that property, the list view can never honor config-defined initial sort even though the client sorting code is ready for it.

## Start Here
Open `src/features/cms/admin-meta.ts` first. It contains the concrete parity break: `initialSort` is being nulled out before the client sees it.

## Next single concrete fixable parity gap
**Gap:** configured list `initialSort` cannot work in TanStack, despite the new sort fallback logic, because `initialSort` is never preserved from config into admin meta.

**Minimal implementation:**
1. Add `initialSort?: { field: string; direction: 'ASC' | 'DESC' }` to `CmsList` in `src/features/cms/types.ts`.
2. Ensure `normaliseList()` copies `listConfig.initialSort` into the normalized list in `src/features/cms/config.ts`.
3. Change `src/features/cms/admin-meta.ts` to serialize `initialSort: list.initialSort ?? null` instead of hard-coding `null`.

This is the next fix because it is a real remaining parity gap directly adjacent to the already-landed “sort fallback” work: the fallback algorithm exists, but configured default sorting still cannot match the reference app until the data pipeline exposes `initialSort` end-to-end.