# Code Context

## Files Retrieved
1. `src/components/dashboard/views/relationship-filter-input.tsx` (lines 1-110) - target relationship filter UI; currently renders selected IDs directly and only fetches paged search options.
2. `src/components/dashboard/views/registry.tsx` (lines 1-120) - target filter controller wiring for relationship fields; establishes `is/not_is/some/not_some/empty/not_empty` types and mounts `RelationshipFilterInput`.
3. `src/features/cms/graphql-client.ts` (lines 302-405, 537-560) - target GraphQL where-building and relationship options query helper; already supports relationship filter operators and generic options pagination/count.
4. `../next-keystone-starter/features/dashboard/views/relationship/ClientRelationshipFilter.tsx` (lines 1-80) - reference filter wrapper in next app; delegates filter selection to shared relationship select UI.
5. `../next-keystone-starter/features/dashboard/views/relationship/client/components/RelationshipSelect.tsx` (lines 1-220) - reference relationship select; uses query-backed search and keeps selected option objects with labels.
6. `../next-keystone-starter/features/dashboard/views/relationship/index.tsx` (lines 120-218, 430-510) - reference relationship filter value hydration and filter controller GraphQL mapping.
7. `../next-keystone-starter/features/dashboard/actions/getList.ts` (lines 1-39) - reference helper for loading related list metadata in relationship filter/select flow.
8. `../next-keystone-starter/features/dashboard/actions/relationship.ts` (lines 1-43) - reference relationship options loader with items + count.

## Key Code

### Target behavior today
`src/components/dashboard/views/relationship-filter-input.tsx`:
```tsx
function selectedIds(value: unknown) {
  if (Array.isArray(value)) return value.map((entry) => String(entry)).filter(Boolean)
  const stringValue = String(value ?? '').trim()
  return stringValue ? [stringValue] : []
}
...
{ids.length ? (
  <div className="flex flex-wrap gap-1.5">
    {ids.map((id) => (
      <span key={id} ...>
        {id}
```
The component only knows selected IDs. It never resolves those IDs back to labels.

It also only queries paged option search results:
```tsx
const { data: optionsData = { items: [], count: 0 } } = useQuery({
  queryKey: dashboardQueryKeys.relationshipOptions(relatedList?.path ?? listKey, search, pageSize, page * pageSize),
  queryFn: () => fetchDashboardRelationshipOptions({ listKey: relatedList?.path ?? listKey, search, take: pageSize, skip: page * pageSize }),
})
```
So if the selected item is not in the current search page, the UI can only display raw IDs.

### Target wiring already exists
`src/components/dashboard/views/registry.tsx`:
```tsx
Filter: ({ value, onChange, type, autoFocus }) => {
  if (type === 'empty' || type === 'not_empty') return null
  return <RelationshipFilterInput field={field} value={value} onChange={onChange} type={type} autoFocus={autoFocus} />
}
```
Relationship operators themselves are already Keystone-style in target and already match backend where-building.

`src/features/cms/graphql-client.ts`:
```ts
if (field.kind === 'relationship') {
  const many = Boolean(field.fieldMeta.many)
  if (type === 'empty' && !many) return { [field.path]: { equals: null } }
  if (type === 'empty' && many) return { [field.path]: { none: {} } }
  if (type === 'not_empty' && !many) return { [field.path]: { not: { equals: null } } }
  if (type === 'not_empty' && many) return { [field.path]: { some: {} } }
  if (type === 'is') return { [field.path]: { id: { equals: String(value) } } }
  if (type === 'not_is') return { [field.path]: { not: { id: { equals: String(value) } } } }
  if (type === 'some') return { [field.path]: { some: { id: { in: relationshipFilterIds(value) } } } }
  if (type === 'not_some') return { [field.path]: { not: { some: { id: { in: relationshipFilterIds(value) } } } } }
}
```
This means the remaining gap is UI hydration, not query semantics.

### Reference behavior
`../next-keystone-starter/features/dashboard/views/relationship/ClientRelationshipFilter.tsx` passes selected objects into `RelationshipSelect`:
```tsx
const currentValue = typeof value === 'string'
  ? { id: value, label: value, built: false }
  : null
...
const values = ids.map((id) => ({ id, label: id, built: false }))
```
Then `RelationshipSelect` is query-backed and upgrades selections to real option objects with labels while searching/selecting.

More importantly, `../next-keystone-starter/features/dashboard/views/relationship/index.tsx` contains explicit selected-value hydration for filter chips:
```tsx
function useRelationshipFilterValues({ value, list, prefetchedValues }: { ... }) {
  const foreignIds = getForeignIds(value);
  const where = { id: { in: foreignIds } };
  ... fetch items by ids ...
  const resolvedFilterValues = data
    ? data.map((item: any) => ({ id: item.id, label: item[labelField] || item.id }))
    : foreignIds.map((f: string) => ({ label: f, id: f }));
}
```
That is the parity feature target still lacks.

## Architecture
- List route search params are parsed in `src/routes/dashboard/$listKey.tsx`; all `!field_operator` params are passed through as `filters` into `fetchDashboardListPage`.
- `src/features/cms/graphql-client.ts` converts those search params into GraphQL where clauses with `filterWhereForField()` and `buildWhere()`.
- UI filter metadata is driven from field controllers in `src/components/dashboard/views/registry.tsx`.
- Relationship filter UI is a special case rendered by `src/components/dashboard/views/relationship-filter-input.tsx`.
- That component already has access to related list metadata and paged options search, so the smallest parity fix is to add one extra query for selected IDs and use hydrated labels in the selected-pill rendering.

## Start Here
Open `src/components/dashboard/views/relationship-filter-input.tsx` first. It is the narrowest, self-contained UI parity gap and likely only needs a small targeted change.

## Next single concrete fixable parity gap
**Gap:** Relationship filter UI does not hydrate selected IDs to labels, so applied/selected values show raw IDs instead of related item labels unless the chosen item happens to be in the current options page. The next-keystone-starter flow is query-backed for selected relationship values; target is only query-backed for searchable options.

### Why this is the next fix
All previously listed parity areas in your prompt are already present in target:
- load-more accumulates options: present in `relationship-filter-input.tsx`
- query-backed relationship filter: present, but incomplete for selected-value hydration
- options pagination/count: present in `fetchDashboardRelationshipOptions()`
- Keystone-style relationship operators: present in `registry.tsx` + `graphql-client.ts`
- hideCreate/hideDelete/adminMeta/singleton items: present in routes/runtime

This leaves a smaller, concrete UI parity defect adjacent to the relationship filter work.

### Minimal implementation
1. **Edit `src/components/dashboard/views/relationship-filter-input.tsx` only.**
2. Add a second query that resolves currently selected IDs by calling `fetchDashboardRelationshipOptions({ listKey, search: '', take: ids.length, skip: 0 })` is **not sufficient**, because it does not filter by IDs. So either:
   - add a tiny dedicated helper in `src/features/cms/graphql-client.ts` to fetch relationship options by explicit `id in [...]`, or
   - extend `fetchDashboardRelationshipOptions` with an optional `ids?: string[]` parameter that overrides `where` with `{ id: { in: ids } }`.
3. In `RelationshipFilterInput`, map selected IDs to hydrated labels from that query and render pills using labels:
```tsx
const selectedOptionMap = new Map(selectedOptions.items.map((item) => [item.id, item.label]))
...
{selectedOptionMap.get(id) ?? id}
```
4. Keep current fallback-to-ID behavior while hydration is loading.

### Exact files likely to change
- `src/components/dashboard/views/relationship-filter-input.tsx`
- `src/features/cms/graphql-client.ts` *(only if you choose the cleaner reusable helper/optional ids param)*

### Lowest-risk version
Prefer adding a tiny helper in `graphql-client.ts`, e.g. `fetchDashboardRelationshipOptionsByIds({ listKey, ids })`, rather than overloading the existing search helper. That keeps existing option-search behavior untouched and makes the UI change explicit.

### Risk/constraint
- Do not rely on the paged search query to resolve selected labels; selected items may not be in the first page.
- Preserve current filter value shapes: single uses string, many uses string[]. Backend where-building already expects that.
- Keep empty/not_empty behavior unchanged; those intentionally render no input.
