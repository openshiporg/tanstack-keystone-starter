# Code Context

## Files Retrieved
1. `src/features/cms/admin-meta-query.ts` (lines 1-40) - target adminMeta query confirms the already-fixed parity items include `isHidden` and `hideNavigation` in the fetch.
2. `src/features/cms/graphql-client.ts` (lines 292-302) - target filter capability list includes inclusive timestamp operators `lte` and `gte`.
3. `src/features/cms/graphql-client.ts` (lines 188-198) - target filter serialization applies `equals`, `lt`, `lte`, `gt`, and `gte` to timestamp values.
4. `../next-keystone-starter/features/dashboard/actions/getAdminMetaAction.ts` (lines 16-45) - next app already fetches `isHidden` and `hideNavigation`, confirming that fix landed.
5. `../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx` (lines 100-103) - next app HomePage already filters lists with `hideNavigation ?? isHidden`.
6. `../next-keystone-starter/features/dashboard/components/Sidebar.tsx` (lines 58-59) - next app Sidebar already filters lists with `hideNavigation ?? isHidden`.
7. `../next-keystone-starter/features/dashboard/lib/buildWhereClause.ts` (lines 168-182) - next app timestamp filter mapping still lacks inclusive operators `gte` and `lte`, making this the next concrete parity gap.

## Key Code
Target supports inclusive timestamp filters:

```ts
// src/features/cms/graphql-client.ts:292-297
if (field.kind === 'timestamp') return ['equals', 'not', 'lt', 'lte', 'gt', 'gte', 'empty', 'not_empty']
```

```ts
// src/features/cms/graphql-client.ts:194-196
if (field.kind === 'decimal' || field.kind === 'bigInt' || field.kind === 'timestamp') {
  if (type === 'not') return { [field.path]: { not: { equals: String(value) } } }
  if (['equals', 'lt', 'lte', 'gt', 'gte'].includes(type)) return { [field.path]: { [type]: String(value) } }
}
```

Next app still exposes only non-inclusive timestamp comparisons:

```ts
// ../next-keystone-starter/features/dashboard/lib/buildWhereClause.ts:168-176
timestamp: {
  types: {
    equals: { label: 'Is exactly', initialValue: null },
    not: { label: 'Is not exactly', initialValue: null },
    lt: { label: 'Is before', initialValue: null },
    gt: { label: 'Is after', initialValue: null },
    empty: { label: 'Is empty', initialValue: null },
    not_empty: { label: 'Is not empty', initialValue: null },
  },
```

Already-fixed items verified in next:

```ts
// ../next-keystone-starter/features/dashboard/actions/getAdminMetaAction.ts:37-40
isHidden
hideNavigation
hideCreate
hideDelete
```

```ts
// ../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx:100-103
const adminMeta = adminMetaResponse.data
const lists = adminMeta?.lists || []
const enhancedLists = lists.filter((list: any) => !(list.hideNavigation ?? list.isHidden))
```

```ts
// ../next-keystone-starter/features/dashboard/components/Sidebar.tsx:58-59
const lists = adminMeta?.lists || {}
const listsArray = Object.values(lists).filter((list: any) => !(list.hideNavigation ?? list.isHidden))
```

## Architecture
- In the target app, list filter capabilities are defined centrally in `src/features/cms/graphql-client.ts`.
- In the next app, equivalent server-side filter behavior is centralized in `features/dashboard/lib/buildWhereClause.ts` via `FIELD_FILTER_MAPPINGS`.
- HomePage and Sidebar both consume admin meta that already includes `hideNavigation`, so the navigation parity fixes are present.
- The remaining mismatch is specifically in the next app's timestamp filter definition: the UI/server mapping does not advertise `gte` and `lte`, so users cannot build inclusive timestamp filters even though target parity expects them.

## Start Here
Open `../next-keystone-starter/features/dashboard/lib/buildWhereClause.ts` first. It is the single minimal change point for the next parity gap.

## Next single concrete fixable parity gap
**Gap:** next-keystone-starter timestamp filters are still missing inclusive operators `gte` and `lte`.

**Exact file to change:**
- `../next-keystone-starter/features/dashboard/lib/buildWhereClause.ts`

**Minimal implementation:**
- In `FIELD_FILTER_MAPPINGS.timestamp.types`, add:
  - `gte: { label: 'Is after or equal to', initialValue: null }`
  - `lte: { label: 'Is before or equal to', initialValue: null }`
- No serializer rewrite is needed, because the existing `graphql` mapper already forwards arbitrary comparison types via:
  - `return { [fieldPath]: { [type]: value } }`

**Why this is the next fix:**
- The listed parity items in your prompt are already present in next.
- This timestamp mismatch is a concrete remaining delta against target behavior and can be fixed in one file with a minimal edit.