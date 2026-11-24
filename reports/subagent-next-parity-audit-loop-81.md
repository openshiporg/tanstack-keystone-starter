# Code Context

## Files Retrieved
1. `../next-keystone-starter/features/dashboard/actions/getAdminMetaAction.ts` (lines 1-120, 121-171) - next app admin meta query shape and returned list metadata.
2. `../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx` (lines 1-159) - next app dashboard overview filtering/rendering logic.
3. `../next-keystone-starter/features/dashboard/actions/getListCounts.ts` (lines 1-59) - confirms singleton `take: 1` overview fetch is already implemented.
4. `../next-keystone-starter/features/dashboard/types/index.ts` (lines 100-154) - next app list meta type includes `hideNavigation`.
5. `src/features/cms/admin-meta-query.ts` (lines 1-52) - target admin meta query includes `hideNavigation`.
6. `src/features/cms/graphql-client.ts` (lines 1-340, especially 109-144 and 200-233) - target normalizes admin meta and overview data.
7. `src/routes/dashboard/index.tsx` (lines 1-117, especially 18-30 and 54-94) - target overview hides lists via `hideNavigation`, not `isHidden`.

## Key Code

### Current next-keystone-starter behavior
`../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx`
```ts
const adminMeta = adminMetaResponse.data
const lists = adminMeta?.lists || []
// Lists are already enhanced with gqlNames from getAdminMetaAction
const enhancedLists = lists.filter((list: any) => !list.isHidden)
```

This means the overview page still uses `isHidden` to decide visibility.

### Returned metadata already supports the canonical flag
`../next-keystone-starter/features/dashboard/actions/getAdminMetaAction.ts`
```ts
lists {
  ...
  isHidden
  hideNavigation
  hideCreate
  hideDelete
}
```

### Next type already expects `hideNavigation`
`../next-keystone-starter/features/dashboard/types/index.ts`
```ts
export type ListMeta = {
  ...
  hideNavigation: boolean
  hideCreate: boolean
  hideDelete: boolean
}
```

### Target behavior
`src/routes/dashboard/index.tsx`
```ts
const lists = data.lists.filter((list) => !list.hideNavigation)
```

and target overview data comes from `src/features/cms/graphql-client.ts`, which preserves `hideNavigation` from admin meta.

## Architecture
- Both apps fetch list-level admin metadata first.
- The overview page then filters lists before rendering cards.
- In target, the canonical visibility control for dashboard navigation is `hideNavigation`.
- In next-keystone-starter, the admin meta query already exposes `hideNavigation`, but `HomePage` still filters on `isHidden`, which is a different concept.
- Result: any list with `hideNavigation: true` and `isHidden: false` will still appear on the next app dashboard, diverging from target.

## Start Here
Open `../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx` first. It contains the stale overview visibility filter and is the minimal place to restore parity.

## Next single concrete fixable parity gap
**Gap:** Dashboard overview visibility still uses `isHidden` instead of canonical `hideNavigation` in `next-keystone-starter`.

### Why this is the next fix
The user-noted areas around singleton overview counts, singleton create card behavior, admin meta view/action metadata, relationship metadata, required metadata, and inclusive timestamp filters are already present. The next clearly fixable mismatch in the same overview path is the visibility flag mismatch.

### Exact files
- `../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx`
- Optional type-safety follow-up only if needed elsewhere: search for any other overview/list filtering using `isHidden`.

### Minimal implementation
In `../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx`, change:
```ts
const enhancedLists = lists.filter((list: any) => !list.isHidden)
```

to:
```ts
const enhancedLists = lists.filter((list: any) => !list.hideNavigation)
```

If backward compatibility is desired while other callers still emit `isHidden`, the minimal safe variant is:
```ts
const enhancedLists = lists.filter((list: any) => !(list.hideNavigation ?? list.isHidden))
```

### Expected parity result
The next app dashboard will hide the same lists as the target dashboard overview, matching canonical admin metadata semantics.