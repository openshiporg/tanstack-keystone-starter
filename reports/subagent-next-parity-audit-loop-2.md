# Second-loop parity audit (next concrete fixable gap)

## Finding: missing filtered-empty state + reset action on TanStack list page

**Why this is the next concrete gap:** list filtering/search already exists in TanStack, but when results are empty under active filters, UI parity diverges from Next implementation and gives the wrong user cue.

### Source parity comparison

- **Reference (Next):** `features/dashboard/screens/ListPage/ListPageClient.tsx`
  - Builds `isFiltered` from search state and renders a dedicated filtered-empty state with reset action:
    - `EmptyStateSearch` title: **"No Results Found"**
    - reset button: **"Reset Filters"**
  - Also keeps separate default-empty state for genuinely empty lists.

- **Current (TanStack):** `src/routes/dashboard/$listKey.tsx` + `src/components/dashboard/keystone-list-table.tsx`
  - Route always renders `<KeystoneListTable data={data} />` when not loading/error.
  - Table only has one empty branch (`data.items.length === 0`) that always shows:
    - **"No {list.label} Created"** + create CTA
  - No branch for "empty due to active search/filter" and no reset-filters affordance.

## Exact files to change

1. `src/routes/dashboard/$listKey.tsx`
   - Add filtered-empty detection from `search` (and `!`-prefixed filter params already used by filter bar).
   - Pass an `isFiltered`/`onResetFilters` signal into list rendering, or branch before rendering table.

2. `src/components/dashboard/keystone-list-table.tsx`
   - Split current empty state into:
     - default empty (no items created), and
     - filtered empty ("No Results Found", "Try adjusting your search filters.", reset button)
   - Reset should clear query search/filter params (at minimum `search` and `!…` filters).

## Suggested implementation direction (minimal)

- In route (`$listKey.tsx`), compute:
  - `hasSearch = Boolean(search.search?.trim())`
  - `hasFieldFilters = Object.keys(search).some((k) => k.startsWith('!'))`
  - `isFiltered = hasSearch || hasFieldFilters`
- Pass `isFiltered` to `KeystoneListTable`.
- In `KeystoneListTable`, for `data.items.length === 0`:
  - if `isFiltered`, show filtered-empty state + reset button using `navigate({ search: (prev) => remove search + !filters, page: 1 })`
  - else keep existing "No X Created" state.

This is a targeted, low-risk parity win for list filter/search UX and avoids misleading "No Created" messaging when filters are active.
