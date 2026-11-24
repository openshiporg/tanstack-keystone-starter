# Code Context

## Files Retrieved
1. `../next-keystone-starter/features/dashboard/components/FilterBar.tsx` (lines 1-260) - Next reference list controls entry point; owns search, sort, field selection, filter pills, and create CTA.
2. `../next-keystone-starter/features/dashboard/components/FilterList.tsx` (lines 1-180) - Next reference active filter pill implementation.
3. `../next-keystone-starter/features/dashboard/components/FieldSelection.tsx` (lines 1-180) - Next reference column selection behavior.
4. `../next-keystone-starter/features/dashboard/components/SortSelection.tsx` (lines 1-180) - Next reference sort token behavior.
5. `../next-keystone-starter/features/dashboard/lib/queryKeys.ts` (lines 1-120) - Next reference query-key shape for list item caching.
6. `../next-keystone-starter/features/dashboard/hooks/useListItems.query.ts` (lines 1-140) - Next reference caches list items by full variables payload.
7. `src/routes/dashboard/$listKey.tsx` (lines 1-114) - Target list route; validates search state, loads list page data, and renders filter UI/table.
8. `src/components/dashboard/filter-bar.tsx` (lines 1-220, 260-479) - Target list controls entry point; owns search, sort, columns, and active filter pills.
9. `src/features/cms/graphql-client.ts` (lines 1-260, 360-439) - Target query keys and list-page fetcher; current cache key only reflects URL search state.
10. `src/components/dashboard/dashboard-shell.tsx` (lines 1-120) - Target sidebar shell; confirms hidden-nav filtering is already wired.
11. `src/routes/dashboard/index.tsx` (lines 1-120) - Target dashboard home; confirms hidden-nav filtering is already wired on overview cards.
12. `src/components/dashboard/dashboard-sidebar.tsx` (lines 1-131) - Target sidebar renderer; consumes pre-filtered lists.
13. `src/features/cms/config.ts` (lines 180-259) - Target config normalization; confirms `hideNavigation` / `isHidden` parity data exists.
14. `../next-keystone-starter/.keystone/admin/.next/static/chunks/54-6d620e2098a38bd5.js` (grep hit around line 20) - Compiled Keystone admin bundle shows persisted list-page state via `localStorage` key `keystone.list.${listKey}.list.page.info` and restore/reset behavior.

## Key Code

### Remaining parity gap: list-page preference persistence is still missing in target

The Next reference persists list-page UI state (filters/sort/fields) in local storage and restores it when reopening a list. Evidence is visible in the compiled admin bundle grep hit:

- `../next-keystone-starter/.keystone/admin/.next/static/chunks/54-6d620e2098a38bd5.js` - contains `es=["sortBy","fields"]`, `resetToDefaults`, and localStorage key `keystone.list.${e}.list.page.info`, showing restore/save logic for list-page state.

The target has no equivalent persistence code:

- `src/components/dashboard/filter-bar.tsx` updates URL state only via `navigate({ search: ... })` for search, sort, fields, and filters.
- `src/routes/dashboard/$listKey.tsx` reads validated search state and fetches data, but never hydrates from saved list prefs.
- `src/features/cms/graphql-client.ts` caches by current URL search only (`dashboardQueryKeys.listPage(...)`), not by any persisted default state.
- Repo-wide grep in `src/**` found no dashboard `localStorage` usage for list page preferences.

### Why this is still a real parity hole

Without persistence:
- reopening a list always drops prior sort/column/filter choices;
- returning from item/create pages loses the last list view configuration unless it remains in the URL;
- target misses Keystone admin’s “sticky list view preferences” behavior.

This is distinct from the already-fixed filter-pill parsing and hidden-sidebar work: the filter UI now interprets filters correctly, but it still does not remember them across visits.

## Architecture

Current target flow:

1. `src/routes/dashboard/$listKey.tsx`
   - validates URL search (`page`, `pageSize`, `search`, `sortBy`, `fields`);
   - passes the whole search object as `filters` into `fetchDashboardListPage(...)`.

2. `src/components/dashboard/filter-bar.tsx`
   - mutates search state for:
     - `search`
     - `sortBy`
     - `fields`
     - `!field_filterType` filter params
   - renders active filter pills from current URL only.

3. `src/features/cms/graphql-client.ts`
   - list-page cache key is `dashboardQueryKeys.listPage(listPath, searchState)`;
   - fetcher builds `where` and `orderBy` from current URL state.

Reference behavior adds one more layer around this:
- save list UI state (at least `!` filters, `sortBy`, `fields`) under a per-list localStorage key;
- on initial list load, if URL has no explicit list-state params, restore saved state into the URL;
- when user clears back to defaults, remove or reset the stored value.

## Start Here

Open `src/routes/dashboard/$listKey.tsx` first.

That route is the cleanest place to add parity with minimal surface area because it already owns canonical validated search state and is the first point where a restore-to-URL decision can happen before/while rendering the list UI.

## Recommended single concrete fix

Implement per-list list-page preference persistence/restoration.

### Minimal implementation

#### 1) Restore saved list-page state on first list render when URL has no explicit list-state params

Update `src/routes/dashboard/$listKey.tsx`:
- add a small client-side effect in `ListRoute()` that:
  - builds storage key: ``keystone.list.${list.key}.list.page.info``;
  - checks whether current search has any explicit list-state params:
    - any key starting with `!`
    - `sortBy`
    - `fields`
  - if none are present, reads localStorage JSON and navigates to merge it into `search`.

This mirrors the Keystone admin behavior visible in the compiled bundle.

#### 2) Save list-state params whenever they change

Also in `src/routes/dashboard/$listKey.tsx` or a tiny helper hook colocated beside it:
- watch `search` and persist only the sticky list-view subset:
  - `sortBy`
  - `fields`
  - any `!...` filter entries
- optionally remove storage entry when that subset becomes empty.

### Exact target files to change

1. `src/routes/dashboard/$listKey.tsx`
   - add the restore/save effect(s) in `ListRoute()`.
   - This is sufficient for a minimal parity patch; no server changes required.

### Optional extraction if you want cleaner code

2. `src/components/dashboard/filter-bar.tsx`
   - no behavioral changes required, but you could extract the persistence logic into a reusable hook imported here or by the route.

## Suggested implementation shape

Pseudo-shape only (do not copy verbatim):

- helpers:
  - `const LIST_STATE_KEYS = ['sortBy', 'fields']`
  - `function getPersistedListState(search) { ...pick !* + sortBy + fields... }`
  - `function hasExplicitListState(search) { ... }`

- in `ListRoute()`:
  - `useEffect(() => { restore if !hasExplicitListState(search) })`
  - `useEffect(() => { save current persisted subset })`

Use `void navigate({ search: previous => ({ ...restored, ...previous }) , replace: true })` or equivalent so restoration does not pollute browser history.

## Risks / constraints

- Restore must not override explicit URL params.
- Use `replace: true` for hydration-style navigation to avoid an extra back-button step.
- Persist only sticky list-state params, not `page` / `pageSize`; Keystone’s compiled code evidence points to filters/sort/fields rather than pagination.
- Because the route already validates `sortBy`/`fields` and passes through `!` filters, this can stay entirely client-side.

## Bottom line

**Next fixable parity gap:** target dashboard list pages still lack Keystone-style persisted list preferences (restore/save for `sortBy`, `fields`, and `!` filters via `localStorage`).

**Minimal patch:** add restore/save effects in `src/routes/dashboard/$listKey.tsx` using storage key `keystone.list.${list.key}.list.page.info`. No server or schema changes needed.
