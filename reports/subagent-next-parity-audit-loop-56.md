# Code Context

## Files Retrieved
1. `src/routes/dashboard/index.tsx` (lines 1-101) - target dashboard home cards hardcode singleton navigation to `/dashboard/$listKey/1`.
2. `src/features/cms/graphql-client.ts` (lines 192-211) - target overview loader already skips singleton count queries, so home cards do not need item-count data and can support singleton-specific lookup separately.
3. `src/features/cms/graphql-client.ts` (lines 440-485, especially 470) - target item-page fetcher explicitly special-cases singleton id `'1'`, confirming the hardcoded route assumption is baked into dashboard navigation semantics.
4. `src/routes/dashboard/$listKey.$id.tsx` (lines 139-170) - target item route treats `/dashboard/$listKey/1` as a synthetic singleton entry and falls back to a create CTA when the real item is missing.
5. `../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx` (lines 21-45) - reference app makes the same hardcoded `/1` assumption, so this is a shared gap where official Keystone semantics should win over reference parity.
6. `reports/subagent-next-parity-audit-latest.md` (lines 262-273) - prior ledger already flagged singleton home-card routing assumptions as brittle.

## Key Code

### Target currently hardcodes singleton dashboard links to id `1`
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
This means every singleton card navigates to a synthetic item id instead of the actual stored item id.

### The item fetcher preserves that synthetic-id assumption
`src/features/cms/graphql-client.ts:440-470`
```ts
  const data = await executeDashboardGraphQL(...,
    { where: { id }, id, listKey: list.key },
    options,
  )

  if (!data.item && !(list.isSingleton && id === '1')) throw new Error(`Item not found: ${listPath}/${id}`)
```
For normal lists, a missing item throws. For singleton routes with id `1`, the fetcher suppresses the error even though no real item with id `1` may exist.

### The item page then renders a singleton-specific missing-item fallback
`src/routes/dashboard/$listKey.$id.tsx:157-165`
```tsx
  if (missingItem && data.list.isSingleton && params.id === '1') {
    return (
      <main ...>
        <div ...>
          <p ...>"{data.list.label}" doesn&apos;t exist, or you don&apos;t have access to it.</p>
          {!data.list.hideCreate ? <Button ...>Create {data.list.singular}</Button> : null}
        </div>
      </main>
    )
  }
```
So the target UX is: dashboard singleton card -> fake `/1` route -> maybe real item if id actually is `1`, otherwise special fallback screen.

### Reference app shows the same behavior
`../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx:21-24`
```tsx
function ListCard({ list, count, hideCreate = false }: ListCardProps) {
  const isSingleton = list.isSingleton || false
  const href = `/dashboard/${list.path}${isSingleton ? '/1' : ''}`
```
This is useful only as comparison context; per the task, the fix should be targeted in this repo only.

## Architecture
- Dashboard home data comes from `fetchDashboardOverview()` in `src/features/cms/graphql-client.ts`.
- `src/routes/dashboard/index.tsx` renders one card per visible list using that overview payload.
- For singleton lists, the card does not resolve an actual item id from data; it hardcodes `'1'` into the route params.
- `src/routes/dashboard/$listKey.$id.tsx` and `fetchDashboardItemPage()` are coupled to that assumption by allowing missing singleton item data when the route id is `'1'`.
- This diverges from Keystone semantics because singleton-ness constrains cardinality, not database id. A singleton item can have any generated id.

## Start Here
Open `src/routes/dashboard/index.tsx` first.

That file contains the user-visible bug entry point: dashboard home navigation for singleton lists is wired to a fake id. From there, the supporting assumption is easy to trace into `src/features/cms/graphql-client.ts` and `src/routes/dashboard/$listKey.$id.tsx`.

## Next single concrete fixable gap
**Target dashboard home singleton cards should resolve the real singleton item id instead of hardcoding `/dashboard/$listKey/1`.**

This is the next concrete fix because:
- the previous loop’s singleton create-CTA issue is already correct in target and should be skipped
- this gap is target-local and user-visible
- it is semantically wrong even if the reference app shares it
- the current target already has a dedicated overview fetch point where singleton target ids can be added with minimal surface area

## Minimal implementation
Target only; do **not** edit `../next-keystone-starter`.

### 1) Extend overview data with an optional singleton target id
File:
- `src/features/cms/graphql-client.ts`

Minimal shape:
- add `singletonItemId?: string | null` to `DashboardListSummary`
- in `fetchDashboardOverview()`, besides count queries for non-singletons, also query each singleton list for one item id, e.g. `take: 1 { id }`
- map each singleton list to `singletonItemId: firstItem?.id ?? null`

Because `fetchDashboardOverview()` is already the single dashboard-home aggregation point, this keeps the change localized and avoids per-card client fetches.

### 2) Use that resolved id when rendering singleton cards
File:
- `src/routes/dashboard/index.tsx`

Replace the hardcoded route params:
```tsx
params={{ listKey: list.path, id: '1' }}
```
with the resolved singleton id when present.

Safe minimal behavior:
- if `list.singletonItemId` exists, link to `/dashboard/$listKey/$id` using that real id
- if it does not exist yet and create is allowed, link to `/dashboard/$listKey/create`
- if it does not exist and create is hidden, render a non-link card or disabled state instead of a broken fake item route

## Why this is the right fix
- It matches official Keystone semantics better than the current synthetic-id workaround.
- It removes reliance on a database id value Keystone does not guarantee.
- It improves target behavior without requiring a broad item-route rewrite.
- The existing `/1` fallback path in `src/routes/dashboard/$listKey.$id.tsx` can remain temporarily for backward compatibility, but the dashboard entry point should stop generating fake singleton item URLs.

## Risks / constraints
- Overview query generation needs unique GraphQL aliases for singleton lookups, similar to the existing count alias pattern.
- Avoid counting singleton lists just to find the item; fetch only `take: 1 { id }`.
- If a list is singleton but inaccessible due to access control, `singletonItemId` may be null; the UI should not navigate to a broken item route in that case.
- This report intentionally does not recommend changing the reference app, even though it shares the same bug.