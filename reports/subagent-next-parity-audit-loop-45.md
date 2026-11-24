# Code Context

## Files Retrieved
1. `src/features/cms/graphql-client.ts` (lines 275-304, 332-389) - target list filter parsing/building on the server; contains the current `!field_filterType` regex parser and powers list page queries.
2. `src/components/dashboard/filter-bar.tsx` (lines 340-399) - target client-side filter pill parsing/labeling; already uses a safer suffix-based parser for known filter types.
3. `../next-keystone-starter/features/dashboard/lib/buildWhereClause.ts` (lines 332-399) - reference app server-side filter parsing; builds an exact `possibleFilters` key map and looks up URL params directly instead of regex-splitting them.
4. `../next-keystone-starter/features/dashboard/components/FilterList.tsx` (lines 49-118) - reference UI filter parsing; same exact-key `possibleFilters` approach used client-side.
5. `src/routes/dashboard/$listKey.tsx` (lines 1-68) - target list loader passes raw search params into `fetchDashboardListPage(... filters: deps)` so any server parsing bug here affects all list results.

## Key Code

### Target: fragile server filter parsing
`src/features/cms/graphql-client.ts:286-297`
```ts
  for (const [key, rawValue] of Object.entries(filters)) {
    if (!key.startsWith('!')) continue
    const match = /^!([^_]+)_(.+)$/.exec(key)
    if (!match) continue
    const [, fieldPath, type] = match
    const field = list.fields.find((candidate) => candidate.path === fieldPath)
    if (!field || !field.isFilterable) continue
```

This assumes the field path contains no underscores. For keys like `!created_at_equals`, it parses:
- `fieldPath = "created"`
- `type = "at_equals"`

That silently drops the filter because no field named `created` exists.

### Reference: exact filter-key lookup
`../next-keystone-starter/features/dashboard/lib/buildWhereClause.ts:332-369`
```ts
  const possibleFilters: Record<string, { type: string; field: string; fieldPath: string; fieldMeta: any }> = {}

  for (const [fieldPath, field] of Object.entries(list.fields)) {
    ...
    for (const filterType in filterMapping.types) {
      possibleFilters[`!${fieldPath}_${filterType}`] = {
        type: filterType,
        field: fieldType,
        fieldPath,
        fieldMeta: typedField.fieldMeta,
      }
    }
  }

  for (const key in searchParams) {
    if (key === 'search') continue
    const filter = possibleFilters[key]
    if (!filter) continue
```

The reference does not regex-split filter keys at all. It derives the valid key space from field metadata, so underscores in either field paths or filter types remain safe.

### Target UI already hints at the right parsing shape
`src/components/dashboard/filter-bar.tsx:366-371`
```ts
function parseFilterKey(key: string) {
  const raw = key.slice(1)
  const knownTypes: FilterType[] = ['contains', 'equals', 'not', 'lt', 'lte', 'gt', 'gte', 'is_empty', 'not_empty']
  const type = knownTypes.find((candidate) => raw.endsWith(`_${candidate}`))
  if (!type) return { fieldPath: raw, filterType: '' as FilterType | '' }
  return { fieldPath: raw.slice(0, -type.length - 1), filterType: type }
}
```

The client pill parser already avoids the `[^_]+` bug by matching suffixes. The server path is the remaining parity hole.

## Architecture
- `src/routes/dashboard/$listKey.tsx` validates URL search params and passes the whole search object to `fetchDashboardListPage(... filters: deps)`.
- `src/features/cms/graphql-client.ts#buildWhere(...)` is the central server-side translator from `!field_filterType=<json>` URL params into GraphQL `where` clauses.
- `fetchDashboardListPage(...)` uses that `where` clause for both the list query and count query.
- Therefore, if `buildWhere(...)` misparses a filter key, the list page shows incorrect rows/counts even though the filter chips still render in the UI.
- The reference app avoids this class of bug by building a canonical map of valid filter keys and looking up the raw query key directly.

## Start Here
Open `src/features/cms/graphql-client.ts` first. The next fixable parity gap is localized to `buildWhere(...)`, and fixing it there corrects all server-side list filtering behavior.

## Findings
**Next single concrete parity gap:** server-side list filter parsing is still not parity-safe for field paths containing underscores.

### Why this is the next gap
The recently fixed items cover delete redirects, kind-aware cells, layout split, runtime required metadata, Copy ID feedback, hidden sidebar lists, kind-aware `supportsLinkTo`, list cache filters, and broader sort/auth/sidebar/filter parity. The next remaining concrete gap I found is narrower but real: target list filtering still relies on a regex parser that breaks on underscored field paths, while the reference resolves filters by exact generated keys.

### User-visible impact
Any filter applied to a list field whose `path` contains `_` can appear active in the UI but have no effect on returned rows/counts. This is a parity failure because the reference app will honor those filters.

## Minimal Implementation
Change only `src/features/cms/graphql-client.ts`.

### Preferred minimal fix
In `buildWhere(list, search, filters)`, replace the regex-based key split:
```ts
const match = /^!([^_]+)_(.+)$/.exec(key)
```
with a generated exact-key lookup, mirroring the reference approach.

### Minimal shape
1. Build a local `possibleFilters` map before iterating URL params:
   - For each `list.fields` entry where `field.isFilterable` is true,
   - derive allowed filter type keys from existing target logic:
     - `Object.keys(filterTypesForField(field.kind) ?? {})`
   - store entries like:
```ts
possibleFilters[`!${field.path}_${type}`] = { field, type }
```
2. Iterate raw `filters` entries and do:
```ts
const match = possibleFilters[key]
if (!match) continue
```
3. Use `match.field` and `match.type` when calling `filterWhereForField(...)`.

This keeps all current target filter semantics intact and only fixes key parsing.

### Why this is minimal
- One file.
- No route changes.
- No GraphQL changes.
- No client UI changes.
- No cache-key changes.
- Aligns directly with the reference app’s strategy.

## Risks / Constraints
- Keep using the target app’s current filter type vocabulary (`contains`, `equals`, `not`, etc.); do not mix in the reference app’s broader Keystone filter naming unless intentionally expanding scope.
- If there are non-filterable fields with UI-generated `!` params, the exact-key map should continue ignoring them gracefully.
- After the fix, underscored field paths should work consistently for both list results and count totals because both share the same `where`.
