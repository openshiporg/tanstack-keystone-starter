# Dashboard list/filter/sort/field-selection parity audit

## Inputs
- `progress.md` was present and reviewed.
- `plan.md` was requested but is currently missing at repo root (`/Users/junaid/code/tanstack-keystone-starter/plan.md`).

## Scope compared
- **TanStack app:** `src/routes/dashboard/$listKey.tsx`, `src/components/dashboard/filter-bar.tsx`, `src/components/dashboard/keystone-list-table.tsx`, `src/components/dashboard/views/registry.tsx`, `src/components/dashboard/views/relationship-filter-input.tsx`, `src/features/cms/graphql-client.ts`
- **Next baseline:** `features/dashboard/screens/ListPage/index.tsx`, `features/dashboard/screens/ListPage/ListPageClient.tsx`, `features/dashboard/components/{FilterBar,FilterAdd,FilterList,SortSelection,FieldSelection,ListTable}.tsx`, `features/dashboard/hooks/{useSelectedFields,useSort}.ts`, `features/dashboard/lib/{buildWhereClause,buildOrderByClause,sort}.ts`, selected field view controllers under `features/dashboard/views/**`

## Executive summary

TanStack is **not yet at parity** with the Next dashboard for list controls.

Broadly:
- **Correct / matched enough:** core URL shape (`page`, `pageSize`, `search`, `sortBy`, `fields`, `!field_operator`), create-button visibility, table pagination reset behavior on search/sort/filter changes, relationship filter key shape, and server-driven selected column fetching.
- **Major parity gaps:** exact operator exposure, checkbox URL/operator contract, integer/float empty operators, multiselect semantics, document filters, filter-pill edit semantics, sort/initialSort UI semantics, field-selection default URL semantics, hidden-field handling, and empty-state detection for non-search filters.
- **Important note:** Next itself contains a duplicated search/initialFilter composition bug. TanStack does **not** reproduce that bug. That is a parity difference, but not one I would recommend copying unless “bug-for-bug” parity is a hard requirement.

---

## Parity matrix

| Area | Next baseline | TanStack current | Parity |
|---|---|---|---|
| List route URL params | `page`, `pageSize`, `search`, `sortBy`, `fields`, `!field_operator` | same shape, with route-level validation | Partial |
| Path canonicalisation | no canonical redirect found in list route | redirects non-canonical key/path to `list.path` | Divergent |
| Search query behavior | case-insensitive contains; duplicated assembly in page layer | single-pass assembly; case-sensitive text search | Divergent |
| FilterAdd operator exposure | controller-driven, broader | controller-driven, narrower / different | Gap |
| FilterList pill edit semantics | saving a pill removes sibling filters on same field | saving only updates the current key | Gap |
| Sort selection | URL-driven only; implicit sort not surfaced in UI | effective sort surfaced even when URL omits `sortBy` | Divergent |
| Field selection URL semantics | default-column clearing is effectively broken because `id` is included in payload | clears `fields` when selection equals default columns | Divergent |
| Hidden list fields | selectable in Next field picker/hook if present in `list.fields` | filtered out of picker and selected-field resolution | Divergent |
| Empty state detection | only `search` marks the list as filtered | `search` or any `!filter` marks list as filtered | Divergent |
| Exact operator names/payloads | several field-specific contracts | several mismatches | Gap |

---

## Detailed gaps

### 1) Search semantics do not match Next
**Severity:** High

**Next baseline**
- Server component builds `filterWhere = buildWhereClause(list, searchParamsObj)` and then separately builds `searchWhere = buildWhereClause(list, { search: searchString })`, then ANDs them together: `features/dashboard/screens/ListPage/index.tsx:46-62`.
- Client refetch path does the same double-build: `features/dashboard/screens/ListPage/ListPageClient.tsx:96-119`.
- `buildWhereClause` itself already handles `search` and uses case-insensitive contains: `features/dashboard/lib/buildWhereClause.ts:303-331`.

**TanStack current**
- TanStack computes a single `where = buildWhere(list, search, filters)` in the data layer: `src/features/cms/graphql-client.ts:371-405`, used by `fetchDashboardListPage()` at `src/features/cms/graphql-client.ts:468-471`.
- Search conditions use `{ contains: trimmed }` with no `mode: 'insensitive'`: `src/features/cms/graphql-client.ts:375-382`.

**Impact**
- TanStack search is **not case-insensitive like Next**.
- TanStack also **does not reproduce Next’s duplicated search/initialFilter composition**.
  - This is a real parity gap.
  - It is also likely a correctness improvement, because Next applies `initialFilter` and search twice.

**Minimal implementation slice**
- If parity means “match visible behavior, not bugs”:
  - `src/features/cms/graphql-client.ts`
    - change text search clauses to include `mode: 'insensitive'`.
- If parity means strict bug-for-bug matching:
  - move search assembly out of `buildWhere()` and mirror Next’s two-pass composition in `src/routes/dashboard/$listKey.tsx` / `fetchDashboardListPage()`.
  - I would **not** recommend this.

---

### 2) Empty-state logic differs for filter-only URLs
**Severity:** High

**Next baseline**
- `isFiltered` only looks at `searchString`: `features/dashboard/screens/ListPage/ListPageClient.tsx:210-213`.
- Result: a zero-result `!field_operator=` URL without `search=` will fall through to the default empty state, not the “No Results Found” state.

**TanStack current**
- `isFiltered` is true for either `search` or any URL key beginning with `!`: `src/routes/dashboard/$listKey.tsx:75-76`.
- `KeystoneListTable` then chooses the filtered empty state when `isFiltered` is true: `src/components/dashboard/keystone-list-table.tsx:61-80`.

**Impact**
- TanStack behaves differently from Next for filter-only empty results.
- This is arguably better UX, but it is not parity.

**Minimal implementation slice**
- To match Next exactly:
  - `src/routes/dashboard/$listKey.tsx`
    - change `isFiltered` to only consider `search.search.trim()`.
- To keep current UX, leave as-is and document the intentional divergence.

---

### 3) Filter-pill edit semantics differ
**Severity:** High

**Next baseline**
- When editing an existing pill, Next removes **all filters for the same field** before saving the edited one: `features/dashboard/components/FilterList.tsx:240-252`.
- This means editing `!status_matches` collapses sibling `!status_not_matches`, etc.

**TanStack current**
- Editing a pill only updates the current key: `src/components/dashboard/filter-bar.tsx:128-131`, used by `FilterPill.save()` at `src/components/dashboard/filter-bar.tsx:381-383`.
- No sibling cleanup is performed.

**Impact**
- Same-field multi-filter state evolves differently after pill edits.
- URLs and resulting where clauses can diverge from the Next baseline after user edits.

**Minimal implementation slice**
- `src/components/dashboard/filter-bar.tsx`
  - in `updateFilter(key, value)`, derive the field prefix from `key` and delete any existing search params whose key starts with `!${fieldPath}_` before setting the saved key.

---

### 4) Checkbox filter contract is different (`is/not` vs `equals/not`)
**Severity:** High

**Next baseline**
- Checkbox controller exposes `is` and `not`: `features/dashboard/views/checkbox/index.tsx:111-151`.
- URL contract is therefore `!field_is=<json>` or `!field_not=<json>`.

**TanStack current**
- Registry exposes `equals` and `not`: `src/components/dashboard/views/registry.tsx:124-128`.
- Server only recognises `equals` and `not` for checkbox filters: `src/features/cms/graphql-client.ts:299,355`.

**Impact**
- Existing Next URLs using `!published_is=true` will not map to the same operator set in TanStack.
- This is both a UI-label mismatch and a URL-contract mismatch.

**Minimal implementation slice**
- `src/components/dashboard/views/registry.tsx`
  - rename checkbox filter types from `equals/not` to `is/not`.
- `src/features/cms/graphql-client.ts`
  - change checkbox `filterTypesForField()` to return `['is', 'not']`.
  - update `filterWhereForField()` checkbox branch to map `is -> equals`, `not -> equals inverse`.

---

### 5) Integer and float filters are missing `empty` / `not_empty`
**Severity:** High

**Next baseline**
- Integer exposes `equals`, `not`, `gt`, `lt`, `gte`, `lte`, `empty`, `not_empty`: `features/dashboard/views/integer/index.tsx:257-266`.
- Float does the same: `features/dashboard/lib/buildWhereClause.ts:84-101` and controller grep output confirm `empty/not_empty` support.

**TanStack current**
- Integer/float only expose `equals`, `not`, `lt`, `lte`, `gt`, `gte`: `src/components/dashboard/views/registry.tsx:114-122`.
- Server only recognises those six operators: `src/features/cms/graphql-client.ts:298,356-359`.

**Impact**
- Users lose nullable-number filtering parity.
- Next URLs like `!score_empty=null` have no equivalent TanStack operator exposure.

**Minimal implementation slice**
- `src/components/dashboard/views/registry.tsx`
  - add `empty` and `not_empty` with `needsValue: false` (or null initial values if you want to mirror Next payloads).
- `src/features/cms/graphql-client.ts`
  - include `empty/not_empty` in numeric `filterTypesForField()`.
  - handle them in `filterWhereForField()` before numeric parsing.

---

### 6) Multiselect semantics do not match Next
**Severity:** High

**Next baseline**
- Multiselect exposes `matches` and `not_matches` with array-valued selection UI: `features/dashboard/views/multiselect/index.tsx:228-298`.
- Labels are semantic (`is`, `is not`) and values are real option selections.

**TanStack current**
- Registry exposes only `contains`: `src/components/dashboard/views/registry.tsx:130`.
- Server maps multiselect to `{ has: value }`: `src/features/cms/graphql-client.ts:300,361`.

**Impact**
- Operator set, URL keys, payload shape, and GraphQL semantics all diverge.
- Next-style URLs such as `!tags_matches=["a","b"]` are not a first-class TanStack contract.

**Minimal implementation slice**
- `src/components/dashboard/views/registry.tsx`
  - replace multiselect `contains` with `matches` / `not_matches`.
  - expose a multi-option picker rather than free text.
- `src/features/cms/graphql-client.ts`
  - recognise `matches/not_matches` for multiselect.
  - map them to `in/notIn`-style semantics consistent with the Next baseline.

---

### 7) Document filters are exposed in Next but absent in TanStack
**Severity:** High

**Next baseline**
- Document filter UI exists and exposes `contains`, `not_contains`, `is_empty`: `features/dashboard/views/document/index.tsx:323-377`.

**TanStack current**
- No document filter types are present in the registry’s scalar exposure table: `src/components/dashboard/views/registry.tsx:75-131`.
- Data-layer `filterTypesForField()` does not recognise `document`: `src/features/cms/graphql-client.ts:292-302`.

**Impact**
- There is no TanStack equivalent for Next document-list filtering.

**Minimal implementation slice**
- `src/components/dashboard/views/registry.tsx`
  - add document filter controller exposure and input.
- `src/features/cms/graphql-client.ts`
  - add `document` operator recognition and matching GraphQL translation.

---

### 8) `empty` / `not_empty` URL payloads differ
**Severity:** Medium

**Next baseline**
- Many controllers initialise emptiness operators with `null` or empty string values, e.g. relationship: `features/dashboard/views/relationship/index.tsx:499-510`, timestamp: `features/dashboard/views/timestamp/index.tsx:368-393`, integer: `features/dashboard/views/integer/index.tsx:257-266`.
- `FilterAdd` writes `JSON.stringify(state.filterValue)`: `features/dashboard/components/FilterAdd.tsx:66-80`.

**TanStack current**
- Registry uses `needsValue: false` and often `initialValue: true` for empty operators, e.g. relationship: `src/components/dashboard/views/registry.tsx:53-63`, timestamp/decimal/bigInt similarly at `:90-112`.
- `addFilter()` writes `true` for any `needsValue === false` operator: `src/components/dashboard/filter-bar.tsx:112-117`.

**Impact**
- Behavior is mostly equivalent because the server ignores the value for empty operators.
- But the **URL payload contract is different** (`true` vs `null` / `""`).

**Minimal implementation slice**
- `src/components/dashboard/filter-bar.tsx`
  - write controller-provided `initialValue` for empty operators instead of hard-coded `true`.
- `src/components/dashboard/views/registry.tsx`
  - align `initialValue` values with Next per field type.

---

### 9) ID filter input semantics differ from Next
**Severity:** Medium

**Next baseline**
- ID controller uses a plain string input, and only splits for `in/not_in`: `features/dashboard/lib/buildWhereClause.ts:121-149` and controller grep output from `features/dashboard/views/id/index.tsx`.

**TanStack current**
- Registry parses **all** `id` input values as comma-split arrays: `src/components/dashboard/views/registry.tsx:134-138`.
- For `is/not/gt/lt/gte/lte`, the server later coerces the array back with `String(value)`: `src/features/cms/graphql-client.ts:333-339`.

**Impact**
- Single-value ID operators still work for one entered ID, but the value shape and URL payload do not match Next.
- It is an awkward contract for exact-match operators.

**Minimal implementation slice**
- `src/components/dashboard/views/registry.tsx`
  - make `parseFilterInputValue()` operator-aware for `id`, splitting only for `in/not_in`.
  - this requires passing `type` into the parser or moving parsing into the controller `Filter` handler.

---

### 10) Select filter UI semantics are simpler than Next
**Severity:** Medium

**Next baseline**
- Select controller uses option-based multi-selection UI for `matches/not_matches`: `features/dashboard/views/select/index.tsx:312-358`.

**TanStack current**
- Registry reuses a generic text input and comma-splitting for `select`: `src/components/dashboard/views/registry.tsx:38-40,88,137`.
- Server accepts either arrays or comma-separated strings via `stringListFilterValue()`: `src/features/cms/graphql-client.ts:310-331`.

**Impact**
- Operator names match, but interaction and payload provenance do not.
- TanStack loses the exact option-picker semantics of Next.

**Minimal implementation slice**
- `src/components/dashboard/views/registry.tsx`
  - add a select-option filter input instead of generic free text.
  - keep URL keys as `matches/not_matches`.

---

### 11) Sort UI semantics differ for `initialSort` / fallback sort
**Severity:** High

**Next baseline**
- Data fetch falls back to `initialSort` / preferred fields: `features/dashboard/lib/sort.ts:1-42`, used by `buildOrderByClause()` at `features/dashboard/lib/buildOrderByClause.ts:1-8`.
- But UI controls only look at explicit `searchParams.get('sortBy')`: `features/dashboard/components/SortSelection.tsx:76-107`.
- Table header sort state also uses the raw query string: `features/dashboard/components/ListTable.tsx:233-275`.
- Therefore Next can fetch sorted data while showing **no active sort**.

**TanStack current**
- TanStack resolves an effective sort token in the data layer: `src/features/cms/graphql-client.ts:412-439`.
- The route passes `data.sortBy` down into the filter bar as `effectiveSortBy`: `src/routes/dashboard/$listKey.tsx:93-95`.
- Table headers also use `data.sortBy`: `src/components/dashboard/keystone-list-table.tsx:118-120,186-219`.

**Impact**
- TanStack surfaces implicit sort state; Next does not.
- Clearing sort in TanStack can still show an active fallback/initial sort, while Next visually clears the control.

**Minimal implementation slice**
- For strict Next parity:
  - `src/routes/dashboard/$listKey.tsx`
    - stop passing `effectiveSortBy` to `FilterBar`.
  - `src/components/dashboard/keystone-list-table.tsx`
    - use the raw URL `sortBy`, not effective sort.
- I would only do this if visual parity is more important than clarity.

---

### 12) Sort clear behavior diverges from Next
**Severity:** Medium

**Next baseline**
- Clearing sort deletes `sortBy` from the URL and closes the menu: `features/dashboard/components/SortSelection.tsx:37-42`.
- Because the component is URL-driven only, the control returns to the generic “SORT” trigger.

**TanStack current**
- Clearing sort removes `sortBy` from search state: `src/components/dashboard/filter-bar.tsx:103-105,276-280`.
- But `activeSortBy` falls back to `effectiveSortBy`: `src/components/dashboard/filter-bar.tsx:97`.

**Impact**
- After “Clear”, TanStack may still show an active sort label and direction if `initialSort` or fallback sort exists.

**Minimal implementation slice**
- `src/components/dashboard/filter-bar.tsx`
  - make `activeSortBy` depend only on explicit `searchParams.sortBy` if you want exact Next parity.

---

### 13) Hidden-field handling differs in field selection
**Severity:** Medium

**Next baseline**
- Field picker iterates all `listMeta.fields` except `id`: `features/dashboard/components/FieldSelection.tsx:70-76`.
- `useSelectedFields()` also accepts any field present in `list.fields`: `features/dashboard/hooks/useSelectedFields.ts:13-31`.

**TanStack current**
- Field picker filters out hidden list-view fields: `src/components/dashboard/filter-bar.tsx:308-310,329-348`.
- `selectedListFields()` also filters hidden fields from both defaults and URL-driven selection: `src/features/cms/graphql-client.ts:249-260`.

**Impact**
- Any hidden field that still exists in Next’s `list.fields` can be selected in Next but not in TanStack.
- TanStack is stricter and likely safer, but not equivalent.

**Minimal implementation slice**
- For strict Next parity:
  - `src/components/dashboard/filter-bar.tsx`
    - remove `field.listView.fieldMode !== 'hidden'` filtering in `FieldSelection`.
  - `src/features/cms/graphql-client.ts`
    - remove the hidden-field filter from `selectedListFields()`.

---

### 14) Field-selection default URL semantics differ
**Severity:** Medium

**Next baseline**
- Next tries to clear the `fields` query param when the chosen columns equal `listMeta.initialColumns`: `features/dashboard/components/FieldSelection.tsx:52-64`.
- But it compares a payload that already includes `id` (`fieldsWithId`) against `initialColumns` without `id`: `features/dashboard/components/FieldSelection.tsx:94-96` vs `:52-64`.
- In practice, default-column restoration does **not** cleanly collapse back to the no-`fields` URL.

**TanStack current**
- TanStack compares against `['id', ...defaultColumns]`: `src/components/dashboard/filter-bar.tsx:308-316`.
- When equal, it clears `fields` entirely by passing an empty set: `src/components/dashboard/filter-bar.tsx:315-316`, then `updateFields()` omits the param: `src/components/dashboard/filter-bar.tsx:107-110`.

**Impact**
- URL normalization differs.
- TanStack is cleaner, but it is not matching the current Next contract.

**Minimal implementation slice**
- If parity to current Next URL behavior is required:
  - `src/components/dashboard/filter-bar.tsx`
    - compare against `list.initialColumns` without automatically prefixing `id` in the “is default” check.
- I would not recommend copying this bug unless external tests depend on it.

---

### 15) TanStack defaults to first visible field; Next can default to first raw field
**Severity:** Low

**Next baseline**
- `useSelectedFields()` falls back to `Object.keys(list.fields).slice(0, 1)`: `features/dashboard/hooks/useSelectedFields.ts:21-24`.

**TanStack current**
- `selectedListFields()` falls back to the first **visible** field path after excluding `id` and hidden list-view fields: `src/features/cms/graphql-client.ts:251-253`.

**Impact**
- Default visible columns can diverge if the first raw field is hidden.

**Minimal implementation slice**
- `src/features/cms/graphql-client.ts`
  - if strict parity is required, mirror Next’s raw-object fallback instead of visible-field fallback.

---

### 16) Filter operator coverage matrix is not yet equivalent
**Severity:** High

### Operator matrix

| Field kind | Next baseline | TanStack current | Status |
|---|---|---|---|
| text | `contains_i`, `not_contains_i`, `is_i`, `not_i`, `starts_with_i`, `not_starts_with_i`, `ends_with_i`, `not_ends_with_i` (`features/dashboard/views/text/index.tsx:277-357`) | same (`src/components/dashboard/views/registry.tsx:76-86`) | Good |
| select | `matches`, `not_matches` (`features/dashboard/views/select/index.tsx:338-358`) | same names, but free-text CSV UI (`src/components/dashboard/views/registry.tsx:88`) | Partial |
| id | `is`, `not`, `gt`, `lt`, `gte`, `lte`, `in`, `not_in` | same names (`src/components/dashboard/views/registry.tsx:89`) but payload parsing differs | Partial |
| checkbox | `is`, `not` (`features/dashboard/views/checkbox/index.tsx:140-150`) | `equals`, `not` (`src/components/dashboard/views/registry.tsx:124-128`) | Gap |
| integer | adds `empty`, `not_empty` (`features/dashboard/views/integer/index.tsx:257-266`) | missing emptiness ops (`src/components/dashboard/views/registry.tsx:114-122`) | Gap |
| float | adds `empty`, `not_empty` (controller/buildWhere evidence) | missing emptiness ops (`src/components/dashboard/views/registry.tsx:114-122`) | Gap |
| decimal | `equals`, `not`, `gt`, `lt`, `gte`, `lte`, `empty`, `not_empty` | same names (`src/components/dashboard/views/registry.tsx:102-112`) | Partial (payload differs) |
| bigInt | same as decimal | same names (`src/components/dashboard/views/registry.tsx:102-112`) | Partial (payload differs) |
| timestamp | `equals`, `not`, `lt`, `gt`, `empty`, `not_empty` shown in controller (`features/dashboard/views/timestamp/index.tsx:368-393`) | includes `lte/gte` too (`src/components/dashboard/views/registry.tsx:90-100`) | Divergent |
| relationship (one) | `empty`, `not_empty`, `is`, `not_is` (`features/dashboard/views/relationship/index.tsx:499-510`) | same names (`src/components/dashboard/views/registry.tsx:58-63`) | Partial (payload/UI differs) |
| relationship (many) | `empty`, `not_empty`, `some`, `not_some` | same names (`src/components/dashboard/views/registry.tsx:51-57`) | Partial |
| multiselect | `matches`, `not_matches` (`features/dashboard/views/multiselect/index.tsx:288-297`) | `contains` (`src/components/dashboard/views/registry.tsx:130`) | Gap |
| document | `contains`, `not_contains`, `is_empty` (`features/dashboard/views/document/index.tsx:363-377`) | none | Gap |

**Notes**
- I did **not** include json/image here because I could not verify a clear, controller-exposed Next filter UI contract from the inspected files. The dead server mappings in `features/dashboard/lib/buildWhereClause.ts` are not enough by themselves to count as exposed behavior.

---

## What is already solid in TanStack
- Route-level validation and canonical list-path redirect are implemented cleanly: `src/routes/dashboard/$listKey.tsx:9-27`.
- Selected columns are fetched server-side and preserved in the list payload: `src/features/cms/graphql-client.ts:249-260,468-494`.
- Filter keys are still controller-derived and URL-driven, matching the overall Next mental model: `src/components/dashboard/filter-bar.tsx:82-97,202-220`.
- Relationship filter editing/loading is fully wired through typed fetchers and selected-label hydration: `src/components/dashboard/views/relationship-filter-input.tsx:24-115`.
- Empty-state rendering in the table itself is cleaner and more centralized than in Next: `src/components/dashboard/keystone-list-table.tsx:61-92`.

---

## Recommended implementation order for parity
1. **Operator contract fixes first**
   - checkbox `is/not`
   - integer/float `empty/not_empty`
   - multiselect `matches/not_matches`
   - document filters
2. **Behavioral contract fixes**
   - FilterPill edit sibling-removal semantics
   - empty-state detection choice
   - sort/initialSort display semantics
3. **URL normalization / edge parity**
   - empty/not_empty payload alignment
   - id payload parsing
   - field-selection default URL semantics
4. **Decide explicitly whether to copy Next bugs**
   - duplicated search/initialFilter assembly
   - hidden-field selection exposure

---

## Bottom line
The biggest remaining parity blockers are not the shell layout or table rendering; they are the **list-control contracts**:
- exact filter operators,
- URL payload shapes,
- sort visibility semantics,
- field-selection semantics,
- and filtered-empty-state rules.

If you want the smallest high-value parity set, the minimum target should be:
1. checkbox/integer/float/multiselect/document filter alignment,
2. filter-pill edit semantics,
3. sort clear/initialSort UI decision,
4. explicit decision on whether to keep TanStack’s better filtered-empty-state and cleaner search assembly or to copy Next exactly.
