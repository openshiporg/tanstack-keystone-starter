# Code Context

## Files Retrieved
1. `src/components/dashboard/filter-bar.tsx` (lines 54-117) - target `FilterBar` state and control row; still uses local `showFilter` inline add-filter state instead of a popover workflow.
2. `src/components/dashboard/filter-bar.tsx` (lines 135-157) - target inline add-filter panel rendered in page flow.
3. `src/routes/dashboard/$listKey.tsx` (lines 206-214) - list-page entry point confirming `FilterBar` is the sole list-controls surface to change.
4. `../next-keystone-starter/features/dashboard/components/FilterBar.tsx` (lines 186-214) - reference composition showing Next wraps the Filter button with `FilterAdd`.
5. `../next-keystone-starter/features/dashboard/components/FilterAdd.tsx` (lines 144-214) - reference popover-based add-filter flow, including trigger, popover content, and apply semantics.

## Key Code

### Target still differs
In `src/components/dashboard/filter-bar.tsx`, the add-filter UI remains inline and layout-shifting:

- local toggle state: `src/components/dashboard/filter-bar.tsx:58-63`
- trigger button toggles `showFilter`: `src/components/dashboard/filter-bar.tsx:128-131`
- inline panel body: `src/components/dashboard/filter-bar.tsx:144-157`

That panel renders a flat row of native `<select>` controls plus `Input` and `Apply`.

### Next reference behavior
Next mounts filter creation as a popover attached to the Filter button:

- `FilterBar` uses `<FilterAdd list={list}>...</FilterAdd>`: `../next-keystone-starter/features/dashboard/components/FilterBar.tsx:186-195`
- `FilterAdd` owns popover open state: `../next-keystone-starter/features/dashboard/components/FilterAdd.tsx:24-31`
- trigger is wrapped with `PopoverTrigger asChild`: `../next-keystone-starter/features/dashboard/components/FilterAdd.tsx:144-147`
- content is rendered in `PopoverContent align="start"`: `../next-keystone-starter/features/dashboard/components/FilterAdd.tsx:148-214`
- apply semantics preserve the same query contract: `!${state.fieldPath}_${state.filterType}` and clear `page`: `../next-keystone-starter/features/dashboard/components/FilterAdd.tsx:56-70`

### Data flow already matches
The target already writes filter params correctly through `addFilter()`:

- key format: `filterKey(fieldPath, type)` in `src/components/dashboard/filter-bar.tsx:50-52`
- URL update on apply: `src/components/dashboard/filter-bar.tsx:89-96`
- route mounting point: `src/routes/dashboard/$listKey.tsx:206-214`

So the remaining parity gap is not backend/query parsing; it is the add-filter interaction model.

## Architecture
- `src/routes/dashboard/$listKey.tsx` renders `FilterBar` on every list page.
- `FilterBar` owns search, sort, displayed fields, active filter pills, and add-filter URL mutations.
- The active-filter pill editing gap appears fixed already in target, but filter creation is still embedded inline.
- Because query semantics are already correct, this parity fix stays local to `src/components/dashboard/filter-bar.tsx`.

## Start Here
Open `src/components/dashboard/filter-bar.tsx` first. It already contains the full add-filter state machine and can absorb the parity fix without touching routes, loaders, or GraphQL.

## Next single concrete fixable parity gap
**Gap:** The TanStack dashboard still uses an inline add-filter panel, while Next uses a popover-based `FilterAdd` workflow attached to the Filter button.

### Exact files
- Target: `src/components/dashboard/filter-bar.tsx`
- Reference: `../next-keystone-starter/features/dashboard/components/FilterBar.tsx`
- Reference: `../next-keystone-starter/features/dashboard/components/FilterAdd.tsx`

### Minimal implementation
In `src/components/dashboard/filter-bar.tsx`:

1. Import the existing popover primitives from `@/components/ui/popover`.
2. Replace `showFilter` with `isFilterOpen` popover state.
3. Wrap the existing Filter button in `PopoverTrigger asChild`.
4. Move the current add-filter form into `PopoverContent align="start" className="w-[240px] p-3"` instead of rendering it as an inline toolbar block.
5. Keep existing target logic for field/type/value selection and `addFilter()` URL mutation, but on successful apply:
   - close the popover,
   - clear `filterValue`,
   - leave query format as `!fieldPath_filterType`,
   - keep `page: 1` reset.
6. Remove the layout-shifting `{showFilter && ...}` block from below the toolbar.

### Why this is the next best fix
- The prompt’s previously named areas appear covered.
- This is still visibly divergent from Next on every list page.
- It is small, local, and non-backend.
- The target already has the necessary filter state and URL semantics, so the fix is mostly presentation/interaction parity.