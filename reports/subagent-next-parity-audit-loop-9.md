# Ninth-loop parity audit (post-fixes): next single concrete gap

## Next fixable parity gap
**Gap:** List sorting query contract is still non-parity: target encodes sort as `field:asc|desc`, while `next-keystone-starter` uses Keystone-style `field` / `-field` URL semantics.

This is a concrete, isolated mismatch that remains after the listed fixes (sidebar wrapper, signup gate/auth union, signin/reset/layout, pagination page-size dropdown, no-access, destructive dialogs, filtered-empty reset).

---

## Evidence (reference vs target)

1. **Target route validates/persists `sortBy` as arbitrary string and table writes colon format**
   - `src/routes/dashboard/$listKey.tsx` (validateSearch + query key wiring)
   - `src/components/dashboard/keystone-list-table.tsx` (`TableHeaderField`):
   ```ts
   const [sortField, sortDirection] = sortBy.split(':')
   const nextDirection = isActive && sortDirection === 'asc' ? 'desc' : 'asc'
   navigate({ search: (previous) => ({ ...previous, sortBy: `${field.path}:${nextDirection}`, page: 1 }) })
   ```

2. **Reference uses `sortBy` as `field` or `-field` (no colon payload)**
   - `../next-keystone-starter/features/dashboard/components/ListTable.tsx`:
   ```ts
   const currentSort = query.sortBy;
   const newSort = currentSort === fieldKey ? `-${fieldKey}` : fieldKey;
   newSearchParams.set('sortBy', newSort);
   ```

3. **Reference list-page sorting pipeline is built around Keystone orderBy parsing helpers from this URL contract**
   - `../next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx` (uses `buildOrderByClause(list, currentSearchParams)` with `sortBy` read directly from URL)

---

## Minimal implementation to close parity gap

### Files to change
1. `src/components/dashboard/keystone-list-table.tsx`
2. `src/features/cms/graphql-client.ts` (or the exact helper used by `fetchDashboardListPage` to convert `sortBy` into GraphQL `orderBy`)
3. `src/routes/dashboard/$listKey.tsx` (optional normalization guard)

### Concrete minimal changes

1. **Switch UI sort encoding to Next/Keystone style** in `keystone-list-table.tsx`:
   - Read active field via:
     - descending: `sortBy.startsWith('-')`
     - active field: `sortBy.replace(/^-/, '')`
   - On click, write:
     - ascending: `sortBy = field.path`
     - descending toggle: `sortBy = '-' + field.path`
   - Keep `page: 1` reset behavior.

2. **Update sort parsing in list fetch/orderBy builder** (`graphql-client.ts` path where `sortBy` becomes `orderBy`):
   - Parse `-field` => `{ field: 'desc' }`
   - Parse `field` => `{ field: 'asc' }`
   - Maintain backward compatibility temporarily (accept legacy `field:asc|desc`) if desired, but emit only parity format from UI.

3. **(Optional hardening)** in `$listKey.tsx` search normalization:
   - If incoming `sortBy` is colon format, normalize to parity format when navigating or in fetch-deps normalization.

---

## Why this is the next best single gap
- User-visible and URL-contract level parity issue in a core list interaction.
- Small blast radius (table header + sort parser), no schema/auth/refactor required.
- Improves compatibility with Keystone/Next mental model and avoids drift in shared deep links/tests.