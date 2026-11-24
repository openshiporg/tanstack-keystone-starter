# Code Context

## Files Retrieved
1. `src/components/dashboard/filter-bar.tsx` (lines 1-340) - target list controls implementation; contains the remaining parity gap in active filter pill behavior.
2. `src/routes/dashboard/$listKey.tsx` (lines 1-115) - shows `FilterBar` as the list-page entry point and confirms the active-filters UI is surfaced on every dashboard list.
3. `../next-keystone-starter/features/dashboard/components/FilterBar.tsx` (lines 1-163) - reference composition proving Next still uses separate `FilterAdd`, `FilterList`, `SortSelection`, and `FieldSelection` components.
4. `../next-keystone-starter/features/dashboard/components/FilterList.tsx` (lines 1-278) - reference implementation for filter pills, including editable popover behavior and exact pill styling/content.

## Key Code

### Target gap
In `src/components/dashboard/filter-bar.tsx`, active filters are rendered as two outline buttons, but the label pill is wired to **remove** the filter instead of **edit/open** it:

- Remove button: `onClick={() => removeFilter(key)}` at `src/components/dashboard/filter-bar.tsx:165-172`
- Label pill also removes: `onClick={() => removeFilter(key)}` at `src/components/dashboard/filter-bar.tsx:173-180`
- Label text is flattened to `fieldLabel filterLabel value` at `src/components/dashboard/filter-bar.tsx:179`

That diverges from Next, where `FilterList` renders:
- a left X button that removes the filter (`../next-keystone-starter/features/dashboard/components/FilterList.tsx:177-187`)
- a right label button that opens a popover for editing (`../next-keystone-starter/features/dashboard/components/FilterList.tsx:188-209`)
- segmented label styling: field label, chevron, formatted filter label, trailing chevron (`../next-keystone-starter/features/dashboard/components/FilterList.tsx:193-199`)
- an edit dialog that saves back to the same `!field_type` query param (`../next-keystone-starter/features/dashboard/components/FilterList.tsx:229-277`)

### Data flow
- `src/routes/dashboard/$listKey.tsx:92-94` mounts `<FilterBar list={list} selectedFields={selectedFields} />`.
- `FilterBar` derives active filters from `useSearch()` query params via keys prefixed with `!` (`src/components/dashboard/filter-bar.tsx:76-78`).
- Those params are already the same contract Next uses, so the missing parity is not backend parsing; it is the pill interaction/styling layer.

## Architecture
The remaining concrete parity gap is isolated to the list filter UI:

1. Route-level search state lives in TanStack Router (`src/routes/dashboard/$listKey.tsx`).
2. `FilterBar` both mutates and renders filter state from URL params (`src/components/dashboard/filter-bar.tsx`).
3. Unlike Next’s split architecture (`FilterBar` + `FilterList`), the target has inlined everything into one file, which made the filter pill regress from an editable popover into a destructive action.

This is a good next fix because:
- it is local to one component file,
- it does not require schema/backend changes,
- it restores an obvious user-facing parity regression that remains after the listed prior fixes.

## Start Here
Open `src/components/dashboard/filter-bar.tsx` first. It already owns active filter rendering, and the minimal parity fix can be made there without touching route loaders or GraphQL code.

## Next single concrete fixable parity gap
**Gap:** Active filter pills in TanStack are still non-parity: clicking the label pill deletes the filter instead of opening an edit popover, and the pill content/styling is simplified.

### Exact files
- Target: `src/components/dashboard/filter-bar.tsx`
- Reference: `../next-keystone-starter/features/dashboard/components/FilterList.tsx`

### Minimal implementation
Inside `src/components/dashboard/filter-bar.tsx`:
1. Extract the active-filter strip into a small local `FilterList`/`FilterPill` helper, mirroring Next.
2. Keep the existing remove X button behavior.
3. Change the right-hand pill button to open a `Popover` instead of calling `removeFilter`.
4. In the popover, render a tiny edit form that:
   - preloads the parsed current value,
   - updates the same `!fieldPath_filterType` query key,
   - clears `page` on save,
   - closes on cancel/save.
5. Match Next’s pill content structure more closely:
   - muted field label,
   - chevron separator,
   - bold/truncated formatted label,
   - trailing chevron-down affordance.

### Why this is the next best fix
Other audited areas from the prompt list are already addressed or have broader scope. This one is:
- still clearly divergent from Next,
- small and self-contained,
- directly visible on every filtered list page,
- supported by exact reference code to copy semantically.
