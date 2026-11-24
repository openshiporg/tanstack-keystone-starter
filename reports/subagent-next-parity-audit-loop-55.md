# Code Context

## Files Retrieved
1. `src/features/cms/admin-meta.ts` (lines 5-96) - builds static `AdminMetaField`/`AdminMetaList`; currently hard-codes `hideCreate`/`hideDelete` to `false` unless the config value is already a boolean.
2. `src/features/cms/runtime.ts` (lines 140-167) - GraphQL schema exposes `AdminMeta.list(key: String!): ListMeta` and `ListMeta.hideCreate`/`hideDelete` as booleans, so this is the server boundary for parity.
3. `src/features/cms/runtime.ts` (lines 995-1056) - GraphQL resolvers return `getAdminMeta()` and only customize `description`/`initialSearchFields`; there is no request/session-aware resolver for `hideCreate`/`hideDelete`.
4. `src/features/cms/types.ts` (lines 196-226, 270-289) - list UI config explicitly allows `hideCreate`/`hideDelete` to be functions of `CmsOperationAccessArgs`, but `AdminMetaList` flattens them to booleans.
5. `src/features/cms/models/Todo.ts` (lines 68-79) - real target model already uses dynamic `ui.hideCreate: (args) => !permissions.canCreateTodos(args)`.
6. `src/features/cms/models/User.ts` (lines 32-43) - target model uses dynamic `ui.hideCreate`/`ui.hideDelete` based on permissions.
7. `src/features/cms/models/Role.ts` (lines 21-31) - target model uses dynamic `ui.hideCreate`/`ui.hideDelete` based on permissions.
8. `src/features/cms/admin-meta-query.ts` (lines 1-49) - client requests `hideCreate`/`hideDelete` from admin meta, so wrong server values directly leak into the dashboard.
9. `src/routes/dashboard/$listKey.$id.tsx` (lines 139-177) - delete button and singleton missing-item create CTA are gated by `data.list.hideDelete` / `data.list.hideCreate`.
10. `src/routes/dashboard/$listKey.create.tsx` (lines 1-116) - create page itself is loadable regardless of list-level `hideCreate`; the UI relies on admin meta for hiding entry points.
11. `../next-keystone-starter/features/dashboard/actions/getAdminMetaAction.ts` (lines 14-69) - comparison app simply trusts Keystone adminMeta booleans from the server, which implies the target server should evaluate them correctly.

## Key Code
Current bug source in `src/features/cms/admin-meta.ts`:

```ts
return {
  ...list,
  // ...
  isHidden: list.hideNavigation ?? list.isHidden ?? false,
  hideNavigation: list.hideNavigation ?? list.isHidden ?? false,
  hideCreate: typeof list.hideCreate === 'boolean' ? list.hideCreate : false,
  hideDelete: typeof list.hideDelete === 'boolean' ? list.hideDelete : false,
  fields: list.fields.map((field) => toAdminMetaField(field, viewOrder)),
}
```

But the type system explicitly allows functions:

```ts
export type CmsListUiConfig = {
  hideCreate?: boolean | ((args: CmsOperationAccessArgs) => boolean | Promise<boolean>)
  hideDelete?: boolean | ((args: CmsOperationAccessArgs) => boolean | Promise<boolean>)
}

export type CmsList = {
  hideCreate?: boolean | ((args: CmsOperationAccessArgs) => boolean | Promise<boolean>)
  hideDelete?: boolean | ((args: CmsOperationAccessArgs) => boolean | Promise<boolean>)
}
```

Real target models depend on those functions, e.g. `src/features/cms/models/Todo.ts`:

```ts
ui: {
  hideCreate: (args) => !permissions.canCreateTodos(args),
  listView: {
    initialColumns: ['label', 'tags', 'isComplete', 'assignedTo'],
  },
},
```

And `src/features/cms/models/User.ts`:

```ts
ui: {
  hideCreate: (args) => !permissions.canManagePeople(args),
  hideDelete: (args) => !permissions.canManagePeople(args),
}
```

Those values are consumed by the dashboard as if they were already authoritative booleans:

```ts
// src/routes/dashboard/$listKey.$id.tsx
{!data.list.hideDelete ? <AlertDialog>...Delete...</AlertDialog> : null}

{!data.list.hideCreate ? <Button ...>Create {data.list.singular}</Button> : null}
```

## Architecture
1. List model config (`src/features/cms/models/*.ts`) defines list-level UI flags like `hideCreate` and `hideDelete`, sometimes as permission-aware functions.
2. `normaliseList()` in `src/features/cms/config.ts` preserves those function values on `CmsList`.
3. `toAdminMetaList()` in `src/features/cms/admin-meta.ts` converts `CmsList` to `AdminMetaList`, but currently drops function-valued `hideCreate`/`hideDelete` to `false`.
4. GraphQL `keystone.adminMeta` resolvers in `src/features/cms/runtime.ts` return that static admin meta object unchanged.
5. Client admin meta fetch (`src/features/cms/admin-meta-query.ts` + `src/features/cms/graphql-client.ts`) trusts those booleans.
6. Dashboard routes/components use them to decide whether to show create/delete actions.

This means the target UI can advertise actions the current user is not allowed to use, which diverges from Keystone semantics and from the comparison app’s assumption that adminMeta already reflects permission-aware booleans.

## Start Here
Open `src/features/cms/admin-meta.ts` first. The main parity gap is there: function-based list UI flags are erased during admin-meta normalization.

## Concrete next fixable gap
**Gap:** `AdminMeta.hideCreate` and `AdminMeta.hideDelete` are not session/request-aware in the target app.

**Why this is the next concrete target-only fix:**
- It is a real semantic mismatch with Keystone: list UI hiding options may be dynamic per user.
- The target already defines dynamic list UI rules in actual models.
- The client already consumes these values everywhere; only the server-side computation is wrong.
- No changes are needed in `../next-keystone-starter`.

## Minimal implementation
1. **Keep `admin-meta.ts` focused on static shape only** and stop pretending dynamic flags are final there. You can leave fallback values, but the authoritative fix belongs in GraphQL resolvers.
2. **Add request/session-aware `ListMeta.hideCreate` and `ListMeta.hideDelete` resolvers in `src/features/cms/runtime.ts`.**
   - Resolve the underlying `CmsList` by key/path.
   - If the config value is a boolean, return it.
   - If it is a function, call it with the same `CmsOperationAccessArgs` shape used elsewhere:
     `{ session: context.session, context, listKey: list.key, operation: 'create' | 'delete' }`
   - Prefer `list.ui?.hideCreate` / `list.ui?.hideDelete` when present, then fall back to top-level `list.hideCreate` / `list.hideDelete`.
3. **Mirror that resolver in both public and generated-list resolver maps** (`generateCmsResolversForLists` and `cmsResolvers`) so internal/public schemas stay aligned.

Suggested implementation shape:

```ts
async function resolveListUiVisibility(
  list: AdminMetaList,
  context: CmsContext,
  operation: 'create' | 'delete',
) {
  const cmsList = cmsLists.find((candidate) => candidate.key === list.key)
  const configValue = operation === 'create'
    ? cmsList?.ui?.hideCreate ?? cmsList?.hideCreate
    : cmsList?.ui?.hideDelete ?? cmsList?.hideDelete

  if (typeof configValue === 'function') {
    return Boolean(await configValue({
      session: context.session,
      context,
      listKey: list.key,
      operation,
    }))
  }

  return Boolean(configValue)
}
```

Then in `ListMeta` resolvers:

```ts
ListMeta: {
  description: ...,
  initialSearchFields: ...,
  hideCreate: (list, _args, context) => resolveListUiVisibility(list, context, 'create'),
  hideDelete: (list, _args, context) => resolveListUiVisibility(list, context, 'delete'),
}
```

## Risks / constraints
- `adminMeta` is currently cached as a static object in memory. Dynamic list booleans must therefore be resolved at GraphQL field-resolution time, not baked into `adminMeta` once at startup.
- Keep lookup by `list.key`; that is what `AdminMeta.list(key: String!)` already uses.
- This should not affect `hideNavigation`, which in Keystone is typically static and is already used to filter sidebar/home visibility.
- Existing UI should update automatically after this server fix because the client already queries these fields.
