# Forty-ninth Loop Parity Audit: next-keystone-starter vs target

## Checked areas already aligned
The items called out in the task appear fixed/aligned in the target implementation:

- list rows are no longer globally clickable / pointer-cursor rows
- first visible list column link behavior is constrained instead of whole-row linking
- client/server filter mapping is now consistent
- item-page cache invalidation exists
- `initialFilter` is applied server-side in list queries
- `hideNavigation` is carried through config/admin meta and used on dashboard index
- Copy ID exists on item page
- item query uses `itemView(id)`
- sort UI exists and respects effective sort
- relationship/list cell rendering is link-aware and avoids row-link leakage

## Next concrete parity gap
### Gap
**Target persists list-page UI state (`sortBy`, `fields`, and `!filter` params) in `localStorage`, but next-keystone-starter does not.**

This is a behavior difference visible to users:
- in target, leaving a list page and returning restores column selection / sort / filters
- in next, those choices are lost unless they stay in the URL

### Why this is the next fixable gap
This is:
- concrete
- isolated to list-page client state
- small to implement
- directly comparable against next-keystone-starter behavior
- not already covered by the just-fixed areas

## Evidence

### Target implementation
#### `src/routes/dashboard/$listKey.tsx:75-86`
Restores persisted list state on mount and writes it back when search changes.

```ts
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (hasExplicitListState(search)) return
    const restored = readPersistedListState(list.key)
    if (!restored || !Object.keys(restored).length) return
    void navigate({ search: (previous) => ({ ...previous, ...restored }), replace: true })
  }, [list.key, navigate, search])

  useEffect(() => {
    if (typeof window === 'undefined') return
    writePersistedListState(list.key, pickPersistedListState(search))
  }, [list.key, search])
```

#### `src/routes/dashboard/$listKey.tsx:126-150`
Defines the persistence helpers and intentionally persists only list-state keys.

```ts
function storageKeyForList(listKey: string) {
  return `keystone.list.${listKey}.list.page.info`
}

function pickPersistedListState(search: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(search).filter(([key, value]) => (key === 'sortBy' || key === 'fields' || key.startsWith('!')) && typeof value === 'string' && value.length > 0),
  ) as Record<string, string>
}

function hasExplicitListState(search: Record<string, unknown>) {
  return Object.keys(pickPersistedListState(search)).length > 0
}
```

### next-keystone-starter comparison
#### `../next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx:62-172`
The next app reads URL params reactively and renders list state from them, but has **no corresponding localStorage restore/write layer**.

Relevant behavior:
- derives `currentSearchParams` from URL only
- renders `FilterBar` and table from current URL state
- reset just navigates back to pathname
- no persistence helpers

#### `../next-keystone-starter/features/dashboard/hooks/useSelectedFields.ts:5-28`
Columns come only from URL or `initialColumns`:

```ts
const fieldsFromUrl = searchParams?.get('fields')
...
if (fieldsFromUrl) {
  selectedFieldsArray = fieldsFromUrl.split(',')...
} else {
  selectedFieldsArray = list.initialColumns || []
}
```

#### `../next-keystone-starter/features/dashboard/hooks/useSort.ts:4-20`
Sort comes only from URL:

```ts
const sortByFromUrl = searchParams?.get('sortBy')
if (!sortByFromUrl) return null
```

## Minimal implementation
### Files to change in next-keystone-starter
1. `../next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx`
2. Optionally a tiny helper file if desired, but **not required**; this can stay in the page client for parity with target’s lightweight approach.

### Exact change
Add the same persistence behavior used by target:

1. **On mount / when list changes**
   - if URL already contains any explicit list-state keys (`sortBy`, `fields`, keys starting with `!`), do nothing
   - otherwise read `localStorage['keystone.list.${list.key}.list.page.info']`
   - if present, merge restored values into current URL via router navigation/replace

2. **Whenever URL search params change**
   - persist only:
     - `sortBy`
     - `fields`
     - any `!field_filterType` entries
   - remove the storage key if none exist

3. **Do not persist**
   - `page`
   - `pageSize`
   - free-text `search`

That matches the target exactly and avoids restoring pagination/search unexpectedly.

## Suggested implementation shape
Inside `ListPageClient.tsx`:

- import `useEffect`
- add helpers equivalent to target:
  - `storageKeyForList(listKey: string)`
  - `pickPersistedListState(search: Record<string, string>)`
  - `hasExplicitListState(search: Record<string, string>)`
  - `readPersistedListState(listKey: string)`
  - `writePersistedListState(listKey: string, state: Record<string, string>)`
- after `currentSearchParams` is computed:
  - restore effect
  - write effect

Because this page already computes a normalized `currentSearchParams` object and already uses `router.push`, the change stays localized.

## Risk / constraint notes
- In next app, use `router.replace(...)` for restore so back-stack is not polluted.
- Preserve current pathname and merge restored keys into current query string.
- Guard `window`/`localStorage` access for client safety.
- Avoid infinite loops by skipping restore when URL already has explicit state keys.

## Recommendation
**Next single fix:** port list-state persistence from target into `../next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx`.

This is the clearest remaining parity gap after the recently fixed list/table/filter/item-page issues.