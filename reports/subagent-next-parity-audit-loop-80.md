# Code Context

## Files Retrieved
1. `../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx` (lines 19-37, 70-118, 141-145) - Next dashboard home cards always route singleton lists to `/dashboard/<path>/1` and always render singleton copy without checking whether the singleton item exists.
2. `../next-keystone-starter/features/dashboard/actions/getListCounts.ts` (lines 1-48) - Next overview data fetch only counts non-singleton lists and returns `{}` for singleton lists, so HomePage cannot distinguish existing-vs-missing singleton items.
3. `src/features/cms/graphql-client.ts` (lines 218-236) - target overview fetch already performs the missing singleton existence lookup by querying `take: 1` for singleton lists and attaching `singletonItemId`.
4. `src/routes/dashboard/index.tsx` (lines 58-80) - target home cards use `singletonItemId` plus `hideCreate` to render either a normal singleton link, a "Create singleton" link, or a non-link card.
5. `src/routes/dashboard/$listKey.$id.tsx` (lines 157-167, 258-271) - target item route is explicitly keyed on the canonical singleton URL `/1` and supports in-place singleton creation there, so overview cards can safely link into that state.
6. `src/routes/dashboard/$listKey.create.tsx` (lines 19-22) - target create route redirects singleton lists away from generic `/create`, reinforcing that singleton overview links should target the singleton item page rather than a normal create screen.

## Key Code
Next HomePage hardcodes singleton destination/copy and has no existence signal:

`../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx:19-37`
```ts
function ListCard({ list, count, hideCreate = false }: ListCardProps) {
  const isSingleton = list.isSingleton || false
  const href = `/dashboard/${list.path}${isSingleton ? '/1' : ''}`
...
          <p className="mt-1 text-xs text-muted-foreground">
            {isSingleton 
              ? 'Singleton' 
              : count === null || count === undefined
                ? 'Unknown'
                : `${count} item${count !== 1 ? 's' : ''}`
            }
          </p>
```

Next count action skips singleton lists entirely:

`../next-keystone-starter/features/dashboard/actions/getListCounts.ts:18-29`
```ts
const listsToCount = lists.filter((list) => !list.isSingleton)

if (listsToCount.length === 0) return { success: true, data: {} }

const countQueries = listsToCount.map((list) => {
  const countName = list.graphql?.names?.listQueryCountName
  return `${list.key}: ${countName}`
})
```

Target overview already has the missing singleton existence behavior:

`src/features/cms/graphql-client.ts:218-236`
```ts
const listsToCount = adminMeta.lists.filter((list) => !list.isSingleton)
const singletonLists = adminMeta.lists.filter((list) => list.isSingleton)
const countSelections = listsToCount.map((list) => `count_${list.key}: ${list.graphql.names.listQueryCountName}`).join('\n')
const singletonSelections = singletonLists.map((list) => `singleton_${list.key}: ${list.graphql.names.listQueryName}(take: 1) { id }`).join('\n')
...
return {
  ...
  lists: adminMeta.lists.map((list) => {
    const singletonItems = overviewData[`singleton_${list.key}`]
    return {
      ...list,
      count: typeof overviewData[`count_${list.key}`] === 'number' ? overviewData[`count_${list.key}`] : 0,
      singletonItemId: Array.isArray(singletonItems) ? singletonItems[0]?.id ?? null : null,
    }
  }),
}
```

Target home cards consume that overview state:

`src/routes/dashboard/index.tsx:62-76`
```ts
{isSingleton ? (
  list.singletonItemId ? (
    <Link to="/dashboard/$listKey/$id" params={{ listKey: list.path, id: '1' }}>
...
  ) : !list.hideCreate ? (
    <Link to="/dashboard/$listKey/$id" params={{ listKey: list.path, id: '1' }}>
      ...
      <p className="mt-1 text-xs text-muted-foreground">Create singleton</p>
```

## Architecture
In Next, dashboard overview is split across:
- `getAdminMetaAction()` for list metadata
- `getListCounts()` for list-level aggregate counts
- `HomePage` for card rendering

That second step only returns counts for non-singletons. As a result, `HomePage` cannot tell whether a singleton record already exists, so it always renders singleton cards as if they are ordinary existing singleton entries.

In target, the equivalent overview path was upgraded to a combined query:
- count non-singletons
- fetch `take: 1 { id }` for singleton lists
- attach `singletonItemId`
- let the home screen render correct singleton UX based on existence and `hideCreate`

So after the previously fixed metadata/required/filter/label work, the next remaining concrete parity gap is now singleton overview state in Next.

## Start Here
Open `../next-keystone-starter/features/dashboard/actions/getListCounts.ts` first. It is the narrowest upstream source of the remaining drift: HomePage cannot reach parity until overview data includes singleton existence information.

## Recommended next single parity fix
**Gap:** `next-keystone-starter` dashboard overview does not fetch singleton existence state, so singleton home cards cannot distinguish between an existing singleton and a missing singleton that should show "Create singleton" behavior.

### Why this is the next fix
- The previously reported admin meta/query/type gaps appear resolved in Next.
- Target already has canonical singleton routing and existence-aware overview cards.
- This remaining gap is isolated to the overview data flow and card rendering.
- It is additive and low-risk: no mutation semantics need to change.

## Minimal implementation
1. **Edit** `../next-keystone-starter/features/dashboard/actions/getListCounts.ts`
   - Expand the query builder so it does not only count non-singletons.
   - Keep current count selections for non-singletons.
   - Add singleton selections like:
   ```ts
   singleton_<listKey>: <listQueryName>(take: 1) { id }
   ```
   - This likely requires widening the input type to accept `graphql.names.listQueryName` in addition to `listQueryCountName`.

2. **Edit** `../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx`
   - Read the singleton existence result from `getListCounts()` output (for example as `singletonItemId` or a parallel lookup map).
   - Update `ListCard` so singleton cards mirror target behavior:
     - if singleton exists: link to `/dashboard/${list.path}/1`, show `Singleton`
     - if singleton is missing and `!hideCreate`: link to `/dashboard/${list.path}/1`, show `Create singleton`
     - if singleton is missing and `hideCreate`: render a non-link card with `Singleton`

### Exact files likely needing changes
- `../next-keystone-starter/features/dashboard/actions/getListCounts.ts`
- `../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx`

## Risks / constraints
- Keep the canonical singleton destination `/1`; target and current Next item pages already assume that route shape.
- The returned shape from `getListCounts()` is currently `Record<string, number>`; adding singleton ids may require either:
  - a second result map, or
  - a small shape change consumed only by `HomePage`.
- Avoid regressing non-singleton counts; this should remain one combined GraphQL request, not N additional calls.
