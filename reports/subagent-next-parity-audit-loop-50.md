# Next Parity Audit Loop 50

## Next single concrete parity gap

**`initialFilter` is still not applied on Next list pages, while the target already applies it to every list query.**

This is the next clean, fixable parity gap because:
- it is explicitly in your verified target-fix checklist,
- it still differs between `next-keystone-starter` and the target,
- the fix is small and localized,
- it affects both SSR and client refetches on every filtered/unfiltered list page.

## Evidence

### Target already applies `initialFilter`
In the target, list-page querying goes through `buildWhere(...)`, which prepends `list.initialFilter` before search/filter conditions:

- `src/features/cms/graphql-client.ts:283-307`
  - `if (isNonEmptyWhereObject(list.initialFilter)) conditions.push(list.initialFilter)`
  - then search and URL filters are added
  - final result returns `undefined`, a single condition, or `{ AND: conditions }`

This means the target always scopes list results by the configured initial filter.

### Next app does not apply `initialFilter`
In Next, both server and client list-page builders compose `where` from only search + URL filters:

- `../next-keystone-starter/features/dashboard/screens/ListPage/index.tsx:43-58`
  - builds `filterWhere = buildWhereClause(list, searchParamsObj)`
  - builds `searchWhere = buildWhereClause(list, searchParameters)`
  - combines only those into `where`

- `../next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx:95-116`
  - same logic for client/react-query refetch path
  - combines only `searchWhere` and `filterWhere`

And the shared filter builder itself never injects `list.initialFilter`:

- `../next-keystone-starter/features/dashboard/lib/buildWhereClause.ts:294-337`
  - starts with `const whereConditions: any[] = []`
  - handles `search`
  - handles parsed `!field_filterType` URL filters
  - returns combined conditions
  - **no use of `list.initialFilter` anywhere**

The Next type metadata does include the property, so this is not a data-shape problem:

- `../next-keystone-starter/features/dashboard/types/index.ts:133-139`
  - `initialFilter: JSONValue`

## Why this is the right next fix

Without this, any list configured with `initialFilter` behaves differently in Next than in the target:
- SSR list render ignores the configured default scoping
- client refetches also ignore it
- pagination/counts/sorting operate on the wrong dataset
- search and explicit filters can surface rows that should have been hidden by the base list constraint

Because both server and client rely on the same `buildWhereClause`, fixing that helper should align both code paths at once.

## Minimal implementation

### Primary file to change
- `../next-keystone-starter/features/dashboard/lib/buildWhereClause.ts`

### Minimal code change
Add target-equivalent handling near the start of `buildWhereClause(...)`:

1. Add a small helper like target’s `isNonEmptyWhereObject(...)`
2. At the beginning of `buildWhereClause`, before search/filter parsing, push `list.initialFilter` into `whereConditions` when it is a non-empty object

Conceptually:
- if `list.initialFilter` is a non-array object with keys, include it as the first base condition
- keep existing search and URL filter logic unchanged
- preserve current return behavior:
  - `{}` when no conditions
  - single condition directly when one exists
  - `{ AND: whereConditions }` when multiple exist

## Exact likely patch shape

In `../next-keystone-starter/features/dashboard/lib/buildWhereClause.ts`:
- add helper near the bottom/top:
  - `function isNonEmptyWhereObject(value: unknown): value is Record<string, any> { ... }`
- inside `buildWhereClause(...)`, right after `const whereConditions: any[] = []`, add:
  - `if (isNonEmptyWhereObject(list.initialFilter)) whereConditions.push(list.initialFilter)`

## Why this single-file fix is enough

These files already call `buildWhereClause(...)` for both server and client list queries:
- `../next-keystone-starter/features/dashboard/screens/ListPage/index.tsx:43-58`
- `../next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx:95-116`

So once `buildWhereClause(...)` includes `initialFilter`, both render paths gain parity automatically.

## No-edit recommendation summary

**Next fix:** apply `list.initialFilter` in `../next-keystone-starter/features/dashboard/lib/buildWhereClause.ts` so Next list queries match the target’s base-scoping behavior.