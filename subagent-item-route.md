Implemented `/$listKey/$id` read-only dashboard item route and validated lint.

## What was added

1. **New route file**: `src/routes/dashboard/$listKey.$id.tsx`
   - Registers route: `createFileRoute('/dashboard/$listKey/$id')`
   - Loader fetches item data via query client and throws `notFound()` for missing list/item.
   - Renders:
     - Breadcrumbs: `Dashboard -> {List} -> {Item title}`
     - Header/title
     - ID panel (code-styled)
     - Read-only fields card
   - Field renderer supports existing metadata-driven kinds:
     - `checkbox` => Yes/No badge
     - `multiselect` => comma list
     - `relationship` => label/name/id fallback (single or array)
     - `password` => Set/Not set badge
     - object/json/document => `<pre>` JSON
     - null/empty => em dash

2. **GraphQL client extensions**: `src/features/cms/graphql-client.ts`
   - Added `DashboardItemPageData` type.
   - Added `dashboardQueryKeys.itemPage(listPath, id)`.
   - Added `selectedItemFields(list)` helper (respects `itemView.fieldMode !== 'hidden'`, includes `id`).
   - Added `fetchDashboardItemPage({ listPath, id })`:
     - resolves list from adminMeta
     - builds field selection with existing `graphQLSelectionForField(...)`
     - queries item via `list.graphql.names.itemQueryName` + `whereUniqueInputName`
     - throws clear errors for missing list/item
     - derives page title from `labelField` fallback to `id`

## Why this fixes 404s
- `View` links already targeted `/dashboard/$listKey/$id`.
- That path had no route file; now it does, so router can resolve and render item details.

## Validation
- Ran: `npm run lint`
- Result: ✅ passes

## Progress updated
- Updated `/Users/junaid/code/tanstack-keystone-starter/progress.md` with this item-route work and files changed.
