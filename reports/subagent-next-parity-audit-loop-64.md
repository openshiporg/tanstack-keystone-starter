# Code Context

## Files Retrieved
1. `src/features/cms/types.ts` (lines 196-230) - list UI config/types show `hideNavigation` is boolean-only, unlike `hideCreate`/`hideDelete`.
2. `src/features/cms/config.ts` (lines 232-244) - normalisation preserves `hideNavigation` as a static boolean.
3. `src/features/cms/admin-meta.ts` (lines 73-123) - request-aware evaluation exists for `hideCreate`/`hideDelete`, but not for navigation hiding.
4. `src/features/cms/admin-meta-query.ts` (lines 1-47) - AdminMeta GraphQL already exposes `hideNavigation`.
5. `src/routes/dashboard/index.tsx` (lines 24-31) - overview page filters visible lists by `!list.hideNavigation`.
6. `src/components/dashboard/dashboard-shell.tsx` (lines 45-53) - sidebar also filters by `!list.hideNavigation`.
7. `src/features/cms/route-config.ts` (lines 1-20) - static nav config is built from compile-time `adminMeta`, reinforcing non-request-aware navigation metadata.
8. `../next-keystone-starter/features/dashboard/actions/getAdminMetaAction.ts` (lines 1-102) - comparison app consumes AdminMeta from server per request, including hidden-list metadata from GraphQL.
9. `../next-keystone-starter/features/dashboard/hooks/useAdminMeta.tsx` (lines 114-130) - comparison app builds navigation from fetched AdminMeta rather than static local config.

## Key Code

Target currently makes only create/delete UI flags request-aware:

```ts
// src/features/cms/admin-meta.ts:73-77
async function evaluateListUiFlag(value: CmsList['hideCreate'], list: CmsList, context: CmsContext | undefined, operation: CmsListAccessOperation) {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'function' || !context) return false
  return Boolean(await value({ context, session: context.session, listKey: list.key, operation }))
}
```

```ts
// src/features/cms/admin-meta.ts:117-123
export async function getAdminMetaForContext(context: CmsContext, lists: CmsList[] = cmsLists) {
  const viewOrder = lists === cmsLists ? cmsViewOrder : generateViewOrder(lists)
  return {
    lists: await Promise.all(lists.map(async (list) => toAdminMetaList(list, viewOrder, {
      hideCreate: await evaluateListUiFlag(list.hideCreate, list, context, 'create'),
      hideDelete: await evaluateListUiFlag(list.hideDelete, list, context, 'delete'),
    }))),
  }
}
```

But `hideNavigation` is typed and normalized as static-only:

```ts
// src/features/cms/types.ts:201-206
export type CmsListUiConfig = {
  hideCreate?: boolean | ((args: CmsOperationAccessArgs) => boolean | Promise<boolean>)
  hideDelete?: boolean | ((args: CmsOperationAccessArgs) => boolean | Promise<boolean>)
  hideNavigation?: boolean
```

```ts
// src/features/cms/config.ts:239-241
isHidden: listConfig.isHidden ?? listConfig.ui?.hideNavigation,
hideNavigation: listConfig.ui?.hideNavigation ?? listConfig.isHidden ?? false,
hideCreate: listConfig.hideCreate ?? listConfig.ui?.hideCreate,
hideDelete: listConfig.hideDelete ?? listConfig.ui?.hideDelete,
```

And the UI trusts that AdminMeta flag everywhere:

```ts
// src/routes/dashboard/index.tsx:26
const lists = data.lists.filter((list) => !list.hideNavigation)
```

```ts
// src/components/dashboard/dashboard-shell.tsx:49
<DashboardSidebar lists={data.lists.filter((list) => !list.hideNavigation)} user={data.authenticatedItem} />
```

There is also a static nav artifact derived from compile-time AdminMeta:

```ts
// src/features/cms/route-config.ts:12-19
...adminMeta.lists.map((list) => ({
  title: list.label,
  to: `/dashboard/${list.path}`,
```

Comparison app pattern is server-fetched AdminMeta-based navigation, not static local list metadata:

```ts
// ../next-keystone-starter/features/dashboard/hooks/useAdminMeta.tsx:120-126
const navigation = adminMeta?.lists?.map((list: ListMeta) => ({
  key: list.key,
  path: list.path,
  label: list.label,
  description: list.description
})) || []
```

## Architecture
- `src/features/cms/config.ts` normalises list config into `CmsList`.
- `src/features/cms/admin-meta.ts` converts `CmsList` into GraphQL `AdminMetaList`.
- `src/features/cms/runtime.ts` resolves `keystone.adminMeta` with `getAdminMetaForContext(context)`, so any request-aware UI flag must be evaluated there.
- `src/features/cms/graphql-client.ts` fetches AdminMeta, then `fetchDashboardOverview()` uses it to build sidebar/overview list data.
- Dashboard UI (`src/routes/dashboard/index.tsx`, `src/components/dashboard/dashboard-shell.tsx`) hides lists based on `hideNavigation` from AdminMeta.

Because `hideNavigation` is not function-capable or context-evaluated, list visibility in navigation/overview cannot follow Keystone-style per-request UI semantics, even though the rest of the AdminMeta flow is already request-aware.

## Start Here
Open `src/features/cms/types.ts` first. It exposes the root mismatch: `hideNavigation` is boolean-only while the rest of the request-aware UI flag plumbing already exists for `hideCreate` and `hideDelete`.

## Finding: next single concrete fixable gap
**Gap:** `hideNavigation` is still static-only. This blocks per-request list hiding in the dashboard sidebar/overview, despite AdminMeta now being request-aware for other list UI flags.

### Why this is the next fix
- It is in the target app only.
- It is narrowly scoped.
- The UI already consumes `hideNavigation`; the missing piece is server-side semantics.
- It aligns with Keystone-style AdminMeta behavior, where UI visibility decisions belong in request-scoped metadata rather than static build-time config.

### Minimal implementation
1. **Allow functional `hideNavigation` in list types/config.**
   - `src/features/cms/types.ts`
     - Change `CmsListUiConfig.hideNavigation?: boolean` to:
       `boolean | ((args: CmsOperationAccessArgs) => boolean | Promise<boolean>)`
     - Change `CmsList.hideNavigation?: boolean` similarly.

2. **Preserve function values during normalisation.**
   - `src/features/cms/config.ts`
     - Keep `hideNavigation` as `listConfig.ui?.hideNavigation ?? listConfig.isHidden ?? false` without narrowing it to plain boolean semantics.
     - Ensure `isHidden` remains the static legacy alias if needed, but do not collapse a function-valued `hideNavigation` into `isHidden`.

3. **Evaluate `hideNavigation` in request-scoped AdminMeta.**
   - `src/features/cms/admin-meta.ts`
     - Generalise `evaluateListUiFlag` parameter type from `CmsList['hideCreate']` to a shared list UI flag type.
     - Extend `toAdminMetaList(..., uiOverrides)` to accept `hideNavigation`.
     - In `getAdminMetaForContext()`, pass:
       `hideNavigation: await evaluateListUiFlag(list.hideNavigation, list, context, 'query')`
       or equivalent read/list operation.
     - In static `toAdminMetaList()`, default `hideNavigation` to the boolean value only when the config is actually boolean, matching how `hideCreate`/`hideDelete` are handled.

4. **Optional cleanup:**
   - `src/features/cms/route-config.ts` currently derives navigation from static `adminMeta`; if this file is still used anywhere later, it will remain stale for request-aware hidden lists. Either stop using it for authenticated navigation or document it as static-only. Current grep shows runtime UI is already using fetched overview data, so this is likely low risk.

### Risk / constraint
- `isHidden` appears to be treated as a static alias today. If backward compatibility with `isHidden` matters, keep it boolean-only and make only `hideNavigation` request-aware.
- Pick the operation passed to the evaluator consistently. `query` is the closest available `CmsListAccessOperation` for navigation visibility.

### Recommended concrete target files
- `src/features/cms/types.ts`
- `src/features/cms/config.ts`
- `src/features/cms/admin-meta.ts`
- optionally review `src/features/cms/route-config.ts` for stale static usage
