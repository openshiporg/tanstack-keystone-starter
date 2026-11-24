# Batch 3 list/filter/sort parity

Date: 2026-05-19

## What changed

Implemented the scoped Batch 3 list-control parity work from `reports/parity-dissertation/00-master-parity-dissertation-and-roadmap.md`.

### 1) Aligned checkbox filter semantics to `is` / `not`
- Changed checkbox filter exposure from drifted `equals` / `not` semantics to Next-style `is` / `not`.
- Updated server-side filter recognition/mapping so checkbox filters serialize to the same URL/operator shape while still mapping to boolean equality correctly in the GraphQL where clause.

### 2) Added integer/float `empty` / `not_empty`
- Added missing `empty` and `not_empty` operators for integer and float filters in the target filter registry.
- Added matching server-side parsing/where-clause support so nullable numeric fields can now be filtered like the Next baseline.

### 3) Reworked multiselect filter semantics to `matches` / `not_matches`
- Replaced target multiselect `contains` drift with Next-style `matches` / `not_matches` operators.
- Switched the UI from free-text entry to option-based checkbox selection using the field’s configured options.
- Updated server-side parsing to emit `in` / `notIn` list semantics instead of single-value `has` semantics.

### 4) Added document filter availability in the current target architecture
- Added minimal document filter support in the target registry and server parser.
- Implemented:
  - `contains`
  - `not_contains`
  - `is_empty`
- This is intentionally limited to what the current target architecture can support without starting the create/item controller batch.

### 5) Fixed FilterPill edit sibling-removal semantics
- Editing an existing filter pill now removes sibling filters for the same field before saving the updated one, matching the Next baseline’s behavior.
- This closes the drift where the target previously updated only the current key and allowed same-field sibling filters to persist incorrectly after edits.

### 6) Aligned empty/not-empty URL payload behavior to controller initial values
- The add/edit filter flows no longer hardcode `true` for `needsValue: false` operators.
- They now persist the controller-defined `initialValue`, which brings URL payloads closer to the Next behavior and avoids target-specific boolean noise.

### 7) Reconciled sort UI semantics toward explicit-URL parity
- Removed the target-only `effectiveSortBy` display behavior from the filter bar.
- The sort control now reflects only the explicit `sortBy` URL param, which matches the Next baseline where implicit `initialSort` / fallback sort affects data fetch but is not surfaced as an active UI sort.
- Clearing sort now behaves consistently with that explicit-URL model.

### 8) Reconciled table-header sort highlighting with explicit sort only
- The list table header sort indicators now use the explicit `sortBy` URL state instead of the data-layer effective sort.
- This aligns visible header state with the Next behavior where fallback sort can exist without rendering as an active UI sort.

### 9) Reconciled field-selection default URL semantics
- Adjusted the “default columns” comparison to ignore the hidden `id` prefix when deciding whether to clear the `fields` URL parameter.
- This makes the target field-selection URL normalization closer to the current Next semantics around default column selection.

### 10) Made a deliberate filtered empty-state call
- Changed list-page `isFiltered` back to `search`-only detection, matching the current Next baseline.
- This means filter-only zero-result URLs no longer show the special “No Results Found” filtered state.
- This is a deliberate parity choice even though the previous target behavior was arguably better UX.

## Exact files changed

- `src/components/dashboard/views/registry.tsx`
- `src/features/cms/graphql-client.ts`
- `src/components/dashboard/filter-bar.tsx`
- `src/routes/dashboard/$listKey.tsx`
- `src/components/dashboard/keystone-list-table.tsx`

## Validations run and results

### Required validations
- `npm run lint` ✅ passed
- `npm run build` ✅ passed

### Targeted shared-runtime validation
- `npm run test:cms` ✅ passed

## Remaining blockers / follow-up notes

These Batch 3 changes were intentionally limited to list-control behavior and do **not** claim full list-page parity yet.

### Still not done in this batch
- Select filter UI still uses the current target-native option checklist rather than porting the exact Next select view implementation.
- ID filter input semantics were tightened server-side only insofar as shared parsing allows; full exact controller-level `in/not_in` vs scalar-input parity would be cleaner once the field-controller architecture batch lands.
- I did **not** copy Next’s duplicated search/initialFilter assembly bug; the target still keeps the cleaner single-pass data-layer composition.
- I did **not** broaden hidden-field exposure in field selection, because the roadmap framed that as something to choose deliberately rather than copy blindly.
- Document filters are only minimally exposed and do not imply full document-field parity with official Keystone.

### Important intentional calls
- **Filtered empty-state:** matched Next’s current behavior even though the earlier target UX was arguably better.
- **Sort visibility:** matched Next’s explicit-URL-only sort UI semantics, not the target’s previous “show effective sort” behavior.
- **Next bug compatibility:** avoided copying the duplicated search/initialFilter assembly bug; kept the cleaner target behavior and treated it as a deliberate non-parity bugfix choice.
