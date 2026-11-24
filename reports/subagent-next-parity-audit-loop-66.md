# Code Context

## Files Retrieved
1. `src/routes/dashboard/$listKey.$id.tsx` (lines 1-223) - singleton item route still treats `/1` as a magic placeholder and shows the create/missing singleton state only for that fake id.
2. `src/features/cms/graphql-client.ts` (lines 208-224) - dashboard overview already resolves real singleton ids via `singletonItemId`.
3. `src/features/cms/graphql-client.ts` (lines 500-520) - item-page fetch still suppresses not-found only when `list.isSingleton && id === '1'`.
4. `src/routes/dashboard/index.tsx` (lines 1-99) - home/dashboard cards already link singleton lists to the real `singletonItemId` when it exists.
5. `src/components/dashboard/list-card.tsx` (lines 1-52) - another dashboard card still links singletons to the list root instead of a singleton item route, showing singleton navigation remains inconsistent.
6. `../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx` (lines 17-54) - reference app still uses `/1` placeholder links for singleton home cards.
7. `../next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx` (lines 400-424) - reference item page also keys singleton missing-state behavior off `itemId === '1'`.

## Key Code
Target overview already knows the **real singleton id**:

```ts
// src/features/cms/graphql-client.ts
const singletonSelections = singletonLists.map((list) => `singleton_${list.key}: ${list.graphql.names.listQueryName}(take: 1) { id }`).join('\n')
...
const singletonItems = overviewData[`singleton_${list.key}`]
return {
  ...list,
  count: typeof overviewData[`count_${list.key}`] === 'number' ? overviewData[`count_${list.key}`] : 0,
  singletonItemId: Array.isArray(singletonItems) ? singletonItems[0]?.id ?? null : null,
}
```

But item-page loading still preserves the old fake-id contract:

```ts
// src/features/cms/graphql-client.ts
if (!data.item && !(list.isSingleton && id === '1')) throw new Error(`Item not found: ${listPath}/${id}`)
```

And the route UI only renders the singleton empty-state for `/1`:

```tsx
// src/routes/dashboard/$listKey.$id.tsx
if (missingItem && data.list.isSingleton && params.id === '1') {
  return (
    ...
    {!data.list.hideCreate ? <Button ...>Create {data.list.singular}</Button> : null}
  )
}
```

This means singleton handling is internally inconsistent now:
- dashboard overview/home can navigate to the **real id** when a singleton exists,
- but the item route/fetcher still assumes the only special singleton path is `/1`.

Reference note: `next-keystone-starter` still uses `/1` placeholder semantics in its HomePage and ItemPage. However, this audit round explicitly says **“singleton real ids”** were part of the intended parity/fix set, and the target has already partially moved to real ids (`singletonItemId`). The remaining gap is therefore inside the target itself: the routing/data layer did not finish that migration.

## Architecture
- `fetchDashboardOverview()` in `src/features/cms/graphql-client.ts` queries each singleton list for `take: 1` and stores the actual item id as `singletonItemId`.
- `src/routes/dashboard/index.tsx` consumes that and links singleton cards to `/dashboard/$listKey/$id` using the real id when present.
- `fetchDashboardItemPage()` still contains a hardcoded escape hatch for `id === '1'`, so the data layer still models singleton emptiness using the old placeholder route.
- `src/routes/dashboard/$listKey.$id.tsx` repeats that same placeholder assumption in the UI branch that offers “Create singleton”.
- Result: singleton navigation semantics are split between real ids and fake id `1`, which is the next concrete, localized parity/correctness gap.

## Start Here
Open `src/features/cms/graphql-client.ts` first. The core bug is the lingering `id === '1'` special case in `fetchDashboardItemPage()`, and the route file only mirrors that assumption.

## Next single concrete fixable gap
**Gap:** singleton item routes still rely on the magic placeholder id `1` for not-found/create-empty behavior, even though the target now resolves and links to real singleton ids elsewhere.

### Why this is the next fix
- It is a correctness issue in the target, not just a cosmetic difference.
- It is narrow and fixable in two files.
- It directly follows the already-landed “singleton real ids” work: overview links were updated, but the item fetch/UI path was not.
- It does **not** require changing `../next-keystone-starter`; in fact this is a target-only cleanup after intentionally diverging from that placeholder approach.

### Exact target files to change
1. `src/features/cms/graphql-client.ts`
2. `src/routes/dashboard/$listKey.$id.tsx`
3. Optional follow-up consistency cleanup: `src/components/dashboard/list-card.tsx`

### Minimal implementation
1. **In `fetchDashboardItemPage()` (`src/features/cms/graphql-client.ts`):**
   - remove the `id === '1'` singleton exception.
   - instead, if `list.isSingleton` and the queried item is missing, perform a tiny singleton existence lookup like the overview query already does:
     - query `${list.gqlNames.listQueryName}(take: 1) { id }`
     - if one exists and `id !== actualSingletonId`, throw not found as normal
     - if none exists, return `{ item: null, ... }` so the UI can render the singleton-empty state for **any requested singleton route**, preferably the canonical one.
   - smallest alternative: only allow the missing-singleton empty state when `id` equals a resolved `singletonItemId ?? id`, rather than the literal `'1'`.

2. **In `src/routes/dashboard/$listKey.$id.tsx`:**
   - replace `params.id === '1'` with data-driven singleton-empty handling.
   - render the “doesn’t exist / Create {singular}” branch whenever `missingItem && data.list.isSingleton` and the loader indicates the singleton truly does not exist.
   - optionally, if a singleton exists under a different id than the current route param, redirect to the canonical real id.

3. **Consistency cleanup in `src/components/dashboard/list-card.tsx`:**
   - if this card is meant to open a singleton directly, it should use `singletonItemId` like `src/routes/dashboard/index.tsx` does, not `/dashboard/$listKey`.
   - This is secondary; the core fix is the item fetch/route logic.

### Expected behavior after fix
- Existing singleton item: dashboard links and direct navigation use the real id consistently.
- Missing singleton item: item route shows the singleton empty/create state without relying on `/1`.
- Wrong singleton id in URL: route can cleanly 404 or redirect to the canonical singleton id.

### Risk / constraint
- Be careful not to broaden the singleton empty-state to non-singleton lists.
- Keep the create-route guard intact (`src/routes/dashboard/$listKey.create.tsx` already respects `hideCreate`).
- If redirecting to the canonical singleton id, use the already-normalized `list.path` to preserve list-path canonicalization.
