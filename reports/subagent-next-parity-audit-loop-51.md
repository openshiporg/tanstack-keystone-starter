# Next Parity Audit Loop 51

## Next single concrete parity gap

**Relationship fields are still not filterable in the target list UI/query pipeline, while `next-keystone-starter` already exposes Keystone-style relationship filter controllers (`is` / `not_is` / `some` / `not_some` plus empty checks).**

This is the next clean, fixable parity gap after the fixes you listed because:
- it is still a clear Next-vs-target behavioral delta,
- it affects a high-value list workflow,
- the missing support is localized to the target’s field-view/controller registry plus the shared where-builder,
- the target already has the metadata needed (`field.kind === 'relationship'`, `field.fieldMeta.many`, `refListPath`, item labels/ids).

---

## Evidence

### Next already ships relationship filter controllers
In Next, the relationship field view exports a real filter controller with relationship-specific operators and UI:

- `../next-keystone-starter/features/dashboard/views/relationship/index.tsx` (lines 460-522)
  - `filter.Filter(...)` renders `ClientRelationshipFilter` for non-empty filters
  - `graphql(...)` maps operators to Keystone relationship where clauses
  - `types` exposes:
    - to-one: `is`, `not_is`
    - to-many: `some`, `not_some`
    - both: `empty`, `not_empty`

Key Next code:
```tsx
filter: {
  Filter: ({ value, onChange, type, autoFocus }: any) => {
    if (type === 'empty' || type === 'not_empty') return null
    return (
      <ClientRelationshipFilter
        value={value}
        onChange={onChange}
        type={type}
        autoFocus={autoFocus}
        refListKey={config.fieldMeta.refListKey}
        refLabelField={refLabelField || 'name'}
        refSearchFields={refSearchFields || ['name']}
      />
    )
  },
  graphql: ({ type, value }) => {
    const many = config.fieldMeta.many || false
    if (type === 'empty' && !many) return { [config.path]: { equals: null } }
    if (type === 'empty' && many) return { [config.path]: { none: {} } }
    if (type === 'not_empty' && !many) return { [config.path]: { not: { equals: null } } }
    if (type === 'not_empty' && many) return { [config.path]: { some: {} } }
    if (type === 'is') return { [config.path]: { id: { equals: value } } }
    if (type === 'not_is') return { [config.path]: { not: { id: { equals: value } } } }
    if (type === 'some') return { [config.path]: { some: { id: { in: value } } } }
    if (type === 'not_some') return { [config.path]: { not: { some: { id: { in: value } } } } }
  },
  types: {
    empty: { label: 'Is empty', initialValue: null },
    not_empty: { label: 'Is not empty', initialValue: null },
    ...(config.fieldMeta.many
      ? {
          some: { label: 'Is one of', initialValue: [] },
          not_some: { label: 'Is not one of', initialValue: [] },
        }
      : {
          is: { label: 'Is', initialValue: null },
          not_is: { label: 'Is not', initialValue: null },
        }),
  },
}
```

### Target registry does not provide any relationship filter controller
The target’s generic view registry only creates scalar filter controllers for text/number/select/checkbox/multiselect kinds.

- `src/components/dashboard/views/registry.tsx` (lines 21-74)
  - `scalarFilterController(kind, field)` only handles scalar kinds
  - `filterTypesForField(kind)` returns nothing for `relationship`

- `src/components/dashboard/views/registry.tsx` (lines 84-97)
  - `makeController(...)` always sets `filter: scalarFilterController(kind, field)`
  - therefore relationship fields get **no** `controller.filter`

Key target code:
```tsx
function filterTypesForField(kind: string): Record<string, FilterTypeMeta> | undefined {
  if (['text', 'select', 'decimal', 'bigInt', 'timestamp', 'id'].includes(kind)) { ... }
  if (['integer', 'float'].includes(kind)) { ... }
  if (kind === 'checkbox') { ... }
  if (kind === 'multiselect') return { contains: { label: 'Has value', initialValue: '' } }
  return undefined
}

function makeController(kind: string, field: DashboardField) {
  return function controller(_args: ControllerArgs) {
    return {
      ...
      filter: scalarFilterController(kind, field),
    }
  }
}
```

### Target list filter UI only includes fields whose controllers expose `filter`
Because relationship fields have no filter controller in the registry, they never appear in the filter UI.

- `src/components/dashboard/filter-bar.tsx` (lines 68-76)
  - builds `enhancedFields = enhanceFields(list.fields, list.key)`
  - `filterableFields` only includes fields with `field.controller.filter`

```tsx
const enhancedFields = useMemo(() => enhanceFields(list.fields, list.key), [list.fields, list.key])
const filterableFields = useMemo(
  () => Object.values(enhancedFields).filter((field) => field.isFilterable && field.controller.filter),
  [enhancedFields]
)
```

So even though relationship fields may be `isFilterable`, the target UI cannot add or edit relationship filters.

### Target query builder also lacks relationship operator mapping
The target server/client query builder only recognizes scalar filter types by field kind.

- `src/features/cms/graphql-client.ts` (lines 315-357)
  - `filterTypesForFieldKind(kind)` returns scalar operators only
  - `filterWhereForField(...)` has no `relationship` branch

Key target code:
```ts
function filterTypesForFieldKind(kind: string) {
  if (['text', 'select', 'decimal', 'bigInt', 'timestamp', 'id'].includes(kind)) return ['contains', 'equals', 'not', 'is_empty', 'not_empty']
  if (['integer', 'float'].includes(kind)) return ['equals', 'not', 'lt', 'lte', 'gt', 'gte']
  if (kind === 'checkbox') return ['equals', 'not']
  if (kind === 'multiselect') return ['contains']
  return []
}
```

That means even if someone manually appends relationship filter params to the URL, the target won’t convert them into Keystone relationship `where` clauses.

---

## Why this is the right next fix

This is smaller and more targeted than broader auth/layout gaps:
- one missing field-kind contract,
- one list UI surface,
- one shared query translation path.

It also unlocks parity across both:
- filter picker visibility,
- active filter editing,
- actual GraphQL `where` execution.

---

## Minimal implementation

### 1) Add relationship filter controller support in the target view registry
**Primary file:** `src/components/dashboard/views/registry.tsx`

Implement a relationship-specific filter controller alongside `scalarFilterController(...)`.

Minimal behavior to match Next:
- for to-one relationships (`!field.fieldMeta.many`):
  - `is`, `not_is`, `empty`, `not_empty`
- for to-many relationships (`field.fieldMeta.many`):
  - `some`, `not_some`, `empty`, `not_empty`
- UI can be minimal at first:
  - to-one: plain text input for related item id
  - to-many: comma-separated ids or a simple multi-value text input
- wire `makeController(...)` so `kind === 'relationship'` returns this new controller instead of `scalarFilterController(...)`

Minimal patch shape:
- add `relationshipFilterController(field)`
- in `makeController(...)`, set:
  - `filter: kind === 'relationship' ? relationshipFilterController(field) : scalarFilterController(kind, field)`

### 2) Teach the shared where-builder to understand relationship filters
**Primary file:** `src/features/cms/graphql-client.ts`

Extend both helper functions:

- `filterTypesForFieldKind(kind)`
  - add relationship types, ideally conditional on `field.fieldMeta.many`
  - since the current helper only receives `kind`, the smallest clean change is to make it take `field: DashboardField` instead

- `filterWhereForField(field, type, value)`
  - add relationship cases:
    - `empty` / `not_empty`
    - to-one `is` / `not_is`
    - to-many `some` / `not_some`

Suggested mappings:
```ts
if (field.kind === 'relationship') {
  const many = Boolean(field.fieldMeta.many)
  if (type === 'empty' && !many) return { [field.path]: { equals: null } }
  if (type === 'empty' && many) return { [field.path]: { none: {} } }
  if (type === 'not_empty' && !many) return { [field.path]: { not: { equals: null } } }
  if (type === 'not_empty' && many) return { [field.path]: { some: {} } }
  if (type === 'is') return { [field.path]: { id: { equals: String(value) } } }
  if (type === 'not_is') return { [field.path]: { not: { id: { equals: String(value) } } } }
  if (type === 'some') return { [field.path]: { some: { id: { in: Array.isArray(value) ? value.map(String) : [String(value)] } } } }
  if (type === 'not_some') return { [field.path]: { not: { some: { id: { in: Array.isArray(value) ? value.map(String) : [String(value)] } } } } }
}
```

### 3) Keep the first pass minimal
Do **not** block this fix on porting Next’s full `ClientRelationshipFilter` search UI.

For parity closure at the contract level, the smallest acceptable first implementation is:
- relationship fields appear in the filter menu,
- URL params round-trip,
- filters build correct GraphQL `where` clauses.

A richer async relationship picker can come later if needed.

---

## Exact files to change

1. `src/components/dashboard/views/registry.tsx`
   - add relationship filter controller support
   - route `makeController(...)` to it for `kind === 'relationship'`

2. `src/features/cms/graphql-client.ts`
   - extend filter type discovery for relationship fields
   - extend `filterWhereForField(...)` for relationship `where` generation

---

## Recommended first file to open

**Open `src/components/dashboard/views/registry.tsx` first.**

That is the root cause of the missing UI parity: relationship fields currently never expose `controller.filter`, so they are excluded from the target filter bar before query-building even runs.