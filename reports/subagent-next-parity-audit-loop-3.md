# Third-loop parity audit (post-fix): next single concrete gap

## Finding
The next most concrete parity gap is in **filtered empty-state reset behavior** for list pages.

- **Target (tanstack) behavior** clears only filter/search params and keeps non-filter URL state when clicking **Reset Filters**.
- **Reference (next-keystone) behavior** hard-resets to pathname, dropping all query params.

This is a UX/behavior parity mismatch and is narrowly fixable.

## Exact file evidence

1. **Target implementation (desired parity behavior)**  
   `src/components/dashboard/keystone-list-table.tsx` (lines 54-79)
   - On empty filtered results, Reset Filters does:
   - sets `search: ''`, `page: 1`
   - deletes only params whose keys start with `'!'`
   - preserves unrelated search params

2. **Current reference behavior to match against**  
   `features/dashboard/screens/ListPage/ListPageClient.tsx` (lines 177-180)
   - `handleResetFilters` is currently:
   - `router.push(window.location.pathname)`
   - This drops all query params, not just filter/search params.

## Minimal implementation suggestion
Update `handleResetFilters` in:
- `features/dashboard/screens/ListPage/ListPageClient.tsx`

to mirror target semantics:
- Start from current `window.location.search` (or `useSearchParams` copy)
- Clear `search`
- Set page back to first page (remove `page` or set to `1`, consistent with local URL conventions)
- Remove only filter keys (those prefixed with `!`)
- Preserve non-filter params (e.g., fields/sort/pageSize)
- Push reconstructed query string instead of raw pathname-only navigation.

This is the single most concrete remaining parity gap among the scoped areas after signup, error boundary, and pagination alert-dialog fixes.