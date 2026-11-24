# Code Context

## Files Retrieved
1. `src/components/dashboard/filter-bar.tsx` (lines 1-428) - target list-controls implementation; add-filter and active-filter editing are present, but still use simplified native inputs and hardcoded filter labels/types.
2. `src/components/ui/popover.tsx` (lines 1-22) - confirms the target already has a reusable popover primitive available for filter UI.
3. `src/features/cms/graphql-client.ts` (lines 249-315) - target backend/query contract for filters and sorting; shows supported filter operators and proves the gap is UI/controller parity, not URL/query semantics.
4. `../next-keystone-starter/features/dashboard/components/FilterBar.tsx` (lines 1-150) - reference composition that delegates to `FilterAdd`, `FilterList`, `SortSelection`, and `FieldSelection`.
5. `../next-keystone-starter/features/dashboard/components/FilterAdd.tsx` (lines 34-214) - reference add-filter flow uses enhanced field controllers, controller-provided filter types, and per-field `Filter` UI.
6. `../next-keystone-starter/features/dashboard/components/FilterList.tsx` (lines 41-278) - reference active-filter pills use enhanced field controllers, controller-provided `Label`, and per-field edit widgets.
7. `../next-keystone-starter/features/dashboard/utils/enhanceFields.ts` (lines 1-79) - reference utility that hydrates admin meta fields into Keystone-compatible controller/view objects.

## Key Code

### Target still uses a hardcoded, generic filter system
`src/components/dashboard/filter-bar.tsx:20-49`
```ts
type FilterType = 'contains' | 'equals' | 'not' | 'lt' | 'lte' | 'gt' | 'gte' | 'is_empty' | 'not_empty'

function filterTypesForField(field: DashboardField): Array<{ type: FilterType; label: string; needsValue?: boolean }> {
  if (['text', 'select', 'decimal', 'bigInt', 'timestamp', 'id'].includes(field.kind)) {
    return [
      { type: 'contains', label: 'Contains' },
      { type: 'equals', label: 'Equals' },
      { type: 'not', label: 'Does not equal' },
      { type: 'is_empty', label: 'Is empty', needsValue: false },
      { type: 'not_empty', label: 'Is not empty', needsValue: false },
    ]
  }
  ...
}
```

`src/components/dashboard/filter-bar.tsx:142-159`
```tsx
<label className="grid gap-1.5 text-sm">
  <span className="font-medium">Condition</span>
  <select ...>
    {activeFilterTypes.map((option) => <option key={option.type} value={option.type}>{option.label}</option>)}
  </select>
</label>
{activeFilterType.needsValue === false ? null : (
  <label className="grid gap-1.5 text-sm">
    <span className="font-medium">Value</span>
    <Input value={filterValue} onChange={(event) => setFilterValue(event.target.value)} placeholder="Filter value" />
  </label>
)}
```

`src/components/dashboard/filter-bar.tsx:400-411`
```tsx
<DropdownMenuContent align="start" className="w-72 p-3">
  ...
  {filterOption.needsValue === false ? null : (
    <Input value={draftValue} onChange={(event) => setDraftValue(event.target.value)} autoFocus placeholder="Filter value" />
  )}
  ...
</DropdownMenuContent>
```

This means the target can only render a plain text input for filter values and can only show filter labels derived from local string tables.

### Next reference uses field controllers for filter UI and labels
`../next-keystone-starter/features/dashboard/utils/enhanceFields.ts:58-74`
```ts
controller: (views as any).controller({
  listKey: listKey,
  fieldMeta: field.fieldMeta,
  label: field.label,
  description: field.description,
  path: field.path,
  customViews,
}),
```

`../next-keystone-starter/features/dashboard/components/FilterAdd.tsx:118-127`
```tsx
const field = filterableFields[fieldPath]
const firstFilterType = Object.keys(field.controller.filter.types)[0]
setState({
  kind: "filter-value",
  fieldPath,
  filterType: firstFilterType,
  filterValue: field.controller.filter.types[firstFilterType].initialValue
})
```

`../next-keystone-starter/features/dashboard/components/FilterAdd.tsx:173-187`
```tsx
const field = filterableFields[state.fieldPath!]
const Filter = field.controller.filter.Filter

return (
  <Filter
    value={state.filterValue}
    onChange={(value) => {
      setState({ ...state, filterValue: value })
    }}
    type={state.filterType}
  />
)
```

`../next-keystone-starter/features/dashboard/components/FilterList.tsx:154-163`
```tsx
if (field.controller?.filter?.Label) {
  const filterTypeLabel = field.controller.filter.types[filter.type]?.label || filter.type
  return field.controller.filter.Label({
    label: filterTypeLabel,
    type: filter.type,
    value: filter.value
  })
}
```

`../next-keystone-starter/features/dashboard/components/FilterList.tsx:218-225`
```tsx
<Filter
  autoFocus
  context="edit"
  type={operator}
  value={value as string | number | boolean}
  onChange={onChange}
/>
```

So in Next, the valid operators, initial values, value widgets, and pill labels all come from each field’s Keystone controller, not from hardcoded UI logic.

### Target backend contract already supports the URL/query side
`src/features/cms/graphql-client.ts:249-261`
```ts
function filterWhereForField(field: DashboardField, type: string, value: unknown) {
  if (type === 'is_empty') return { [field.path]: { equals: null } }
  if (type === 'not_empty') return { NOT: [{ [field.path]: { equals: null } }] }
  if (field.kind === 'checkbox') return { [field.path]: { [type === 'not' ? 'not' : 'equals']: Boolean(value) } }
  if (field.kind === 'integer' || field.kind === 'float') {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return undefined
    return { [field.path]: { [type]: numeric } }
  }
  if (field.kind === 'multiselect') return { [field.path]: { has: String(value) } }
  if (type === 'not') return { [field.path]: { not: { equals: String(value) } } }
  if (['equals', 'contains', 'startsWith', 'endsWith'].includes(type)) return { [field.path]: { [type]: String(value) } }
}
```

This confirms the next parity gap is on the field-controller-driven filter UI layer, not in router state or GraphQL filtering.

## Architecture
- `src/routes/dashboard/$listKey.tsx` mounts `src/components/dashboard/filter-bar.tsx` for list pages.
- In the target, `FilterBar` owns all filter creation, active-pill rendering, and editing in one file using `DashboardField.kind` heuristics.
- In Next, `FilterBar` delegates to `FilterAdd` and `FilterList`, both of which rely on `enhanceFields()` to attach Keystone field controllers.
- Those controllers provide:
  - available filter types,
  - default filter values,
  - field-specific filter widgets,
  - human-readable label formatting.
- Because the target does not hydrate controllers, it cannot reach parity for checkbox/select/relationship/date-like filter UX even though the URL contract is already mostly compatible.

## Start Here
Open `src/components/dashboard/filter-bar.tsx` first. It is the current choke point for filter UI and shows exactly where hardcoded filter controls should be replaced by controller-driven behavior.

## Next single concrete fixable parity gap
**Gap:** The target still lacks Keystone-style enhanced field controllers for dashboard filters, so add/edit filter popovers use generic native inputs and hardcoded operator/label logic instead of field-specific `controller.filter` behavior used by Next.

### Exact files
- Target: `src/components/dashboard/filter-bar.tsx`
- New target helper likely needed: `src/components/dashboard/enhance-fields.ts` or `src/features/cms/enhance-fields.ts`
- Reference: `../next-keystone-starter/features/dashboard/utils/enhanceFields.ts`
- Reference: `../next-keystone-starter/features/dashboard/components/FilterAdd.tsx`
- Reference: `../next-keystone-starter/features/dashboard/components/FilterList.tsx`

### Minimal implementation
1. Add a small target `enhanceFields()` helper mirroring the Next utility’s purpose: turn dashboard admin-meta fields into enhanced fields with a `controller` object from the field views registry.
2. In `src/components/dashboard/filter-bar.tsx`, derive `enhancedFields` and `filterableFields` from that helper instead of from `field.kind` heuristics.
3. Replace `filterTypesForField()`-driven operator lists with `field.controller.filter.types` so available operators and their labels come from the field controller.
4. In the add-filter popover, replace the generic `<Input>` value editor with `const Filter = field.controller.filter.Filter` and render `<Filter value=... onChange=... type=... />`.
5. In active filter pills/edit UI, replace local label formatting with `field.controller.filter.Label(...)` when available, and use the same `Filter` component for editing.
6. Preserve the existing URL contract (`!fieldPath_filterType`, JSON-stringified value, `page: 1` reset) so no route/backend changes are required.

### Why this is the next best fix
- The prompt’s named fixes were re-checked and appear already handled in the target.
- The remaining divergence is now deeper than layout: the target filter UX is still structurally less capable than Next.
- This is still a single, concrete, local parity task centered on list filters.
- It unlocks multiple user-visible parity improvements at once: correct per-field operators, proper boolean/select widgets, and Keystone-style active-filter labeling/editing.