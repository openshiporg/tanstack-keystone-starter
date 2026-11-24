# Fourteenth-loop parity audit: next single fixable gap

## Gap
**Sort fallback contract parity is still missing in target** (`tanstack-keystone-starter`).

In `next-keystone-starter`, sort resolution has a fallback contract when `sortBy` is absent/invalid:
1. valid `sortBy`
2. `list.initialSort`
3. preferred orderable fields (`createdAt`, `updatedAt`, `timestamp`, `date`, `id`)
4. first orderable field
5. final `id asc` fallback

In target, `buildOrderBy` only respects explicit `sortBy` and otherwise returns `[]`, so list queries can be unsorted instead of deterministically sorted.

## Evidence
- **Reference behavior**: `/Users/junaid/code/next-keystone-starter/features/dashboard/lib/sort.ts` (lines 1-60)
  - `getSortFromSearchParams` implements full fallback chain.
- **Target behavior**: `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/graphql-client.ts` (lines 297-305)
  - `buildOrderBy` derives from `sortBy` only and returns `[]` when missing/invalid.
- **Caller path**: `/Users/junaid/code/tanstack-keystone-starter/src/routes/dashboard/$listKey.tsx` (validateSearch sets `sortBy` to `''` when absent) and `fetchDashboardListPage` passes this through to `buildOrderBy`.

## Minimal implementation
Implement Keystone-like fallback in target **only in**:
- `src/features/cms/graphql-client.ts`

### Change shape
Inside `buildOrderBy(list, sortBy?)`:
1. Keep current `sortBy` parsing (`-field` and legacy `field:asc|desc`).
2. If parsed explicit sort is valid + orderable, return it.
3. Else, resolve fallback sort candidate:
   - `list.initialSort` (if available on `DashboardList` type; validate field is orderable and direction `asc|desc`)
   - else preferred paths in order: `createdAt`, `updatedAt`, `timestamp`, `date`, `id`
   - else first `isOrderable` field
   - else `id asc`
4. Return `[ { [fieldPath]: direction } ]` for chosen fallback.

## Why this is the next best single fix
This is small, isolated, and directly addresses the listed parity area (**sortBy contract**) with no UI churn. It also improves deterministic pagination/list behavior across all lists when URL sort is missing or malformed.