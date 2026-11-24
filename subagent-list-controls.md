Implemented interactive list controls on `/dashboard/$listKey` with URL-backed state.

## What was changed

1. Enabled Filter/Sort/Display controls UI interactions:
- `src/components/dashboard/filter-bar.tsx`
  - Search input remains URL-backed (`search`) and updates page to 1.
  - Sort panel toggles open and writes `sortBy` query param (`fieldPath:asc|desc`).
  - Display panel toggles open and writes `fields` query param (comma-separated field paths).
  - `id` is always preserved in visible columns.
  - Filter button is enabled (no longer disabled), though advanced filter-builder behavior is still a follow-up.

2. Wired list route search params for control state:
- `src/routes/dashboard/$listKey.tsx`
  - `validateSearch` now accepts `sortBy` and `fields`.
  - Loader and client query both pass `sortBy` and `fields` to data fetch.
  - Query keys include `sortBy` and `fields` for proper cache isolation.

3. Extended dashboard GraphQL client list fetch behavior:
- `src/features/cms/graphql-client.ts`
  - `dashboardQueryKeys.listPage(...)` now includes `sortBy` and `fields`.
  - `selectedListFields(list, fieldsParam)` uses URL `fields` when provided.
  - `buildOrderBy(list, sortBy)` validates field + direction and returns GraphQL `orderBy`.
  - `fetchDashboardListPage(...)` now accepts and applies `sortBy` and `fields`.

4. Progress tracking updated:
- `progress.md` updated with this work and validation notes.

## Validation
- Ran: `npm run lint`
- Result: ✅ pass

## Current behavior now
- Search: interactive and URL-driven.
- Sort: interactive basic single-field asc/desc and URL-driven.
- Display: interactive field visibility selection and URL-driven.
- Filter: button enabled/interactable, but advanced filter grammar/popover parity is still pending.
