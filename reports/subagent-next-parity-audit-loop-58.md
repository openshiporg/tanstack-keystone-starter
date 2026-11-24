# Code Context

## Files Retrieved
1. `src/routes/dashboard/index.tsx` (lines 11-90) - target dashboard home route still hardcodes singleton card links to `/dashboard/$listKey/1`.
2. `src/features/cms/graphql-client.ts` (lines 26-28, 192-211) - target overview data shape only carries `count`, and overview fetching skips singleton counts without resolving a real singleton item id.
3. `src/features/cms/graphql-client.ts` (lines 431-485) - target item fetch still special-cases missing singleton item data when `id === '1'`, showing the `/1` assumption is still embedded.
4. `../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx` (lines 21-24, 35-40, 99-105, 137-144) - reference Next app also uses `/1`, but only as a starter simplification; target now already has richer singleton empty-state behavior and should stop generating fake item URLs.
5. `src/routes/dashboard/$listKey.tsx` (lines 20-38, 65-95) - target list page route already has the right overview/list-page query boundary, so singleton target resolution belongs in overview fetch, not list rendering.

## Key Code

### Target still generates fake singleton item URLs from the dashboard home page
`src/routes/dashboard/index.tsx:57-76`
```tsx
function ListCard({ list }: { list: ... }) {
  const isSingleton = list.isSingleton || false

  return (
    <Card ...>
      {isSingleton ? (
        <Link to="/dashboard/$listKey/$id" params={{ listKey: list.path, id: '1' }}>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground">{list.label}</h3>
            <p className="mt-1 text-xs text-muted-foreground">Singleton</p>
          </CardContent>
        </Link>
      ) : (
```
This is now the clearest remaining parity hole: the home card still assumes singleton item id is always `'1'`.

### Overview data has no place to carry a resolved singleton item id
`src/features/cms/graphql-client.ts:26-28`
```ts
export type DashboardListSummary = DashboardList & {
  count: number
}
```

`src/features/cms/graphql-client.ts:192-211`
```ts
const listsToCount = adminMeta.lists.filter((list) => !list.isSingleton)
const countSelections = listsToCount.map((list) => `count_${list.key}: ${list.graphql.names.listQueryCountName}`).join('\n')
const counts = listsToCount.length > 0
  ? await executeDashboardGraphQL<Record<string, number>>(`query DashboardListCounts {\n${countSelections}\n}`, undefined, options)
  : {}

return {
  authenticatedItem: authState.authenticatedItem,
  lists: adminMeta.lists.map((list) => ({ ...list, count: counts[`count_${list.key}`] ?? 0 })),
}
```
The overview fetch correctly skips singleton count queries, but it also does nothing to determine where singleton cards should actually navigate.

### Target item loading still tolerates the synthetic `/1` singleton route
`src/features/cms/graphql-client.ts:470-485`
```ts
if (!data.item && !(list.isSingleton && id === '1')) throw new Error(`Item not found: ${listPath}/${id}`)
```
This confirms the home-card `/1` link is not accidental UI-only behavior; fetch logic explicitly preserves it.

## Architecture
- Dashboard home cards are rendered by `src/routes/dashboard/index.tsx` from `fetchDashboardOverview()` data.
- `fetchDashboardOverview()` currently returns per-list metadata plus counts for non-singletons only.
- Singleton cards therefore lack any real item identifier and fall back to a hardcoded route param `'1'`.
- The item page fetcher then compensates for that fake route by allowing missing singleton item data when the requested id is `'1'`.
- Because the target already has singleton-specific missing-item UX on the item route, the smallest parity improvement is to stop generating fake singleton URLs at the source and carry a real `singletonItemId` in overview data.

## Start Here
Open `src/routes/dashboard/index.tsx` first. It contains the user-visible bug entry point: singleton dashboard cards still link to a synthetic `/1` route.

## Next single concrete fixable parity gap
**Gap:** dashboard home singleton cards still hardcode `/dashboard/$listKey/1` instead of linking to the real singleton item id.

This is the next clean fix because:
- the task’s listed singleton empty-state work is already present on the item route, but the dashboard entry point still emits fake singleton URLs;
- the overview fetch already has singleton/non-singleton branching, so this is a localized data+UI change;
- it removes a known semantic mismatch: singleton means “at most one item,” not “item id is 1.”

## Minimal implementation

### 1) Extend overview list summaries with a resolved singleton item id
In `src/features/cms/graphql-client.ts`:
- change `DashboardListSummary` to include:
```ts
singletonItemId?: string | null
```
- inside `fetchDashboardOverview()`:
  - keep the existing non-singleton count query;
  - add a second batched GraphQL query for singleton lists only, selecting one item id per list via unique aliases, e.g.
    - `singleton_Post: posts(take: 1) { id }`
  - map each singleton list to `singletonItemId: result?.[0]?.id ?? null`

Suggested shape:
```ts
const singletonLists = adminMeta.lists.filter((list) => list.isSingleton)
const singletonSelections = singletonLists
  .map((list) => `singleton_${list.key}: ${list.graphql.names.listQueryName}(take: 1) { id }`)
  .join('\n')
```
Then return:
```ts
lists: adminMeta.lists.map((list) => ({
  ...list,
  count: counts[`count_${list.key}`] ?? 0,
  singletonItemId: list.isSingleton ? singletonIds[`singleton_${list.key}`]?.[0]?.id ?? null : undefined,
}))
```

### 2) Use the resolved id in the dashboard home card
In `src/routes/dashboard/index.tsx`:
- replace the singleton branch:
```tsx
<Link to="/dashboard/$listKey/$id" params={{ listKey: list.path, id: '1' }}>
```
with logic that prefers the real id:
```tsx
const singletonHrefId = list.singletonItemId ?? '1'
```
and use `singletonHrefId` in params.

That keeps current fallback behavior intact while making the common path correct whenever a singleton item already exists.

### 3) Optional cleanup after the above lands
Once home cards stop generating fake singleton URLs, the `/1` compatibility special-case in `fetchDashboardItemPage()` can remain temporarily. Removing it should be a follow-up, not part of the minimal fix.

## Why this should be picked next
Most of the other items named in the task are already closed in the target. This one is still present in current code, easy to reproduce from the dashboard home screen, and fixable with a small, bounded change across only:
- `src/features/cms/graphql-client.ts`
- `src/routes/dashboard/index.tsx`
