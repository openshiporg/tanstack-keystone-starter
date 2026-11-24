# Code Context

## Files Retrieved
1. `src/features/cms/graphql-client.ts` (lines 120-219, 261-415) - target dashboard data normalization, overview loading, selected column fallback, and current `buildWhere` filter/search implementation.
2. `src/components/dashboard/filter-bar.tsx` (lines 1-220, 321-417) - target filter UI derives available filters from controller metadata and serializes URL filter state.
3. `src/components/dashboard/enhance-fields.tsx` (lines 1-72) - target uses field view controllers to power filter UI, so controller parity directly affects available filters.
4. `src/components/dashboard/views/registry.tsx` (lines 1-220) - target local controller registry currently defines simplified filter types instead of Keystone’s exact filter maps.
5. `src/routes/dashboard/$listKey.tsx` (lines 1-97) - target list route passes URL search state through to `fetchDashboardListPage`, so filter compatibility is controlled centrally by `graphql-client.ts` and controller metadata.
6. `../next-keystone-starter/features/dashboard/lib/buildWhereClause.ts` (lines 1-260, 261-389) - reference implementation for exact server-side filter mappings, including text/select/id/relationship semantics.
7. `../next-keystone-starter/features/dashboard/views/text/index.tsx` (lines 300-379) - reference text filter map includes `contains_i`, `not_contains_i`, `is_i`, `not_i`, `starts_with_i`, `not_starts_with_i`, `ends_with_i`, `not_ends_with_i`.
8. `../next-keystone-starter/features/dashboard/views/select/index.tsx` (lines 24-64) - reference select filter map uses `matches` / `not_matches` rather than generic string filters.

## Key Code

### Target currently exposes simplified filters, not Keystone’s exact ones
In `src/components/dashboard/views/registry.tsx` the target hardcodes generic filter types:
- text/select/decimal/bigInt/timestamp/id => `contains`, `equals`, `not`, `is_empty`, `not_empty`
- integer/float => `equals`, `not`, `lt`, `lte`, `gt`, `gte`
- relationship => custom simplified one-off types

This means the filter UI and URL keys are generated from this reduced map, not from Keystone’s exact controller contracts.

### Reference expects exact filter keys
`../next-keystone-starter/features/dashboard/views/text/index.tsx` defines the text controller filter types:
- `contains_i`
- `not_contains_i`
- `is_i`
- `not_i`
- `starts_with_i`
- `not_starts_with_i`
- `ends_with_i`
- `not_ends_with_i`

`../next-keystone-starter/features/dashboard/views/select/index.tsx` defines select filter types:
- `matches`
- `not_matches`

`../next-keystone-starter/features/dashboard/lib/buildWhereClause.ts` mirrors those exact keys server-side and converts them to GraphQL filters, including `mode: 'insensitive'` for text where appropriate.

### Target server filter builder also uses simplified semantics
In `src/features/cms/graphql-client.ts`:
- `filterTypesForField()` returns simplified generic types.
- `filterWhereForField()` handles only generic operations like `contains`, `equals`, `not`.
- `buildWhere()` builds the accepted URL filter map from those simplified types.

So even if UI were updated, the backend list loader would still reject Keystone-style filter keys.

## Architecture
- The list page route (`src/routes/dashboard/$listKey.tsx`) accepts arbitrary URL search params and forwards them to `fetchDashboardListPage(..., filters: search)`.
- `fetchDashboardListPage()` in `src/features/cms/graphql-client.ts` calls `buildWhere(list, search, filters)` to convert URL state into GraphQL `where`.
- The filter bar (`src/components/dashboard/filter-bar.tsx`) renders available filters by reading `controller.filter.types` from enhanced field controllers.
- Those controllers are built in `src/components/dashboard/enhance-fields.tsx` from `src/components/dashboard/views/registry.tsx`.

So parity requires both sides to align:
1. controller metadata must expose Keystone’s exact filter types;
2. `buildWhere()` must understand the exact same URL keys.

## Start Here
Open `src/components/dashboard/views/registry.tsx` first. That file is the source of truth for which filter types the UI exposes today, and it is clearly behind the reference implementation.

## Next single concrete fixable parity gap
**Gap:** the target dashboard still does **not** implement Keystone’s exact filter maps. It uses simplified generic filters, so filter URLs and available filter operations differ from `next-keystone-starter`.

### Why this is the next gap
All items listed in the task description appear already addressed in target code:
- adminMeta hideCreate/hideDelete evaluated per request context
- dashboard singleton cards use real singleton id/create fallback
- overview skips singleton counts
- relationship options use `buildWhere`
- singleton missing empty-state exists
- bulk delete invalidation exists
- default columns fallback exists
- URL-only list state exists
- no row click is preserved

The remaining visible parity mismatch from this audit is filter-map exactness.

### Minimal implementation
1. **Update controller filter metadata in `src/components/dashboard/views/registry.tsx`** to match Keystone/next-keystone-starter exact filter type names per field kind.
   - Text should expose the `_i` variants and start/end-with variants.
   - ID should expose `is`, `not`, `gt`, `lt`, `gte`, `lte`, `in`, `not_in`.
   - Select should expose `matches` / `not_matches`.
   - Numeric/date-ish fields should include empty/not_empty where Keystone does.
   - Relationship can keep the already-added parity-friendly keys if they already match reference.

2. **Update server parsing in `src/features/cms/graphql-client.ts`** so `filterTypesForField()` and `filterWhereForField()` accept the same exact keys and translate them like the reference `buildWhereClause.ts`.
   - Text: map `contains_i`, `not_contains_i`, `is_i`, `not_i`, `starts_with_i`, `not_starts_with_i`, `ends_with_i`, `not_ends_with_i` to GraphQL with `mode: 'insensitive'` when appropriate.
   - ID: map `is` => `equals`, `not_in` => `notIn`, comma-split `in`/`not_in` values.
   - Select: map `matches` / `not_matches` to `in` / `notIn`.
   - Numeric/timestamp/decimal/bigInt: add `empty` / `not_empty` handling where reference supports it.

### Exact files likely to change
- `src/components/dashboard/views/registry.tsx`
- `src/features/cms/graphql-client.ts`

### Risk / constraint
Because `filter-bar.tsx` reads `controller.filter.types` dynamically, changing the controller maps should automatically update the UI. But the server-side `buildWhere()` must be updated in the same change or the new URL keys will produce no filtering.