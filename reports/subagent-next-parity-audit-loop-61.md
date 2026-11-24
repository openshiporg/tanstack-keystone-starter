# Code Context

## Files Retrieved
1. `src/components/dashboard/views/registry.tsx` (lines 1-105, 118-256) - target field controller registry still defines simplified filter types that drive the list filter UI.
2. `src/features/cms/graphql-client.ts` (lines 261-359, 360-480) - target server-side list query builder still accepts only the same simplified filter keys and translates them to GraphQL `where` clauses.
3. `src/components/dashboard/filter-bar.tsx` (lines 68-125, 145-220, 309-317) - target filter UI reads `controller.filter.types` dynamically, so registry filter metadata is the source of available URL keys.
4. `src/routes/dashboard/$listKey.tsx` (lines 1-68) - target list route forwards all search params into `fetchDashboardListPage(..., filters: search)`, so filter behavior is centralized in `graphql-client.ts`.
5. `../next-keystone-starter/features/dashboard/views/text/index.tsx` (lines 300-379) - reference text controller exposes Keystone-style exact filter keys like `contains_i`, `is_i`, `starts_with_i`, etc.
6. `../next-keystone-starter/features/dashboard/views/select/index.tsx` (lines 1-40) - reference select controller exposes `matches` / `not_matches` instead of generic string filters.
7. `../next-keystone-starter/features/dashboard/lib/buildWhereClause.ts` (indirectly confirmed from prior audits; current target comparison anchored by matching key names and semantics) - reference server parser expects the same exact filter key contract the controllers emit.
8. `src/routes/dashboard/index.tsx` (lines 1-101) - confirms singleton real-id/create fallback is already present.
9. `src/features/cms/admin-meta.ts` (lines 73-122) - confirms `hideCreate`/`hideDelete` are already evaluated per request context.

## Key Code

### Remaining parity gap: exact filter key contract is still simplified in target
In `src/components/dashboard/views/registry.tsx:74-103`, target scalar filter metadata is still generic:

```ts
if (['text', 'select', 'decimal', 'bigInt', 'timestamp', 'id'].includes(kind)) {
  return {
    contains: { label: 'Contains', initialValue: '' },
    equals: { label: 'Equals', initialValue: '' },
    not: { label: 'Does not equal', initialValue: '' },
    is_empty: { label: 'Is empty', initialValue: true, needsValue: false },
    not_empty: { label: 'Is not empty', initialValue: true, needsValue: false },
  }
}
```

That metadata is consumed by `src/components/dashboard/filter-bar.tsx:78-101`, which builds valid URL filter keys from `controller.filter.types`:

```ts
for (const filterTypeName of Object.keys(filterController.types)) {
  filters.set(filterKey(field.path, filterTypeName), { ... })
}
```

So the UI currently emits simplified keys like:
- `!title_contains`
- `!status_equals`
- `!name_not`

rather than Keystone/Next keys.

### Reference app uses Keystone-exact filter keys
In `../next-keystone-starter/features/dashboard/views/text/index.tsx:325-377`:

```ts
types: {
  contains_i: { label: 'Contains', initialValue: '' },
  not_contains_i: { label: 'Does not contain', initialValue: '' },
  is_i: { label: 'Is exactly', initialValue: '' },
  not_i: { label: 'Is not exactly', initialValue: '' },
  starts_with_i: { label: 'Starts with', initialValue: '' },
  not_starts_with_i: { label: 'Does not start with', initialValue: '' },
  ends_with_i: { label: 'Ends with', initialValue: '' },
  not_ends_with_i: { label: 'Does not end with', initialValue: '' },
}
```

In `../next-keystone-starter/features/dashboard/views/select/index.tsx:24-36`:

```ts
const FILTER_TYPES = {
  matches: { label: 'Matches', initialValue: [] as string[] },
  not_matches: { label: 'Does not match', initialValue: [] as string[] },
}
```

### Target server parser is still coupled to the simplified keys
In `src/features/cms/graphql-client.ts:278-325`:

```ts
function filterTypesForField(field: DashboardField) {
  if (['text', 'select', 'decimal', 'bigInt', 'timestamp', 'id'].includes(field.kind)) {
    return ['contains', 'equals', 'not', 'is_empty', 'not_empty']
  }
  ...
}
```

and:

```ts
if (type === 'not') return { [field.path]: { not: { equals: String(value) } } }
if (['equals', 'contains', 'startsWith', 'endsWith'].includes(type)) {
  return { [field.path]: { [type]: String(value) } }
}
```

So even if the UI were updated, the target loader would still ignore or mis-handle Keystone-style URL filters such as:
- `!name_contains_i`
- `!name_starts_with_i`
- `!status_matches`
- `!id_in`
- `!id_not_in`

## Architecture
- `src/routes/dashboard/$listKey.tsx` validates generic search params and passes the full search object to `fetchDashboardListPage(..., filters: search)`.
- `fetchDashboardListPage()` in `src/features/cms/graphql-client.ts` calls `buildWhere(list, search, filters)`.
- `buildWhere()` enumerates allowed filter URL keys from `filterTypesForField(field)` and translates them via `filterWhereForField(field, type, value)`.
- Separately, `src/components/dashboard/filter-bar.tsx` renders available filters from `enhanceFields(...)` controller metadata.
- `enhanceFields(...)` ultimately reads `getFieldViews(...).controller(...)` from `src/components/dashboard/views/registry.tsx`.

That means filter parity requires both sides to share the same exact contract:
1. controller filter type names exposed to the UI
2. server-side `buildWhere()` parsing for those same names

Everything named in the task prompt appears already landed in target and does not look like the next missing parity gap:
- bulk delete selection gated by `hideDelete`
- destructive footer bar only shown when `onDelete` exists
- request-aware `hideCreate` / `hideDelete`
- singleton real id/create fallback
- overview skipping singleton counts
- relationship options using `buildWhere`
- singleton missing empty-state
- bulk delete invalidation
- default columns fallback

## Start Here
Open `src/components/dashboard/views/registry.tsx` first. It is the current source of truth for filter types exposed by the UI, and it is visibly behind the Next/Keystone controller contracts.

## Next single concrete fixable parity gap
**Gap:** the target dashboard still does not implement Keystone/Next exact list filter type names and semantics; it uses a simplified generic filter contract in both the UI controller registry and the server-side `buildWhere()` parser.

### Why this is the next gap
The specific fixes listed in the task are already present in target code. The next concrete mismatch against `next-keystone-starter` is the filter system itself: available filter operators and URL keys still differ, so filter UX and sharable URLs are not parity-safe.

### Minimal implementation
1. **Update UI controller filter metadata in `src/components/dashboard/views/registry.tsx`**
   - Replace generic text filters with Next-style keys:
     - `contains_i`
     - `not_contains_i`
     - `is_i`
     - `not_i`
     - `starts_with_i`
     - `not_starts_with_i`
     - `ends_with_i`
     - `not_ends_with_i`
   - Replace generic select filters with:
     - `matches`
     - `not_matches`
   - Add ID-compatible keys matching Next semantics where appropriate:
     - `is`, `not`, `gt`, `lt`, `gte`, `lte`, `in`, `not_in`
   - Keep relationship filter keys aligned with the reference behavior already added.

2. **Update server parsing in `src/features/cms/graphql-client.ts`**
   - Expand `filterTypesForField()` to return the same exact keys exposed by the UI registry.
   - Expand `filterWhereForField()` to translate those keys to GraphQL where clauses, for example:
     - `contains_i` → `{ contains: value, mode: 'insensitive' }`
     - `not_contains_i` → `{ not: { contains: value, mode: 'insensitive' } }`
     - `is_i` / `not_i` → `equals` / `not.equals` with `mode: 'insensitive'`
     - `starts_with_i` / `ends_with_i` and negative forms
     - `matches` / `not_matches` for select → `in` / `notIn`
     - `in` / `not_in` for id from comma-separated or array values
   - Preserve current `initialFilter` composition and relationship behavior.

### Exact files likely to change
- `src/components/dashboard/views/registry.tsx`
- `src/features/cms/graphql-client.ts`

### Constraints / risks
- `filter-bar.tsx` is already dynamic, so it should pick up new filter keys automatically once registry metadata changes.
- The UI and server must be updated together in the same patch; otherwise the filter popover will emit URL keys that `buildWhere()` does not understand.
- For text filters, the main semantic detail to mirror from Next is `mode: 'insensitive'` on the GraphQL clause where supported.
