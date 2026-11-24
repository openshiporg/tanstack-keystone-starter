# Code Context

## Files Retrieved
1. `src/components/dashboard/dashboard-shell.tsx` (lines 1-45) - sidebar list source and current hidden-list filtering behavior.
2. `src/components/dashboard/dashboard-sidebar.tsx` (lines 1-120) - consumes already-filtered lists for navigation.
3. `src/routes/dashboard/index.tsx` (lines 1-80) - dashboard home cards also filter with `!list.isHidden`.
4. `src/features/cms/config.ts` (lines 180-207) - normalizes list config and currently only maps `isHidden`, `hideCreate`, `hideDelete`.
5. `src/features/cms/types.ts` (lines 190-203, 219-223, 272-280) - list/UI config and admin meta types; no `hideNavigation` field exists in target types.
6. `src/features/cms/admin-meta.ts` (lines 1-90) - serializes admin meta lists; currently exposes `isHidden` but not a navigation-specific flag.
7. `src/features/cms/admin-meta-query.ts` (lines 1-45) - GraphQL admin meta query also requests `isHidden` but no navigation flag.
8. `../next-keystone-starter/features/dashboard/components/Sidebar.tsx` (lines 1-220) - upstream sidebar consumes admin meta lists and relies on list metadata shape from upstream types.
9. `../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx` (lines 90-106) - upstream dashboard home filters hidden lists before rendering.
10. `../next-keystone-starter/features/dashboard/types/index.ts` (lines 132-140) - upstream list metadata includes `hideNavigation`, `hideCreate`, `hideDelete`.
11. `../next-keystone-starter/features/dashboard/actions/getAdminMetaAction.ts` (lines 1-96) - upstream admin meta query shape currently omits `hideNavigation`, showing a metadata/schema drift.

## Key Code

Target currently uses `isHidden` for navigation visibility:

```tsx
// src/components/dashboard/dashboard-shell.tsx
<DashboardSidebar lists={data.lists.filter((list) => !list.isHidden)} user={data.authenticatedItem} />
```

```tsx
// src/routes/dashboard/index.tsx
const lists = data.lists.filter((list) => !list.isHidden)
```

Target list config has no navigation-only flag:

```ts
// src/features/cms/types.ts
export type CmsListUiConfig = {
  hideCreate?: boolean | ((args: CmsOperationAccessArgs) => boolean | Promise<boolean>)
  hideDelete?: boolean | ((args: CmsOperationAccessArgs) => boolean | Promise<boolean>)
  listView?: {
    initialColumns?: string[]
  }
  itemView?: Record<string, unknown>
}
```

```ts
// src/features/cms/types.ts
export type CmsList = {
  // ...
  isHidden?: boolean
  hideCreate?: boolean | ((args: CmsOperationAccessArgs) => boolean | Promise<boolean>)
  hideDelete?: boolean | ((args: CmsOperationAccessArgs) => boolean | Promise<boolean>)
}
```

Admin meta serialization likewise only carries `isHidden`:

```ts
// src/features/cms/admin-meta.ts
return {
  ...list,
  initialSort: list.initialSort ?? null,
  pageSize: list.pageSize ?? 50,
  isSingleton: list.isSingleton ?? false,
  isHidden: list.isHidden ?? false,
  hideCreate: typeof list.hideCreate === 'boolean' ? list.hideCreate : false,
  hideDelete: typeof list.hideDelete === 'boolean' ? list.hideDelete : false,
  // ...
}
```

Upstream metadata type includes a distinct navigation flag:

```ts
// ../next-keystone-starter/features/dashboard/types/index.ts
isSingleton: boolean
hideNavigation: boolean
hideCreate: boolean
hideDelete: boolean
```

## Architecture
- `src/features/cms/config.ts` normalizes author-defined list config into internal `CmsList` objects.
- `src/features/cms/admin-meta.ts` converts those lists into admin-meta payloads used by the dashboard.
- `src/features/cms/admin-meta-query.ts` defines the client query shape for fetching that payload.
- `src/features/cms/graphql-client.ts` consumes admin meta and feeds route/components.
- `src/components/dashboard/dashboard-shell.tsx` and `src/routes/dashboard/index.tsx` decide which lists appear in sidebar/home.

Today, the target conflates “hidden everywhere” (`isHidden`) with “hidden from navigation”. Upstream type shape expects a separate `hideNavigation` concept. Because target lacks this field entirely, it cannot match Keystone/next behavior where a list may stay queryable/accessible yet be omitted from navigation.

## Start Here
Open `src/features/cms/types.ts` first. The gap begins at the metadata contract: target has no `hideNavigation` field, so the dashboard cannot implement navigation-only hiding separately from full list hiding.

## Next single concrete fixable parity gap
**Gap:** target is still missing a dedicated `hideNavigation` list metadata flag; it uses `isHidden` for sidebar/home filtering instead. This is the next fixable parity gap because it affects the “auth/no-access/sidebar/filter parity” bucket and is a self-contained contract/UI change.

### Minimal implementation
1. **Add `hideNavigation` to list config/types**
   - File: `src/features/cms/types.ts`
   - Add `hideNavigation?: boolean | ((args: CmsOperationAccessArgs) => boolean | Promise<boolean>)` to `CmsListUiConfig` and `CmsList`.
   - Add `hideNavigation: boolean` to `AdminMetaList`/runtime-facing admin meta shape.

2. **Normalize the flag from config**
   - File: `src/features/cms/config.ts`
   - In `normaliseList(...)`, map `hideNavigation: listConfig.hideNavigation ?? listConfig.ui?.hideNavigation`.
   - If top-level `CmsListConfig` type lives elsewhere in this file/module, add the corresponding property there too.

3. **Expose it in admin meta**
   - Files: `src/features/cms/admin-meta.ts`, `src/features/cms/admin-meta-query.ts`, and likely `src/features/cms/runtime.ts`
   - Serialize/query `hideNavigation` alongside `isHidden`, `hideCreate`, `hideDelete`.
   - Default boolean resolution should mirror `hideCreate`/`hideDelete` handling.

4. **Use `hideNavigation` for dashboard chrome filtering**
   - Files: `src/components/dashboard/dashboard-shell.tsx`, `src/routes/dashboard/index.tsx`
   - Replace `!list.isHidden` with `!list.hideNavigation` for sidebar/home visibility.
   - Keep `isHidden` semantics separate for any full-list hiding logic already in place.

### Why this is the next fix
Most of the previously audited dashboard-item/list mechanics are already closed. This remaining gap is small, exact, and contract-driven: without `hideNavigation`, the target cannot express Keystone-style “present but not navigable” lists, so sidebar/home behavior still diverges from upstream metadata parity.

### Risk/constraint
- This change touches the admin-meta contract, so all related type/query/runtime definitions must stay in sync.
- Avoid replacing all `isHidden` uses globally; only navigation/home filtering should move to `hideNavigation` unless deeper behavior parity is intentionally widened.