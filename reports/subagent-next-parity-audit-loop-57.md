# Code Context

## Files Retrieved
1. `src/features/cms/admin-meta.ts` (lines 73-95) - builds `AdminMetaList` and currently hardcodes functional `hideCreate`/`hideDelete` UI config to `false`.
2. `src/features/cms/config.ts` (lines 198-216) - preserves raw `hideCreate`/`hideDelete` values from list config, including functions, into normalized `CmsList`.
3. `src/features/cms/types.ts` (lines 198-226, 280-294) - shows `hideCreate`/`hideDelete` accept `boolean | ((args) => ...)` in config, but `AdminMetaList` exposes them as booleans to the dashboard/admin client.
4. `src/features/cms/models/User.ts` (lines 34-39) - concrete list using functional `ui.hideCreate` and `ui.hideDelete`.
5. `src/features/cms/models/Role.ts` (lines 22-27) - another concrete list using functional `ui.hideCreate` and `ui.hideDelete`.
6. `src/features/cms/models/Todo.ts` (lines 74-78) - another concrete list using functional `ui.hideCreate`.
7. `src/features/cms/runtime.ts` (lines 143-170, 993-999, 1033-1036) - GraphQL schema exposes `hideCreate`/`hideDelete` on `ListMeta`, and `KeystoneMeta.adminMeta` currently resolves via `getAdminMeta(...)` with no per-request UI evaluation.
8. `src/components/dashboard/list-card.tsx` (lines 24-31) - dashboard create CTA is driven directly by `list.hideCreate`.
9. `src/components/dashboard/filter-bar.tsx` (lines 191-198) - list page create CTA is driven directly by `list.hideCreate`.
10. `src/components/dashboard/keystone-list-table.tsx` (lines 80-86) - empty-state create CTA is driven directly by `list.hideCreate`.
11. `src/routes/dashboard/$listKey.$id.tsx` (lines 157-163, 177-179) - singleton fallback create CTA and delete action are driven directly by `hideCreate`/`hideDelete`.
12. `src/routes/dashboard/index.tsx` (lines 66-96) - home/dashboard cards branch on singleton state and `hideCreate`.
13. `src/features/cms/admin-meta-query.ts` (lines 1-44) - confirms the client requests `hideCreate`/`hideDelete` via admin meta.

## Key Code

### The gap
`CmsList` correctly stores UI visibility flags as booleans **or functions**:

```ts
// src/features/cms/types.ts
export type CmsListUiConfig = {
  hideCreate?: boolean | ((args: CmsOperationAccessArgs) => boolean | Promise<boolean>)
  hideDelete?: boolean | ((args: CmsOperationAccessArgs) => boolean | Promise<boolean>)
}
```

Normalization preserves those values:

```ts
// src/features/cms/config.ts:208-212
isHidden: listConfig.isHidden ?? listConfig.ui?.hideNavigation,
hideNavigation: listConfig.ui?.hideNavigation ?? listConfig.isHidden ?? false,
hideCreate: listConfig.hideCreate ?? listConfig.ui?.hideCreate,
hideDelete: listConfig.hideDelete ?? listConfig.ui?.hideDelete,
```

But admin meta throws away functional values:

```ts
// src/features/cms/admin-meta.ts:83-87
isSingleton: list.isSingleton ?? false,
isHidden: list.hideNavigation ?? list.isHidden ?? false,
hideNavigation: list.hideNavigation ?? list.isHidden ?? false,
hideCreate: typeof list.hideCreate === 'boolean' ? list.hideCreate : false,
hideDelete: typeof list.hideDelete === 'boolean' ? list.hideDelete : false,
```

That means any list using permission-based UI visibility functions is reported to the admin UI as **not hidden** for create/delete actions.

Concrete affected models already exist:

```ts
// src/features/cms/models/User.ts:35-36
hideCreate: (args) => !permissions.canManagePeople(args),
hideDelete: (args) => !permissions.canManagePeople(args),

// src/features/cms/models/Role.ts:23-24
hideCreate: (args) => !permissions.canManageRoles(args),
hideDelete: (args) => !permissions.canManageRoles(args),

// src/features/cms/models/Todo.ts:75
hideCreate: (args) => !permissions.canCreateTodos(args),
```

The dashboard trusts these booleans in multiple places:

```tsx
// src/components/dashboard/list-card.tsx:25
{!list.hideCreate && !list.isSingleton ? (

// src/components/dashboard/filter-bar.tsx:193
{!list.hideCreate && !list.isSingleton ? (

// src/components/dashboard/keystone-list-table.tsx:83
{!data.list.hideCreate && !data.list.isSingleton ? (

// src/routes/dashboard/$listKey.$id.tsx:162,179
{!data.list.hideCreate ? <Button ...>Create ...</Button> : null}
{!data.list.hideDelete ? (
```

So unauthorized users can still see create/delete affordances, even though the mutations themselves may later fail at access control.

## Architecture
- List configs are normalized in `src/features/cms/config.ts`.
- Those normalized `CmsList` objects feed `getAdminMeta()` / `toAdminMetaList()` in `src/features/cms/admin-meta.ts`.
- GraphQL exposes that metadata through `KeystoneMeta.adminMeta` in `src/features/cms/runtime.ts`.
- The TanStack dashboard fetches admin meta via `src/features/cms/admin-meta-query.ts` and uses `hideCreate`/`hideDelete` throughout route and component rendering.
- Because admin meta is currently built without request/session-aware evaluation, function-valued UI rules degrade to `false`, which is semantically wrong versus Keystone-style per-request admin UI metadata.

## Start Here
Open `src/features/cms/admin-meta.ts` first. That is where the bad parity decision is made: function-valued `hideCreate`/`hideDelete` are converted to `false` instead of being evaluated against the current request context.

## Finding: next concrete fixable gap
**Implement request-aware evaluation of list UI visibility flags (`hideCreate`, `hideDelete`) when producing `AdminMeta`.**

### Why this is the next fix
This is a target-only parity gap and directly contradicts official Keystone semantics: admin metadata should reflect the current user/session’s UI permissions, not expose buttons and rely on later mutation failure. The comparison project also queries these fields from admin meta, so the missing behavior is in this target’s metadata generation, not in `../next-keystone-starter`.

### Minimal implementation
1. **Make admin-meta generation context-aware** instead of purely static for these fields.
   - Add an async helper in `src/features/cms/admin-meta.ts` or `src/features/cms/runtime.ts` that evaluates:
     - `hideCreate`
     - `hideDelete`
     - optionally `hideNavigation` later if function support is ever added
   - Evaluation should use the existing `CmsOperationAccessArgs` shape with the current runtime `CmsContext.session` and operation (`create` or `delete`).

2. **Change the GraphQL resolver path** in `src/features/cms/runtime.ts` so `KeystoneMeta.adminMeta` returns a per-request admin meta object, e.g. an async `getAdminMetaForContext(context, lists)` rather than static `getAdminMeta(lists)` / `getAdminMeta()`.

3. **Leave the static export in place for non-request consumers** if needed, but ensure dashboard/admin GraphQL uses the request-aware version.

### Smallest safe shape
- Keep `AdminMetaList.hideCreate` and `hideDelete` as booleans in the GraphQL schema.
- Only change how those booleans are computed.
- Use existing session/context data already flowing through GraphQL resolvers in `runtime.ts`.

### Risk / constraint
- `adminMeta` is currently exported as a static constant and reused in some local code. Do not blindly convert every consumer to async; only the runtime GraphQL admin-meta resolver needs to become request-aware for parity.
- Be careful not to break the already-fixed singleton `/1` compatibility behavior; this gap is independent.

### Suggested acceptance check
- Sign in as a user lacking `canManagePeople`: `User` list create CTA should disappear.
- Sign in as a user lacking `canManageRoles`: `Role` create/delete affordances should disappear.
- Sign in as a user lacking `canCreateTodos`: `Todo` create affordances should disappear.
- Authorized users should still see the actions.
