# Code Context

## Files Retrieved
1. `../next-keystone-starter/features/dashboard/views/relationship/ClientRelationshipFilter.tsx` (lines 1-91) - reference implementation for Keystone-style relationship filter UI using `RelationshipSelect`.
2. `../next-keystone-starter/features/dashboard/views/relationship/client/components/RelationshipSelect.tsx` (lines 1-228) - reference relationship chooser supports search and paged option loading.
3. `src/components/dashboard/views/registry.tsx` (lines 47-78, 146, 223-240) - target relationship filter controller currently renders a plain text `<Input>` for relationship filters.
4. `src/components/dashboard/filter-bar.tsx` (lines 115-189) - target filter popover already delegates value editing to each field controller’s `Filter` component, so relationship parity can be fixed at the controller layer.
5. `src/features/cms/graphql-client.ts` (lines 328-337) - target backend already supports Keystone-style relationship filter operators (`empty`, `not_empty`, `is`, `not_is`, `some`, `not_some`).
6. `src/components/dashboard/relationship-field-editor.tsx` (lines 1-113) - target already has query-backed relationship option loading and create-link behavior that can be reused/adapted.
7. `src/features/cms/admin-meta-query.ts` (lines 1-47) - target admin meta already exposes `labelField`, `initialSearchFields`, `hideCreate`, etc., so the filter UI has enough metadata.

## Key Code
Reference behavior in next-keystone-starter:

```tsx
// ../next-keystone-starter/features/dashboard/views/relationship/ClientRelationshipFilter.tsx
if (type === 'is' || type === 'not_is') {
  return (
    <RelationshipSelect
      autoFocus={autoFocus}
      list={refList}
      labelField={refLabelField}
      searchFields={refSearchFields}
      state={state}
      controlShouldRenderValue
    />
  )
}

return (
  <RelationshipSelect
    autoFocus={autoFocus}
    list={refList}
    labelField={refLabelField}
    searchFields={refSearchFields}
    state={state}
    controlShouldRenderValue
  />
)
```

Target currently uses raw text entry for relationship filters:

```tsx
// src/components/dashboard/views/registry.tsx
function relationshipFilterController(field: DashboardField): FilterController {
  const many = Boolean(field.fieldMeta.many)
  return {
    types: many ? { ... } : { ... },
    Filter: ({ value, onChange, autoFocus }) => (
      <Input
        value={relationshipFilterInputValue(value)}
        onChange={(event) => onChange(many ? parseRelationshipIds(event.target.value) : event.target.value)}
        autoFocus={autoFocus}
        placeholder={many ? 'Related item ids, comma separated' : 'Related item id'}
      />
    ),
  }
}
```

But the target query layer is already ready for richer relationship filters:

```ts
// src/features/cms/graphql-client.ts
if (type === 'is') return { [field.path]: { id: { equals: String(value) } } }
if (type === 'not_is') return { [field.path]: { not: { id: { equals: String(value) } } } }
if (type === 'some') return { [field.path]: { some: { id: { in: relationshipFilterIds(value) } } } }
if (type === 'not_some') return { [field.path]: { not: { some: { id: { in: relationshipFilterIds(value) } } } } }
```

And the filter bar already renders controller-specific inputs:

```tsx
// src/components/dashboard/filter-bar.tsx
{ActiveFilterInput ? (
  <ActiveFilterInput
    value={filterValue}
    onChange={setFilterValue}
    type={activeFilterType.type}
    field={activeFilterField}
    context="add"
  />
) : ...}
```

## Architecture
- `src/components/dashboard/filter-bar.tsx` builds the filter popover and delegates each field’s input UI to `field.controller.filter.Filter`.
- `src/components/dashboard/views/registry.tsx` is the source of truth for those field controllers.
- `src/features/cms/graphql-client.ts` converts URL filter params like `!assignee_is` or `!tags_some` into GraphQL `where` clauses.
- Therefore, relationship-filter parity is mostly a UI/controller gap, not a backend/query gap.
- The target already has a working relationship option loader in `src/components/dashboard/relationship-field-editor.tsx`, plus admin meta includes related-list label/search metadata.

## Start Here
Open `src/components/dashboard/views/registry.tsx` first. That is where the parity gap lives: relationship filters are still plain text ID inputs instead of the Keystone-style searchable relationship picker used by next-keystone-starter.

## Next single concrete fixable parity gap
**Gap:** Relationship filters in the target dashboard are still edited as raw ID text / comma-separated IDs, while `next-keystone-starter` uses a searchable relationship picker (`RelationshipSelect`) for `is`, `not_is`, `some`, and `not_some`.

### Why this is the next fix
- The recently-fixed backend/query parity is already present in target.
- This is a user-visible parity gap still remaining after those fixes.
- It is isolated and fixable with minimal surface area.

### Exact files to change
1. `src/components/dashboard/views/registry.tsx`
2. **Likely add one small helper component** such as `src/components/dashboard/views/relationship-filter-input.tsx`

### Minimal implementation
1. In `registry.tsx`, replace the relationship `Filter` renderer so it no longer returns a plain `<Input>`.
2. Add a small client component that:
   - accepts `field`, `value`, `onChange`, `type`, `autoFocus`
   - resolves the related list from admin meta using `field.fieldMeta.refListPath` / `field.fieldMeta.ref`
   - uses the target’s existing relationship-options query path (`fetchKeystoneAdminMeta` + `fetchDashboardRelationshipOptions`, or shared logic extracted from `relationship-field-editor.tsx`)
   - renders a single-select for `is` / `not_is`
   - renders a multi-select for `some` / `not_some`
   - uses related list `labelField` and `initialSearchFields`
3. Keep `empty` / `not_empty` with no input UI.
4. Preserve current serialized values:
   - single filters -> string id or `null`
   - many filters -> `string[]`
   so `buildWhere` in `src/features/cms/graphql-client.ts` keeps working unchanged.

### Smallest possible approach
The smallest safe change is **not** to touch query serialization or filter-bar logic. Only swap the relationship filter input implementation from text input to a query-backed selector component.

### Risk / constraint
- `registry.tsx` is used inside the dashboard filter popover; any new picker component should be client-safe and avoid server-only imports.
- Reuse the target’s existing relationship option fetching patterns to avoid introducing new API behavior.
- If you copy the next-keystone-starter pattern, map it onto the target’s normalized admin meta (`labelField`, `initialSearchFields`, `hideCreate`, `graphql.names`).
