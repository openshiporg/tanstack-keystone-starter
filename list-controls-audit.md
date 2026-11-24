# Code Context

## Files Retrieved
1. `src/routes/dashboard/$listKey.tsx` (lines 11-55, 58-115) - local list-route entrypoint; validates URL state and drives list-page data fetch.
2. `src/components/dashboard/filter-bar.tsx` (lines 37-159, 169-234, 236-328, 347-465, 480-520) - local toolbar/search/filter/sort/columns/reset logic and URL-state persistence.
3. `src/components/dashboard/keystone-list-table.tsx` (lines 48-147, 149-259, 264-420) - local table rendering, empty states, sorting headers, cells, bulk actions, and pagination wiring.
4. `src/components/dashboard/pagination.tsx` (lines 28-66, 68-126, 128-204) - local pagination and selection-mode footer.
5. `src/components/dashboard/list-search-url.ts` (lines 1-16) - local URL normalization rules.
6. `src/components/dashboard/list-state-defaults.ts` (lines 5-23) - local definition of “default” list state for reset/persistence behavior.
7. `src/features/cms/models/User.ts` (lines 7-15, 34-39, 60-68, 95-120) - local Users list defaults and constraints that shape the users list page.
8. `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx` (lines 68-119, 121-179, 210-247) - upstream list-page client orchestration.
9. `/Users/junaid/code/next-keystone-starter/features/dashboard/components/FilterBar.tsx` (lines 29-80, 82-161) - upstream toolbar/search/filter/sort/columns/create controls.
10. `/Users/junaid/code/next-keystone-starter/features/dashboard/components/ListTable.tsx` (lines 27-113, 123-203, 214-357) - upstream table rendering, selection, sort headers, basic cell handling.
11. `/Users/junaid/code/next-keystone-starter/features/dashboard/components/Pagination.tsx` (lines 56-130, 132-187, 189-379) - upstream pagination and selection footer.
12. `/Users/junaid/code/next-keystone-starter/features/dashboard/components/FieldSelection.tsx` (lines 28-89) - upstream column selection URL behavior.
13. `/Users/junaid/code/next-keystone-starter/features/dashboard/components/SortSelection.tsx` (lines 21-56, 67-155) - upstream sort control URL behavior.
14. `/Users/junaid/code/next-keystone-starter/features/dashboard/components/FilterList.tsx` (lines 34-101, 127-247) - upstream active-filter parsing/editing/removal behavior.
15. `/Users/junaid/code/next-keystone-starter/features/dashboard/hooks/useSelectedFields.ts` (lines 4-32) - upstream selected-column defaulting.
16. `/Users/junaid/code/next-keystone-starter/features/dashboard/hooks/useSort.ts` (lines 4-18) - upstream sort parsing from URL.

## Key Code
### Users list defaults
- Local Users list is explicitly path-backed as `/dashboard/users`, searchable by `name,email`, default page size 50, and starts with `name,email,role,tasks`: `src/features/cms/models/User.ts:7-15`, `src/features/cms/models/User.ts:34-39`.
- Local also marks `email` non-filterable and non-orderable, so any UI offering those capabilities there would be wrong: `src/features/cms/models/User.ts:60-68`.

### Local route/state pipeline
- Local route normalizes `page`, `pageSize`, `search`, `sortBy`, and `fields`, including compatibility with repeated `column` params: `src/routes/dashboard/$listKey.tsx:11-25`.
- The same normalized search object is used as loader deps and query key, so URL state is the source of truth for fetches: `src/routes/dashboard/$listKey.tsx:26-49`, `src/routes/dashboard/$listKey.tsx:64-76`.
- Filtered-empty-state detection is not just search-based; it also checks structured filters: `src/routes/dashboard/$listKey.tsx:83-85`.

### Local toolbar/state behavior
- Local toolbar persists list state in `localStorage` unless URL explicitly overrides it, then writes it back on changes: `src/components/dashboard/filter-bar.tsx:111-135`.
- Local search/sort/columns all pass through URL normalization, which strips defaults from the URL: `src/components/dashboard/filter-bar.tsx:137-158`, `src/components/dashboard/list-search-url.ts:3-16`.
- Local filters are dual-written: legacy internal `!field_type` params plus official `filter` params, and active filters are read from both with dedupe logic: `src/components/dashboard/filter-bar.tsx:61-107`, `src/components/dashboard/filter-bar.tsx:169-229`.
- Local reset is an explicit first-class control that clears persisted state too: `src/components/dashboard/filter-bar.tsx:231-299`.
- Local sort menu excludes hidden fields and has clear-state support: `src/components/dashboard/filter-bar.tsx:347-417`.
- Local column picker excludes hidden fields, preserves order, and removes URL params when selection matches defaults: `src/components/dashboard/filter-bar.tsx:419-465`.

### Local table/cell behavior
- Local table gets `data.selectedFields` from the server payload, not from ad hoc client derivation: `src/components/dashboard/keystone-list-table.tsx:173-175`, `src/routes/dashboard/$listKey.tsx:83`.
- Local supports bulk selection plus extra selection actions beyond delete: `src/components/dashboard/keystone-list-table.tsx:227-258`, `src/components/dashboard/pagination.tsx:33-45`, `src/components/dashboard/pagination.tsx:92-123`.
- Local table cells have specialized rendering for checkbox/select/multiselect/relationship/password, plus field-view cell rendering with row-link support: `src/components/dashboard/keystone-list-table.tsx:306-357`, `src/components/dashboard/keystone-list-table.tsx:360-420`.

### Upstream baseline behavior
- Upstream list page only treats raw `search` as “filtered”; actual structured filters are ignored in filtered-empty-state logic: `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx:210-237`.
- Upstream selected columns are derived client-side from `fields` or `initialColumns`, with fallback heuristics for `name/title/label/createdAt/updatedAt`: `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx:121-143`, `/Users/junaid/code/next-keystone-starter/features/dashboard/hooks/useSelectedFields.ts:6-32`.
- Upstream filter system only understands `!field_type` params in `FilterList`: `/Users/junaid/code/next-keystone-starter/features/dashboard/components/FilterList.tsx:45-101`.
- Upstream pagination writes raw query params and permits arbitrary positive page sizes: `/Users/junaid/code/next-keystone-starter/features/dashboard/components/Pagination.tsx:115-130`, `/Users/junaid/code/next-keystone-starter/features/dashboard/components/Pagination.tsx:305-361`.
- Upstream table cell rendering is primitive compared with local: mostly link-first-field, raw primitive print, else “Complex data”: `/Users/junaid/code/next-keystone-starter/features/dashboard/components/ListTable.tsx:123-188`.

## Architecture
- Local dashboard list pages are route-driven through TanStack Router. URL search is validated at the route boundary, passed unchanged into the loader/query layer, then reused by toolbar and pagination via `useSearch`/`navigate`: `src/routes/dashboard/$listKey.tsx:11-49`, `src/routes/dashboard/$listKey.tsx:64-115`, `src/components/dashboard/pagination.tsx:50-66`.
- Upstream dashboard is a Next.js client-page pattern. Each control reads/writes `useSearchParams()` independently, assembling query strings locally. There is no route-level search schema or central normalizer: `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx:82-119`, `/Users/junaid/code/next-keystone-starter/features/dashboard/components/FilterBar.tsx:44-69`, `/Users/junaid/code/next-keystone-starter/features/dashboard/components/Pagination.tsx:70-130`.
- Local has moved more list semantics server-side or meta-driven: server returns `selectedFieldPaths`/`selectedFields`, local route detects filter state centrally, and cell rendering uses field views plus richer fallback renderers: `src/routes/dashboard/$listKey.tsx:83-85`, `src/components/dashboard/keystone-list-table.tsx:173-175`, `src/components/dashboard/keystone-list-table.tsx:360-420`.
- Upstream remains more component-local and stringly typed: selected fields, active filters, sort labels, and pagination URL semantics are rebuilt in each component: `/Users/junaid/code/next-keystone-starter/features/dashboard/hooks/useSelectedFields.ts:6-32`, `/Users/junaid/code/next-keystone-starter/features/dashboard/components/SortSelection.tsx:21-56`, `/Users/junaid/code/next-keystone-starter/features/dashboard/components/FilterList.tsx:63-101`.

## Start Here
Open `src/components/dashboard/filter-bar.tsx` first. It contains the biggest delta surface versus upstream: search, filters, sort, columns, reset behavior, URL compatibility, and persisted state all live there.

## Supervisor coordination
No supervisor coordination needed.

# Dashboard List Controls Audit

## Verdict
Hostile read: local is **not** a faithful copy of upstream dashboard list controls. It is mostly **more capable and more coherent**, but it diverges hard in URL semantics, persistence, filter parsing, column behavior, and cell rendering. Anyone expecting strict parity with `/features/dashboard` will get surprised.

## Concrete differences

### 1) Local has route-level URL-state normalization; upstream has none
- Local validates and normalizes `page`, `pageSize`, `search`, `sortBy`, and `fields` before anything else, including compatibility for `column` array/string input: `src/routes/dashboard/$listKey.tsx:11-25`.
- Upstream list page just reads raw `useSearchParams()` and parses strings ad hoc inside the client component: `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx:82-119`.

Why this matters: local has a stable search contract; upstream is a bag of query strings.

### 2) Local strips default values from the URL; upstream leaves them in
- Local normalizer deletes `page` when `<=1`, deletes default `pageSize`, and removes empty `search`, `sortBy`, `fields`, `column`, and `filter`: `src/components/dashboard/list-search-url.ts:3-16`.
- Upstream search/pagination helpers simply set params and push them, with no cleanup pass: `/Users/junaid/code/next-keystone-starter/features/dashboard/components/FilterBar.tsx:44-69`, `/Users/junaid/code/next-keystone-starter/features/dashboard/components/Pagination.tsx:123-130`.

This is an intentional divergence in URL-state behavior.

### 3) Local persists list state in localStorage; upstream forgets everything unless it’s in the URL
- Local restores persisted state when the URL lacks explicit list-state params, then rewrites storage on every search-state change: `src/components/dashboard/filter-bar.tsx:111-135`.
- Upstream has no comparable persistence layer in list controls; everything is request-local to the current URL: `/Users/junaid/code/next-keystone-starter/features/dashboard/components/FilterBar.tsx:29-80`.

If parity was the goal, this is a major product behavior fork.

### 4) Local supports two filter URL formats at once; upstream only supports `!field_type`
- Local reads active filters from raw `!field_type` keys and official `filter` params, deduping by `field:type`: `src/components/dashboard/filter-bar.tsx:61-107`.
- Local writes both formats when adding/updating filters: `src/components/dashboard/filter-bar.tsx:169-229`.
- Upstream `FilterList` only computes possible filters keyed as `!${fieldPath}_${filterType}` and only scans search params for those exact keys: `/Users/junaid/code/next-keystone-starter/features/dashboard/components/FilterList.tsx:45-101`.

So local is compatibility-heavy; upstream is simpler and narrower.

### 5) Local filtered-empty-state detection is correct; upstream’s is half-broken
- Local considers a page filtered when search text exists **or** any dashboard filters are present: `src/routes/dashboard/$listKey.tsx:83-85`.
- Upstream only checks `!!searchString`, then shows default empty state vs search empty state off that single flag: `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx:210-237`.

Upstream will misclassify filtered empty results when only structured filters are active. Local fixed that.

### 6) Local has an explicit Reset control for list state; upstream does not
- Local toolbar shows a Reset button whenever the page is not at default state and resets URL + local storage: `src/components/dashboard/filter-bar.tsx:108-109`, `src/components/dashboard/filter-bar.tsx:231-299`.
- Upstream toolbar has no reset button at all: `/Users/junaid/code/next-keystone-starter/features/dashboard/components/FilterBar.tsx:109-160`.
- Upstream only offers reset indirectly inside the “No Results Found” empty state: `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx:53-64`, `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx:235-237`.

### 7) Local search placeholder logic is broader than upstream’s
- Local placeholder uses `list.fields.filter((field) => field.isFilterable)`: `src/components/dashboard/filter-bar.tsx:50-51`.
- Upstream derives searchable labels from enhanced fields with actual filter controllers present: `/Users/junaid/code/next-keystone-starter/features/dashboard/components/FilterBar.tsx:76-80`.

That means local may advertise fields in the search placeholder that are filterable but not necessarily meaningful text-search targets. On Users, local model says `email` is not filterable: `src/features/cms/models/User.ts:60-68`, so the placeholder can already diverge from expectations depending on server meta.

### 8) Local column selection understands hidden fields; upstream does not visibly enforce that here
- Local column UI filters out `id` and any `listView.fieldMode === 'hidden'`, and its default-column baseline is derived from visible fields if `initialColumns` is absent: `src/components/dashboard/filter-bar.tsx:419-465`.
- Upstream `FieldSelection` filters out only `id`; hidden-field exclusion is absent in this component: `/Users/junaid/code/next-keystone-starter/features/dashboard/components/FieldSelection.tsx:59-84`.

If upstream meta includes hidden fields in `listMeta.fields`, upstream can expose illegal display choices that local suppresses.

### 9) Local column URL behavior preserves old `column` compatibility; upstream only speaks `fields`
- Local route accepts `fields` or `column`, mapping repeated/single `column` into a comma string: `src/routes/dashboard/$listKey.tsx:18-24`.
- Local field updates write both `fields` and `column`: `src/components/dashboard/filter-bar.tsx:149-158`.
- Upstream selected-fields logic and field selection only read/write `fields`: `/Users/junaid/code/next-keystone-starter/features/dashboard/hooks/useSelectedFields.ts:6-32`, `/Users/junaid/code/next-keystone-starter/features/dashboard/components/FieldSelection.tsx:44-55`.

This is another deliberate URL-compat break from upstream.

### 10) Local selected columns come from server result; upstream reconstructs them client-side
- Local route feeds `selectedFields = new Set(data.selectedFieldPaths)` from fetched data: `src/routes/dashboard/$listKey.tsx:83`, and table headers/cells use `data.selectedFields`: `src/components/dashboard/keystone-list-table.tsx:173-175`, `src/components/dashboard/keystone-list-table.tsx:202-209`.
- Upstream reconstructs selected fields from URL or `initialColumns`, then passes them into `ListTable`: `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx:121-143`, `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx:240-245`.
- Upstream fallback even guesses columns from names like `name/title/label/createdAt/updatedAt`: `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx:130-139`.

Local is stricter and more authoritative; upstream is heuristic.

### 11) Local sort menu filters out hidden fields; upstream just checks `isOrderable`
- Local `SortSelection` includes only fields that are orderable and not hidden in list view: `src/components/dashboard/filter-bar.tsx:347-350`.
- Upstream sort menu filters only by `field.isOrderable`: `/Users/junaid/code/next-keystone-starter/features/dashboard/components/SortSelection.tsx:79-87`, `/Users/junaid/code/next-keystone-starter/features/dashboard/components/SortSelection.tsx:123-137`.

Local closes a metadata leak upstream leaves open.

### 12) Local header sort clicks do not run through URL normalization; upstream also doesn’t normalize, but local is inconsistent with itself
- Local toolbar sort updates use `normalizeListSearchForUrl`: `src/components/dashboard/filter-bar.tsx:143-146`.
- But local table-header click handler writes `{ ...previous, sortBy: nextSort, page: 1 }` directly, skipping URL cleanup and compatibility shaping: `src/components/dashboard/keystone-list-table.tsx:264-276`.
- Upstream likewise writes raw query state for header sort: `/Users/junaid/code/next-keystone-starter/features/dashboard/components/ListTable.tsx:190-203`.

This is an internal local inconsistency, not just an upstream delta.

### 13) Local page-size behavior is constrained and snapped; upstream allows arbitrary positive sizes
- Local normalizes page sizes using `normalizeDashboardPageSize()` and incremental controls snap with `snapPageSizeToClosest()`: `src/components/dashboard/pagination.tsx:63-66`, `src/components/dashboard/pagination.tsx:166-189`.
- Local route validation also normalizes incoming `pageSize`: `src/routes/dashboard/$listKey.tsx:14-15`.
- Upstream page-size changes accept any positive integer with `Math.max(1, Number(newSize))`, and +/- changes are hardcoded by 5: `/Users/junaid/code/next-keystone-starter/features/dashboard/components/Pagination.tsx:115-121`, `/Users/junaid/code/next-keystone-starter/features/dashboard/components/Pagination.tsx:305-361`.

So local is not upstream-parity here; it is opinionated and stricter.

### 14) Local pagination selection footer supports extra bulk actions; upstream selection footer is delete-only
- Local pagination accepts `selectionActions` and renders them between Cancel and Delete: `src/components/dashboard/pagination.tsx:34-45`, `src/components/dashboard/pagination.tsx:92-123`.
- Local list table wires in `ListPageActions` for those extra actions: `src/components/dashboard/keystone-list-table.tsx:233-255`.
- Upstream selection footer only has cancel + delete, no extension slot: `/Users/junaid/code/next-keystone-starter/features/dashboard/components/Pagination.tsx:41-50`, `/Users/junaid/code/next-keystone-starter/features/dashboard/components/Pagination.tsx:189-242`.

### 15) Local respects hideDelete in the table UI; upstream doesn’t show evidence of that guard here
- Local gates selection column and bulk delete behavior behind `!data.list.hideDelete`: `src/components/dashboard/keystone-list-table.tsx:54`, `src/components/dashboard/keystone-list-table.tsx:161-172`, `src/components/dashboard/keystone-list-table.tsx:232-258`.
- Upstream `ListTable` always renders selection checkboxes and delete flow in the provided code path: `/Users/junaid/code/next-keystone-starter/features/dashboard/components/ListTable.tsx:214-236`, `/Users/junaid/code/next-keystone-starter/features/dashboard/components/ListTable.tsx:343-357`.

For lists where delete should be hidden, upstream behavior is riskier.

### 16) Local cell rendering is materially richer than upstream
- Local handles checkbox badges, select labels, multiselect label joins, relationship links, password-set status, and relationship-aware fallback labels: `src/components/dashboard/keystone-list-table.tsx:327-357`, `src/components/dashboard/keystone-list-table.tsx:377-420`.
- Upstream fallback rendering is crude: ID/first field links, primitive values, else “Complex data”: `/Users/junaid/code/next-keystone-starter/features/dashboard/components/ListTable.tsx:123-188`.

This is especially visible on the Users list because local has relationship fields `role` and `tasks`: `src/features/cms/models/User.ts:95-120`. Upstream will render these much more poorly if no custom field cell handles them.

### 17) Local row-linking is relationship-aware; upstream is simpler and more brittle
- Local `renderViewCell()` refuses automatic row-linking for relationship cells and explicitly constructs relationship links to target lists using `refListPath/ref`: `src/components/dashboard/keystone-list-table.tsx:360-389`.
- Upstream generic link behavior just checks `supportsLinkTo` or “first field” logic and otherwise falls back: `/Users/junaid/code/next-keystone-starter/features/dashboard/components/ListTable.tsx:141-159`.

Local prevents nonsense links and provides actual related-record navigation.

### 18) Local empty-state reset clears filters by routing to bare list route; upstream resets by pushing current pathname
- Local filtered empty state reset uses TanStack navigation to `/dashboard/$listKey` with params only: `src/components/dashboard/keystone-list-table.tsx:122-132`.
- Upstream reset callback just `router.push(window.location.pathname)`: `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx:177-180`.

Behavior is similar in effect, but local is route-aware and upstream is DOM-global imperative code.

### 19) Upstream computes and then ignores `useSort`; local doesn’t carry dead sort state like that
- Upstream calls `const sort = useSort(list)` and then never uses it: `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx:78-80`.
- Local route/table don’t have this dead path; they use `search.sortBy` directly and pass it through: `src/routes/dashboard/$listKey.tsx:67-74`, `src/components/dashboard/keystone-list-table.tsx:264-276`.

This is a small but obvious upstream smell.

### 20) Users-list semantics specifically diverge because local honors model-level constraints more tightly
- Local Users list model says `email` is not filterable and not orderable: `src/features/cms/models/User.ts:60-68`.
- Local sort UI only shows orderable, visible fields: `src/components/dashboard/filter-bar.tsx:347-350`; local header click handler also hard-disables non-orderable fields: `src/components/dashboard/keystone-list-table.tsx:273-292`.
- Upstream sort controls only trust `field.isOrderable` in list meta and don’t add visibility checks: `/Users/junaid/code/next-keystone-starter/features/dashboard/components/SortSelection.tsx:79-87`, `/Users/junaid/code/next-keystone-starter/features/dashboard/components/ListTable.tsx:190-203`.

If meta parity is imperfect, local will stay safer; upstream will surface more invalid controls.

## Bottom line
- If the bar is **feature parity with upstream dashboard controls**, local **fails parity** because it changed behavior substantially.
- If the bar is **better list UX and safer metadata handling**, local is generally **ahead**.
- The most important deltas to track are: route-level search normalization, localStorage persistence, dual filter URL formats, real filtered-state detection, hidden-field suppression, constrained page sizes, richer cells, and extensible bulk actions.
