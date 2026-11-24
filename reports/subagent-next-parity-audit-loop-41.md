# Code Context

## Files Retrieved
1. `src/features/cms/types.ts` (lines 186-225, 268-289) - target list/admin-meta types; shows `CmsListUiConfig` lacks `hideNavigation`, `CmsList` uses `isHidden`, and `AdminMetaList` exposes `isHidden` instead of Keystone's `hideNavigation`.
2. `src/features/cms/config.ts` (lines 192-210) - target list normalization; copies `listConfig.isHidden` through to runtime list objects.
3. `src/features/cms/admin-meta.ts` (lines 74-91) - target admin-meta builder; serializes `isHidden` into dashboard metadata.
4. `src/features/cms/admin-meta-query.ts` (lines 16-31) - target GraphQL admin-meta query; requests `isHidden`, not `hideNavigation`.
5. `src/components/dashboard/dashboard-shell.tsx` (lines 32-43) - target sidebar input is filtered with `!list.isHidden`.
6. `src/components/dashboard/dashboard-sidebar.tsx` (lines 44-60) - target sidebar consumes whatever lists it is given; no additional nav-hiding logic.
7. `../next-keystone-starter/features/dashboard/types/index.ts` (lines 128-140) - reference admin-meta type includes `initialFilter` and `hideNavigation` instead of `isHidden`.
8. `../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx` (lines 94-101) - reference currently filters with `!list.isHidden`, showing the app still carries mixed naming.
9. `../next-keystone-starter/features/dashboard/components/Sidebar.tsx` (lines 53-72, 102-122) - reference sidebar takes all lists from admin meta and relies on upstream filtering.
10. `../next-keystone-starter/features/dashboard/actions/getAdminMetaAction.ts` (lines 13-59) - reference GraphQL admin-meta fetch also requests `isHidden`, while its own types expect `hideNavigation`.

## Key Code
Target list UI/meta model currently has no `hideNavigation` concept:

```ts
// src/features/cms/types.ts
export type CmsListUiConfig = {
  hideCreate?: boolean | ((args: CmsOperationAccessArgs) => boolean | Promise<boolean>)
  hideDelete?: boolean | ((args: CmsOperationAccessArgs) => boolean | Promise<boolean>)
  listView?: {
    initialColumns?: string[]
  }
  itemView?: Record<string, unknown>
  [key: string]: unknown
}
```

Target normalization persists `isHidden` only:

```ts
// src/features/cms/config.ts
isSingleton: listConfig.isSingleton,
isHidden: listConfig.isHidden,
hideCreate: listConfig.hideCreate ?? listConfig.ui?.hideCreate,
hideDelete: listConfig.hideDelete ?? listConfig.ui?.hideDelete,
```

Target admin-meta exposes `isHidden` only:

```ts
// src/features/cms/admin-meta.ts
isSingleton: list.isSingleton ?? false,
isHidden: list.isHidden ?? false,
hideCreate: typeof list.hideCreate === 'boolean' ? list.hideCreate : false,
hideDelete: typeof list.hideDelete === 'boolean' ? list.hideDelete : false,
```

Target GraphQL admin-meta query requests `isHidden` only:

```ts
// src/features/cms/admin-meta-query.ts
labelField
isSingleton
isHidden
hideCreate
hideDelete
```

Target dashboard sidebar behavior depends on that field:

```tsx
// src/components/dashboard/dashboard-shell.tsx
<DashboardSidebar lists={data.lists.filter((list) => !list.isHidden)} user={data.authenticatedItem} />
```

Reference types still model Keystone naming instead:

```ts
// ../next-keystone-starter/features/dashboard/types/index.ts
initialSort: null | { direction: 'ASC' | 'DESC'; field: string }
initialFilter: JSONValue
isSingleton: boolean
hideNavigation: boolean
hideCreate: boolean
hideDelete: boolean
```

## Architecture
In the target app, list visibility for dashboard navigation is determined in this path:

1. `src/features/cms/config.ts` normalizes list config into `CmsList`.
2. `src/features/cms/admin-meta.ts` converts `CmsList` into GraphQL/admin metadata.
3. `src/features/cms/admin-meta-query.ts` and `src/features/cms/graphql-client.ts` move that metadata to the dashboard.
4. `src/components/dashboard/dashboard-shell.tsx` filters sidebar lists using `!list.isHidden`.
5. `src/components/dashboard/dashboard-sidebar.tsx` simply renders the provided list set.

The parity problem is semantic/API-level: Keystone/next-keystone-starter types use `hideNavigation` for sidebar suppression, but the target pipeline only understands `isHidden`. That means a Keystone-style list config using `ui.hideNavigation` or code expecting `hideNavigation` in admin metadata will not round-trip correctly in the target, even though sidebar filtering behavior was “fixed” for `isHidden`.

## Start Here
Open `src/features/cms/types.ts` first. It defines the source-of-truth list/admin-meta shapes and immediately shows the mismatch: target supports `isHidden` but not Keystone-style `hideNavigation`.

## Next single concrete fixable parity gap
**Gap:** the target dashboard/config pipeline still uses `isHidden` instead of Keystone-style `hideNavigation`, so navigation-hiding parity is incomplete at the API/type/config level.

### Minimal implementation
1. **Add `hideNavigation` to list config/types** in `src/features/cms/types.ts`:
   - Add `hideNavigation?: boolean` to `CmsListUiConfig` and/or `CmsList` parity surface.
   - Add `hideNavigation: boolean` to `AdminMetaList`.
2. **Normalize it** in `src/features/cms/config.ts`:
   - Compute `hideNavigation` from `listConfig.ui?.hideNavigation ?? listConfig.isHidden ?? false`.
   - Keep `isHidden` only if needed for backward compatibility, but derive sidebar behavior from `hideNavigation`.
3. **Expose it in admin meta** in `src/features/cms/admin-meta.ts`:
   - Serialize `hideNavigation` on each list.
   - Optionally alias `isHidden` from it temporarily if the current UI still reads `isHidden`.
4. **Request it over GraphQL** in `src/features/cms/admin-meta-query.ts` and runtime schema if necessary.
5. **Switch consumers** like `src/components/dashboard/dashboard-shell.tsx` and `src/routes/dashboard/index.tsx` from `!list.isHidden` to `!list.hideNavigation` (or support both during transition).

### Why this is the best next fix
Most of the listed behavior fixes are already present in target. This remaining gap is small, concrete, and systemically important because it affects config compatibility, GraphQL metadata parity, and sidebar/no-access/filter/home-page consistency all at once.

### Risk / open question
Reference app is internally inconsistent today: its types say `hideNavigation`, but several runtime callers still filter on `isHidden`. So the safest parity fix for target is a compatibility layer that supports **both** names during transition, with `hideNavigation` as the canonical Keystone-facing field.