# Code Context

## Files Retrieved
1. `src/routes/dashboard/$listKey.create.tsx` (lines 1-32) - defines a generic create route for every list and currently allows singleton lists through unless `hideCreate` is true.
2. `src/routes/dashboard/index.tsx` (lines 57-80) - dashboard home card links singleton lists with no item to `/dashboard/$listKey/create`.
3. `src/routes/dashboard/$listKey.$id.tsx` (lines 155-163) - singleton missing-item state also links to `/dashboard/$listKey/create`.
4. `src/features/cms/graphql-client.ts` (lines 216-233) - overview data already distinguishes singleton lists and discovers an existing singleton item id.
5. `src/components/dashboard/relationship-field-editor.tsx` (lines 113-122) - related-item CTA always links to `/dashboard/$listKey/create`, which is also incorrect for singleton related lists.
6. `src/components/dashboard/views/relationship-filter-input.tsx` (lines 74-88) - confirms recent relationship filter label hydration work is in place and not the next gap.
7. `../next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx` (lines 405-412) - reference implementation also links missing singleton state to `/create`, so this is not a place to copy from; Keystone semantics should drive the fix.

## Key Code
### Current singleton create route is broadly enabled
`src/routes/dashboard/$listKey.create.tsx:12-22`
```ts
export const Route = createFileRoute('/dashboard/$listKey/create')({
  loader: async ({ context, params }) => {
    ...
    if (!list) throw notFound()
    if (params.listKey !== list.path) throw redirect({ to: '/dashboard/$listKey/create', params: { listKey: list.path } })
    if (list.hideCreate) throw redirect({ to: '/dashboard/$listKey', params: { listKey: list.path } })
    return { list }
  },
})
```
There is no `list.isSingleton` guard, so singleton lists get a dedicated create page.

### Home page advertises singleton creation via `/create`
`src/routes/dashboard/index.tsx:62-76`
```tsx
{isSingleton ? (
  list.singletonItemId ? (
    <Link to="/dashboard/$listKey/$id" ...>
  ) : !list.hideCreate ? (
    <Link to="/dashboard/$listKey/create" params={{ listKey: list.path }}>
      ...
      <p className="mt-1 text-xs text-muted-foreground">Create singleton</p>
    </Link>
  ) : (
```

### Missing singleton item screen also sends users to `/create`
`src/routes/dashboard/$listKey.$id.tsx:157-163`
```tsx
if (missingItem && data.list.isSingleton && params.id === '1') {
  return (
    ...
    {!data.list.hideCreate ? <Button ... onClick={() => void navigate({ to: '/dashboard/$listKey/create', params: { listKey: data.list.path } })}>Create {data.list.singular}</Button> : null}
  )
}
```

### Overview logic already models singleton existence separately
`src/features/cms/graphql-client.ts:216-233`
```ts
const singletonLists = adminMeta.lists.filter((list) => list.isSingleton)
const singletonSelections = singletonLists.map((list) => `singleton_${list.key}: ${list.graphql.names.listQueryName}(take: 1) { id }`).join('\n')
...
singletonItemId: Array.isArray(singletonItems) ? singletonItems[0]?.id ?? null : null,
```
So the app already knows singleton lists are special and can route to `/dashboard/$listKey/1` style entry points instead of a generic create page.

## Architecture
- Admin meta exposes `isSingleton`, `hideCreate`, and `hideDelete` for each list.
- `fetchDashboardOverview()` already treats singleton lists specially by querying the list for an existing item id instead of a count.
- Despite that, UI routing still treats “no singleton item yet” as a normal create flow:
  - dashboard home card -> `/dashboard/$listKey/create`
  - missing singleton item page -> `/dashboard/$listKey/create`
  - generic create route accepts singleton lists
  - relationship editor create CTA would also target `/create` even if the related list is singleton
- Official Keystone singleton semantics are item-centric: singletons are addressed through the singleton item page, not a separate create page. The app already partially mirrors this with the `/dashboard/$listKey/$id` handling and special-casing id `1` when a singleton item is missing.

## Start Here
Open `src/routes/dashboard/$listKey.create.tsx` first. It is the enforcement point that should stop singleton create routes from existing at all, and it reveals the routing assumption the other UI entry points need to follow.

## Next single concrete fixable gap
**Gap:** singleton lists still expose and depend on a `/dashboard/$listKey/create` route, which conflicts with Keystone singleton semantics.

### Why this is the next fix
The recent parity fixes covered relationship option hydration, labels, paging, counts, filter operators, and `hideCreate`/`hideDelete`. The next concrete mismatch in the target app is not another relationship issue; it is singleton routing behavior. Right now the target still models singletons as creatable through a separate create page, while Keystone treats them as a single item page whose missing state can be created in-place or resolved through the singleton item route.

### Minimal implementation in target only
1. **Block singleton access to the generic create route** in `src/routes/dashboard/$listKey.create.tsx`.
   - After resolving `list`, if `list.isSingleton` is true, redirect to `/dashboard/$listKey/$id` with `id: '1'` instead of rendering the create page.
   - Keep the existing path-normalization and `hideCreate` checks, but singleton should never render the generic create form route.

2. **Update singleton entry points to use the singleton item route** instead of `/create`:
   - `src/routes/dashboard/index.tsx`
     - When `isSingleton && !list.singletonItemId && !list.hideCreate`, link to `/dashboard/$listKey/$id` with `id: '1'`.
     - UI copy can remain “Create singleton” if desired, but the route should be the singleton item page.
   - `src/routes/dashboard/$listKey.$id.tsx`
     - In the missing singleton state, change the button navigation target from `/dashboard/$listKey/create` to `/dashboard/$listKey/$id` with `id: '1'` only if that button is still needed; alternatively the button could trigger creation flow from that page if implemented there.
   - `src/components/dashboard/relationship-field-editor.tsx`
     - For `canCreateRelated`, if `relatedList?.isSingleton`, route to `/dashboard/$listKey/$id` with `id: '1'`; otherwise keep `/create`.

### Risk / follow-up note
If the singleton missing-item page only changes its link target and does not yet provide a creation action that persists the singleton, users could loop back onto the same page. So the real minimum viable parity fix is:
- remove/bypass `/create` for singletons, **and**
- ensure singleton creation is initiated from the singleton item page’s missing state.

That second part may require a small follow-up behavior change on `src/routes/dashboard/$listKey.$id.tsx`, but it stays entirely within the target app and aligns with official Keystone semantics.

## Why not recommend changes in `../next-keystone-starter`
The reference app shows the same singleton `/create` pattern in `../next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx:405-412`, so this is one of the cases where copying the reference would preserve the bug. The target should instead follow Keystone singleton semantics directly.