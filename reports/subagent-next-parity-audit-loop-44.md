# Code Context

## Files Retrieved
1. `src/routes/dashboard/$listKey.tsx` (lines 1-104) - target list route passes `effectiveSortBy={data.sortBy}` into the filter bar and owns list-page search params.
2. `src/components/dashboard/filter-bar.tsx` (lines 1-220, 221-442) - target list controls implementation; contains search, filter, sort, and column UI, but no persisted list defaults/reset behavior.
3. `src/components/dashboard/keystone-list-table.tsx` (lines 275-307) - confirms relationship-cell/no-row-link parity is already implemented in target.
4. `../next-keystone-starter/features/dashboard/components/FilterBar.tsx` (lines 1-140) - source app’s non-Keystone custom filter bar lacks the parity behavior, so it is not the right reference for this audit item.
5. `../next-keystone-starter/features/dashboard/components/ListTable.tsx` (lines 150-180) - source app list table link behavior; used to rule out already-fixed table-cell parity gaps.
6. `../next-keystone-starter/.keystone/admin/.next/static/chunks/54-6d620e2098a38bd5.js` (excerpt containing minified `ed({listKey})`) - compiled Keystone admin reference showing persisted list-page defaults and “Reset to defaults” control.

## Key Code

### Target already passes effective sort into the filter bar
From `src/routes/dashboard/$listKey.tsx`:

```tsx
<FilterBar list={list} selectedFields={selectedFields} effectiveSortBy={data.sortBy} />
```

This means the earlier `effectiveSortBy` parity fix is already present.

### Target filter bar has no persisted defaults / reset control
From `src/components/dashboard/filter-bar.tsx`:

- search state sync and URL writes exist
- filter pills exist
- sort dropdown exists
- field selection exists
- **missing**: localStorage-backed restoration of `sortBy` / `fields` / `!filters`
- **missing**: “Reset to defaults” action that clears stored list preferences and current list modifiers

Relevant current update points:

```tsx
function updateSort(sortBy: string) {
  void navigate({ search: (previous) => ({ ...previous, sortBy: sortBy || undefined, page: 1 }) })
}

function updateFields(next: Set<string>) {
  const normalized = Array.from(next)
  void navigate({ search: (previous) => ({ ...previous, fields: normalized.length ? normalized.join(',') : undefined, page: 1 }) })
}
```

There is no persistence effect or reset button anywhere in the file.

### Keystone reference behavior
From `../next-keystone-starter/.keystone/admin/.next/static/chunks/54-6d620e2098a38bd5.js` inside minified `ed({listKey})`:

- local storage key:

```js
let l=`keystone.list.${e}.list.page.info`
```

- on mount, if current query has no `!filters`, `sortBy`, or `fields`, restore saved values from localStorage:

```js
if(!Object.keys(t.query).some(e=>e.startsWith("!")||es.includes(e))&&t.isReady){
  let e;
  let r=localStorage.getItem(l);
  try{e=JSON.parse(r)}catch(e){}
  e&&t.replace({query:{...t.query,...e}})
}
```

- persist only filter/sort/field state:

```js
let e={};
Object.keys(t.query).forEach(l=>{
  (l.startsWith("!")||es.includes(l))&&(e[l]=t.query[l])
}),
Object.keys(e).length?localStorage.setItem(l,JSON.stringify(e)):localStorage.removeItem(l)
```

- reset action:

```js
{resetToDefaults:()=>{localStorage.removeItem(l),t.replace({pathname:t.pathname})}}
```

- button shown when any of filters/sort/fields/search is active:

```js
!!(M.filters.length||void 0!==c.sortBy||c.fields||c.search) && <button onClick={b}>Reset to defaults</button>
```

## Architecture

- `src/routes/dashboard/$listKey.tsx` validates and owns list-page search params, then fetches list data using the full search object.
- `src/components/dashboard/filter-bar.tsx` is the sole UI layer mutating list-page query state (`search`, `sortBy`, `fields`, `!foo_bar` filters).
- Because all list-state modifiers already flow through `FilterBar`, parity for Keystone’s list-page preference persistence/reset should be implemented there, with no GraphQL or backend changes.
- The route already re-runs correctly when search params change, so this is a front-end state/persistence gap only.

## Start Here
Open `src/components/dashboard/filter-bar.tsx` first. It already owns every relevant list-page modifier, and the missing Keystone parity behavior can be added there with a small, self-contained change.

## Next single concrete fixable parity gap
**Gap:** list-page persisted defaults and **“Reset to defaults”** behavior are still missing.

This is the next concrete parity gap because the audit items named in the prompt are already present in target, while Keystone admin still has one visible list-UX behavior missing: restoring saved `sortBy` / `fields` / `!filters` for each list and letting the user reset them.

## Minimal implementation

### File to change
- `src/components/dashboard/filter-bar.tsx`

### Suggested minimal changes
1. Add a localStorage key per list path, matching Keystone semantics closely, e.g.:
   - `keystone.list.${list.path}.list.page.info`
2. Add a `useEffect` that, on first render for a list, restores saved `sortBy`, `fields`, and `!filter` params **only when the current URL does not already specify any of those keys**.
3. Add a second `useEffect` that persists only `sortBy`, `fields`, and `!filter` keys from current search params.
4. Add a `resetToDefaults()` handler that:
   - removes the localStorage key
   - navigates to the same list route with list modifiers cleared
   - ideally clears `search` too, matching Keystone’s visible reset behavior
5. Render a small secondary button, e.g. near active filters / controls, labeled `Reset to defaults` when any of `search`, `sortBy`, `fields`, or `!filter` params are active.

### Why this is minimal
- No schema, query, or route contract changes.
- No backend changes.
- Existing `navigate({ search })` patterns already support the needed behavior.
- Behavior is isolated to one component.

## Risks / constraints
- Avoid restoring defaults repeatedly after the user intentionally changes URL params; restoration should run only when no list modifiers are present.
- TanStack Router search objects may include non-string values; persistence should store only `sortBy`, `fields`, and `!` keys as serializable values.
- Keep the current `effectiveSortBy` behavior intact; persisted URL `sortBy` should still win over server fallback.
