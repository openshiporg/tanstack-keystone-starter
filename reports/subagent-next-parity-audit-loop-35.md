# Code Context

## Files Retrieved
1. `src/components/dashboard/filter-bar.tsx` (lines 1-210) - current list filter UI builds filter options from `enhanceFields(...).controller.filter`, so missing filter controllers in field views directly remove parity in the UI.
2. `src/components/dashboard/views/registry.tsx` (lines 1-199) - current field views registry only provides scalar filter controllers; `relationship` fields get no `controller.filter`, so they never appear in the filter picker.
3. `src/features/cms/graphql-client.ts` (lines 240-358) - current GraphQL where-builder only supports scalar kinds plus `multiselect`; relationship filter operators are not translated into GraphQL.
4. `src/routes/dashboard/$listKey.tsx` (lines 1-105) - confirms list pages always render `FilterBar`, so the gap is centrally fixable.
5. `../next-keystone-starter/features/dashboard/views/relationship/index.tsx` (lines 448-517) - reference implementation for relationship field controller filter UI/types/GraphQL behavior.
6. `../next-keystone-starter/features/dashboard/lib/buildWhereClause.ts` (lines 260-340) - reference implementation showing relationship-specific filter types and GraphQL condition shapes.
7. `../next-keystone-starter/features/dashboard/components/FilterBar.tsx` (lines 1-180) - reference app uses enhanced field controllers to surface relationship filters through the same filter bar path.

## Key Code
Current target registry only exposes scalar filters:

```tsx
// src/components/dashboard/views/registry.tsx
function filterTypesForField(kind: string): Record<string, FilterTypeMeta> | undefined {
  if (['text', 'select', 'decimal', 'bigInt', 'timestamp', 'id'].includes(kind)) {
    return {
      contains: { label: 'Contains', initialValue: '' },
      equals: { label: 'Equals', initialValue: '' },
      not: { label: 'Does not equal', initialValue: '' },
      is_empty: { label: 'Is empty', initialValue: true, needsValue: false },
      not_empty: { label: 'Is not empty', initialValue: true, needsValue: false },
    }
  }
  ...
  if (kind === 'multiselect') return { contains: { label: 'Has value', initialValue: '' } }
  return undefined
}
```

`FilterBar` only includes fields where `field.controller.filter` exists:

```tsx
// src/components/dashboard/filter-bar.tsx
const enhancedFields = useMemo(() => enhanceFields(list.fields, list.key), [list.fields, list.key])
const filterableFields = useMemo(
  () => Object.values(enhancedFields).filter((field) => field.isFilterable && field.controller.filter),
  [enhancedFields]
)
```

Current backend where translation has no relationship branch:

```ts
// src/features/cms/graphql-client.ts
function filterWhereForField(field: DashboardField, type: string, value: unknown) {
  if (type === 'is_empty') return { [field.path]: { equals: null } }
  if (type === 'not_empty') return { NOT: [{ [field.path]: { equals: null } }] }
  if (field.kind === 'checkbox') ...
  if (field.kind === 'integer' || field.kind === 'float') ...
  if (field.kind === 'multiselect') ...
  if (type === 'not') ...
  if (['equals', 'contains', 'startsWith', 'endsWith'].includes(type)) ...
  return undefined
}
```

Reference app implements relationship filter types in the relationship view controller:

```tsx
// ../next-keystone-starter/features/dashboard/views/relationship/index.tsx
filter: {
  Filter: ({ value, onChange, type, autoFocus }) => {
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
    ...(config.fieldMeta.many ? {
      some: { label: 'Is one of', initialValue: [] },
      not_some: { label: 'Is not one of', initialValue: [] },
    } : {
      is: { label: 'Is', initialValue: null },
      not_is: { label: 'Is not', initialValue: null },
    }),
  },
}
```

## Architecture
- List pages load list metadata and items through `fetchDashboardListPage()` in `src/features/cms/graphql-client.ts`.
- `FilterBar` derives available filters entirely from `enhanceFields(list.fields, list.key)`, which in turn depends on `getFieldViews(...).controller(...)`.
- Because `src/components/dashboard/views/registry.tsx` is the single synthetic field-view registry in the target app, any missing filter controller there removes parity both from the add-filter UI and from filter pill editing.
- Even after adding UI support, requests still fail to match parity unless `filterWhereForField()` in `src/features/cms/graphql-client.ts` can translate relationship filter tokens into Keystone-compatible GraphQL `where` clauses.

## Start Here
Open `src/components/dashboard/views/registry.tsx` first. That is the narrowest parity chokepoint: it decides whether relationship fields expose filter types/UI at all.

## Next concrete parity gap
**Relationship field filtering is still missing in the target app.**

This remains after the cited fixes because:
- relationship cells now render correctly,
- list table now delegates to field views `Cell`,
- no-filterable guards exist,
- but `relationship` fields still do **not** appear in the filter UI and their query operators are not translated server-side.

## Minimal implementation
1. **Add relationship filter controller support in `src/components/dashboard/views/registry.tsx`.**
   - Extend `filterTypesForField`/controller creation so `field.kind === 'relationship'` returns Keystone-like types based on `field.fieldMeta.many`:
     - single: `is`, `not_is`, `is_empty`, `not_empty`
     - many: `some`, `not_some`, `is_empty`, `not_empty`
   - For non-empty relationship filters, render the existing relationship picker UI instead of a plain `<Input>`.
   - The lowest-risk option is to reuse `src/components/dashboard/relationship-field-editor.tsx` or extract a small shared selector component from it for filter mode.

2. **Teach `src/features/cms/graphql-client.ts` to serialize relationship filters.**
   - In `filterWhereForField()`, add a `field.kind === 'relationship'` branch:
     - single `is_empty` → `{ [path]: { equals: null } }`
     - single `not_empty` → `{ [path]: { not: { equals: null } } }`
     - single `is` → `{ [path]: { id: { equals: value } } }`
     - single `not_is` → `{ [path]: { not: { id: { equals: value } } } }`
     - many `is_empty` → `{ [path]: { none: {} } }`
     - many `not_empty` → `{ [path]: { some: {} } }`
     - many `some` → `{ [path]: { some: { id: { in: valueArray } } } }`
     - many `not_some` → `{ [path]: { not: { some: { id: { in: valueArray } } } } }`

## Why this is the next fix
It is a single, contained parity gap with a direct comparison target and no prerequisite refactor. It affects both discoverability and behavior of filters for one of the highest-value field kinds, and the existing architecture already has the needed metadata (`fieldMeta.many`, ref list info, relationship options query path) to implement it cleanly.