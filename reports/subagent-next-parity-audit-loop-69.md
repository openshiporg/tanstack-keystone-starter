# Code Context

## Files Retrieved
1. `src/features/cms/graphql-client.ts` (lines 288-380) - target list-filter operator registry and GraphQL where-clause builder.
2. `src/components/dashboard/filter-bar.tsx` (lines 64-121, 160-198) - target filter UI reads operator definitions from field controllers and writes `!field_operator` search params.
3. `../next-keystone-starter/features/dashboard/lib/buildWhereClause.ts` (lines 1-360) - source-of-truth operator semantics used by the Next starter.
4. `src/routes/dashboard/$listKey.create.tsx` (lines 11-23) - confirms create route guard is already implemented in target.
5. `src/components/dashboard/keystone-list-table.tsx` (lines 17-53, 175-180) - confirms bulk delete already respects `hideDelete` in target.
6. `src/features/cms/admin-meta.ts` (lines 73-122) - confirms dynamic `hideCreate`/`hideDelete` evaluation already exists in admin metadata generation.

## Key Code

### Parity gap: target backend filter operator map is still wrong for decimal/bigInt/timestamp

In the target, `graphql-client.ts` currently advertises and parses the wrong operators for several scalar field kinds:

```ts
// src/features/cms/graphql-client.ts:289-295
function filterTypesForField(field: DashboardField) {
  if (field.kind === 'text') return ['contains_i', 'not_contains_i', 'is_i', 'not_i', 'starts_with_i', 'not_starts_with_i', 'ends_with_i', 'not_ends_with_i']
  if (field.kind === 'select') return ['matches', 'not_matches']
  if (field.kind === 'id') return ['is', 'not', 'gt', 'lt', 'gte', 'lte', 'in', 'not_in']
  if (['decimal', 'bigInt', 'timestamp'].includes(field.kind)) return ['contains', 'equals', 'not', 'is_empty', 'not_empty']
  if (['integer', 'float'].includes(field.kind)) return ['equals', 'not', 'lt', 'lte', 'gt', 'gte']
```

That means target list queries only recognize `!price_equals`, `!price_contains`, etc. for `decimal`, `bigInt`, and `timestamp`, even though the filter UI/controller layer is Keystone-shaped.

The source starter uses Keystone-style operators instead:

```ts
// ../next-keystone-starter/features/dashboard/lib/buildWhereClause.ts
// integer: lines 60-77
// float: lines 80-97
// bigInt: lines 100-117
// timestamp: lines 163-176
// decimal: lines 179-196

bigInt: {
  types: {
    equals: { label: 'Is exactly', initialValue: null },
    not: { label: 'Is not exactly', initialValue: null },
    gt: { label: 'Is greater than', initialValue: null },
    lt: { label: 'Is less than', initialValue: null },
    gte: { label: 'Is greater than or equal to', initialValue: null },
    lte: { label: 'Is less than or equal to', initialValue: null },
    empty: { label: 'Is empty', initialValue: null },
    not_empty: { label: 'Is not empty', initialValue: null },
  },
}
```

And the target `FilterBar` already builds active filters from field controllers, not from the obsolete local union:

```ts
// src/components/dashboard/filter-bar.tsx:74-83
const activeFilterTypes = activeFilterField?.controller.filter
  ? Object.entries(activeFilterField.controller.filter.types).map(([type, meta]) => ({ type, ...meta }))
  : []
```

So the UI can expose Keystone operators while the data loader silently ignores them if `graphql-client.ts` does not recognize the same operator names.

### Why this is the next concrete parity gap

Already fixed/covered in target:
- adminMeta query includes `createView/listView.fieldPosition`
- create route guard exists (`src/routes/dashboard/$listKey.create.tsx:11-23`)
- bulk delete hideDelete exists (`src/components/dashboard/keystone-list-table.tsx:17-53`)
- dynamic hideCreate/hideDelete evaluation exists in admin meta (`src/features/cms/admin-meta.ts:119-122`)

Remaining mismatch is functional and easy to reproduce:
- a decimal/timestamp/bigInt filter pill can be added from the UI/controller layer,
- but `fetchDashboardListPage()` may drop or mis-build the filter because `buildWhere()` only allows the wrong operator names for those field kinds.

## Architecture

Filter flow in target:
1. `src/components/dashboard/filter-bar.tsx` uses enhanced field controllers to expose available filter operators and serializes them into URL search params like `!field_operator`.
2. `src/routes/dashboard/$listKey.tsx` passes the full search object into `fetchDashboardListPage({ filters: deps })`.
3. `src/features/cms/graphql-client.ts` rebuilds the GraphQL `where` clause in `buildWhere()`.
4. `buildWhere()` only accepts operators returned by `filterTypesForField()`.
5. If `filterTypesForField()` disagrees with Keystone/Next starter operator names, valid UI filters are ignored or converted incorrectly.

So the backend-side operator registry in `graphql-client.ts` must match the controller/UI semantics from the Next starter.

## Start Here

Open `src/features/cms/graphql-client.ts` first. It is the narrowest place where target filter parity breaks despite the UI already exposing Keystone-style operators.

## Minimal implementation

Update only `src/features/cms/graphql-client.ts`.

1. Change `filterTypesForField()` so these kinds match Next starter semantics:
   - `decimal` -> `['equals', 'not', 'gt', 'lt', 'gte', 'lte', 'empty', 'not_empty']`
   - `bigInt` -> same as decimal
   - `timestamp` -> `['equals', 'not', 'lt', 'gt', 'empty', 'not_empty']`
   - optionally align `integer`/`float` too by adding `empty`/`not_empty` for full parity with source.
2. Update `filterWhereForField()` to support:
   - `empty` => `{ [field.path]: { equals: null } }`
   - `not_empty` => `{ [field.path]: { not: { equals: null } } }` or existing equivalent style
   - `gt/lt/gte/lte` for `decimal`, `bigInt`, `timestamp`
   - keep value coercion consistent with current runtime expectations:
     - `integer`/`float` -> numbers
     - `decimal`/`bigInt`/`timestamp` -> strings are acceptable, matching current GraphQL scalar handling
3. Remove the non-Keystone `contains`/`is_empty` operator path for `decimal`/`bigInt`/`timestamp` unless it is intentionally retained for backward compatibility.

## Suggested exact patch shape

Target sections:
- `src/features/cms/graphql-client.ts:288-309`
- `src/features/cms/graphql-client.ts:310-357`

Expected end state:
- `filterTypesForField()` returns the same operator names used in `../next-keystone-starter/features/dashboard/lib/buildWhereClause.ts`.
- `filterWhereForField()` constructs GraphQL where clauses compatible with those operator names.

## Risk / note

`src/components/dashboard/filter-bar.tsx` still contains a local `FilterType` union near the top that is broader/different from controller-driven types. It is not the primary runtime bug because the component actually renders from controller metadata, but TypeScript cleanup may be needed if stricter typing is introduced later.