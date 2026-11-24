# Code Context

## Files Retrieved
1. `src/features/cms/graphql-client.ts` (lines 278-358, 492-567) - defines filter operator sets, GraphQL where-clause generation, and item/relationship queries.
2. `src/components/dashboard/views/registry.tsx` (lines 1-220) - defines the filter UI/operator labels exposed in the dashboard.
3. `../next-keystone-starter/features/dashboard/lib/buildWhereClause.ts` (lines 150-270) - comparison reference showing expected filter semantics for decimal, timestamp, and relationship fields.
4. `../next-keystone-starter/features/dashboard/views/decimal/index.tsx` (lines 210-280) - comparison reference for decimal filter operators and labels.
5. `../next-keystone-starter/features/dashboard/views/bigInt/index.tsx` (lines 120-210) - comparison reference for bigint filter operators and labels.
6. `../next-keystone-starter/features/dashboard/views/timestamp/index.tsx` (lines 330-390) - comparison reference for timestamp filter operators and labels.

## Key Code
Current target behavior in `src/features/cms/graphql-client.ts`:

```ts
function filterTypesForField(field: DashboardField) {
  if (field.kind === 'text') return ['contains_i', 'not_contains_i', 'is_i', 'not_i', 'starts_with_i', 'not_starts_with_i', 'ends_with_i', 'not_ends_with_i']
  if (field.kind === 'select') return ['matches', 'not_matches']
  if (field.kind === 'id') return ['is', 'not', 'gt', 'lt', 'gte', 'lte', 'in', 'not_in']
  if (['decimal', 'bigInt', 'timestamp'].includes(field.kind)) return ['contains', 'equals', 'not', 'is_empty', 'not_empty']
  if (['integer', 'float'].includes(field.kind)) return ['equals', 'not', 'lt', 'lte', 'gt', 'gte']
```

```ts
if (type === 'is_empty') return { [field.path]: { equals: null } }
if (type === 'not_empty') return { NOT: [{ [field.path]: { equals: null } }] }
...
if (type === 'not') return { [field.path]: { not: { equals: String(value) } } }
if (['equals', 'contains', 'startsWith', 'endsWith'].includes(type)) return { [field.path]: { [type]: String(value) } }
```

Current target UI in `src/components/dashboard/views/registry.tsx`:

```ts
if (['decimal', 'bigInt', 'timestamp'].includes(kind)) {
  return {
    contains: { label: 'Contains', initialValue: '' },
    equals: { label: 'Equals', initialValue: '' },
    not: { label: 'Does not equal', initialValue: '' },
    is_empty: { label: 'Is empty', initialValue: true, needsValue: false },
    not_empty: { label: 'Is not empty', initialValue: true, needsValue: false },
  }
}
```

Reference semantics in `../next-keystone-starter/features/dashboard/lib/buildWhereClause.ts`:

```ts
timestamp: {
  types: {
    equals: { label: 'Is exactly', initialValue: null },
    not: { label: 'Is not exactly', initialValue: null },
    lt: { label: 'Is before', initialValue: null },
    gt: { label: 'Is after', initialValue: null },
    empty: { label: 'Is empty', initialValue: null },
    not_empty: { label: 'Is not empty', initialValue: null },
  },
```

```ts
decimal: {
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
```

Same pattern exists in the reference bigint view.

## Architecture
- `adminMetaGraphQLQuery` fetches metadata, but filter semantics are not derived from Keystone dynamically.
- The dashboard hardcodes filter operator availability in two places:
  1. `src/features/cms/graphql-client.ts` decides which query-string filter keys are valid and how they compile into GraphQL `where`.
  2. `src/components/dashboard/views/registry.tsx` decides which operators the user can pick in the UI.
- Because both layers currently agree on the wrong operator set for `decimal`, `bigInt`, and `timestamp`, the UI exposes unsupported operators like `contains`, and it omits comparison operators like `gt`, `lt`, `gte`, `lte`.
- This is target-only and directly fixable without touching `../next-keystone-starter`.

## Start Here
Open `src/features/cms/graphql-client.ts` first. It is the source of truth for accepted filter operator keys and GraphQL compilation, so any UI fix in `registry.tsx` must match it.

## Findings
### Next concrete parity gap
**Numeric/date filter operators are still semantically wrong in the target for `decimal`, `bigInt`, and `timestamp` fields.**

Why this is the next fixable gap:
- The items you listed as recently fixed appear present already: singleton `/1` routing, dynamic itemView fieldMode, `fieldPosition` in admin meta/item query, singleton routing, relationship labels/pickers, filter operator work for text/relationship, and `hideCreate`/`hideDelete` wiring.
- However, filter parity is still incomplete because target filter support for these field kinds does not match Keystone semantics or the reference implementation.
- `contains` is not a valid Keystone-style operator for these scalar types.
- `is_empty` is inconsistent with the rest of the target/reference naming, which uses `empty` / `not_empty`.
- `timestamp` is missing `lt`/`gt`; `decimal`/`bigInt` are missing `gt`/`lt`/`gte`/`lte`.

### Exact target files to change
1. `src/features/cms/graphql-client.ts`
2. `src/components/dashboard/views/registry.tsx`

### Minimal implementation
#### 1) In `src/features/cms/graphql-client.ts`
Replace:
```ts
if (['decimal', 'bigInt', 'timestamp'].includes(field.kind)) return ['contains', 'equals', 'not', 'is_empty', 'not_empty']
```
with kind-specific operator sets matching Keystone semantics:
```ts
if (field.kind === 'timestamp') return ['equals', 'not', 'lt', 'gt', 'empty', 'not_empty']
if (field.kind === 'decimal' || field.kind === 'bigInt') return ['equals', 'not', 'lt', 'lte', 'gt', 'gte', 'empty', 'not_empty']
```

Then update `filterWhereForField()` accordingly:
- rename `is_empty` handling to `empty`
- support `lt` / `lte` / `gt` / `gte` for `decimal`, `bigInt`, `timestamp`
- stop allowing `contains` for those kinds
- preserve string serialization for `decimal`, `bigInt`, and `timestamp` comparisons if that matches current controller value format

Minimal shape:
```ts
if (type === 'empty') return { [field.path]: { equals: null } }
if (type === 'not_empty') return { NOT: [{ [field.path]: { equals: null } }] }

if (field.kind === 'decimal' || field.kind === 'bigInt' || field.kind === 'timestamp') {
  if (type === 'not') return { [field.path]: { not: { equals: String(value) } } }
  if (['equals', 'lt', 'lte', 'gt', 'gte'].includes(type)) return { [field.path]: { [type]: String(value) } }
}
```

#### 2) In `src/components/dashboard/views/registry.tsx`
Replace the combined block:
```ts
if (['decimal', 'bigInt', 'timestamp'].includes(kind)) {
  return {
    contains: { label: 'Contains', initialValue: '' },
    equals: { label: 'Equals', initialValue: '' },
    not: { label: 'Does not equal', initialValue: '' },
    is_empty: { label: 'Is empty', initialValue: true, needsValue: false },
    not_empty: { label: 'Is not empty', initialValue: true, needsValue: false },
  }
}
```
with two blocks:
```ts
if (kind === 'timestamp') {
  return {
    equals: { label: 'Is exactly', initialValue: '' },
    not: { label: 'Is not exactly', initialValue: '' },
    lt: { label: 'Is before', initialValue: '' },
    gt: { label: 'Is after', initialValue: '' },
    empty: { label: 'Is empty', initialValue: true, needsValue: false },
    not_empty: { label: 'Is not empty', initialValue: true, needsValue: false },
  }
}
if (kind === 'decimal' || kind === 'bigInt') {
  return {
    equals: { label: 'Is exactly', initialValue: '' },
    not: { label: 'Is not exactly', initialValue: '' },
    lt: { label: 'Is less than', initialValue: '' },
    lte: { label: 'Is less than or equal to', initialValue: '' },
    gt: { label: 'Is greater than', initialValue: '' },
    gte: { label: 'Is greater than or equal to', initialValue: '' },
    empty: { label: 'Is empty', initialValue: true, needsValue: false },
    not_empty: { label: 'Is not empty', initialValue: true, needsValue: false },
  }
}
```

## Risk / constraint notes
- This is a narrow parity fix and does not require schema or server changes.
- There may be saved URLs using old `!field_is_empty` or `contains` tokens for these field kinds; if backward compatibility matters, target could optionally accept legacy aliases in `filterWhereForField()` while no longer exposing them in the UI.
- The current target uses `NOT: [{ field: { equals: null } }]` for scalar `not_empty`; reference uses `{ field: { not: { equals: null } } }`. Both are logically equivalent, so this is not the primary gap.
