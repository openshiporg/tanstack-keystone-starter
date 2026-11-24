# Code Context

## Files Retrieved
1. `src/features/cms/admin-meta.ts` (lines 26-104) - builds admin meta fields/lists; currently only preserves static `fieldMode` strings and defaults function-valued modes.
2. `src/features/cms/types.ts` (lines 3-16) - defines Keystone-like `FieldModeConfig` as `FieldMode | ((args) => ...)`, establishing expected dynamic semantics.
3. `src/features/cms/runtime.ts` (lines 143-210, 1006-1020) - GraphQL schema/resolvers for `FieldMeta.createView/itemView/listView`; currently just echo stored values and expose no create/list-time dynamic evaluation path.
4. `src/features/cms/graphql-client.ts` (lines 504-540) - item page already does a follow-up `adminMeta.list(key)` query to fetch per-item `itemView`, showing the intended runtime override pattern.
5. `src/features/cms/admin-meta-query.ts` (lines 1-53) - dashboard-wide admin meta query only reads static `createView/itemView/listView` metadata from `lists`, so any dynamic fieldMode logic is lost there.
6. `../next-keystone-starter/.keystone/config.js` (lines around 97-98, 172-173, 218) - reference app already relies on function-valued `hideCreate`/`hideDelete`, confirming this codebase is aiming at Keystone UI-semantic parity.

## Key Code
`src/features/cms/types.ts`
```ts
export type FieldModeConfig = FieldMode | ((args: FieldModeArgs) => FieldMode | Promise<FieldMode>)

export type FieldViewConfig = {
  fieldMode?: FieldModeConfig
  fieldPosition?: 'form' | 'sidebar'
}
```
The type contract explicitly allows dynamic field view modes.

`src/features/cms/admin-meta.ts`
```ts
function staticFieldMode(view: { fieldMode?: FieldModeConfig } | undefined, fallback: 'edit' | 'read' | 'hidden') {
  const fieldMode = view?.fieldMode
  return typeof fieldMode === 'string' ? fieldMode : fallback
}
```
This is the core parity gap: function-valued `fieldMode` is discarded and replaced with fallback.

```ts
createView: {
  fieldMode: staticFieldMode(field.createView, field.kind === 'id' ? 'hidden' : 'edit'),
  fieldPosition: field.createView?.fieldPosition ?? 'form',
},
itemView: {
  fieldMode: staticFieldMode(field.itemView, 'edit'),
  fieldPosition: field.itemView?.fieldPosition ?? 'form',
},
listView: {
  fieldMode: staticFieldMode(field.listView, field.kind === 'password' ? 'hidden' : 'read'),
  fieldPosition: field.listView?.fieldPosition ?? 'form',
},
```
So even though `itemView` later gets partially re-queried for item pages, `createView` and `listView` never do.

`src/features/cms/runtime.ts`
```ts
type FieldMeta {
  ...
  createView: CreateFieldViewMeta!
  itemView: ItemFieldViewMeta!
  listView: ListFieldViewMeta!
}
```

```ts
FieldMeta: {
  customViewsIndex: (field: AdminMetaField) => field.customViewsIndex ?? null,
  search: (field: AdminMetaField) => field.search ?? null,
},
CreateFieldViewMeta: {
  fieldMode: (view: GraphQLFieldView) => view.fieldMode,
  fieldPosition: (view: GraphQLFieldView) => view.fieldPosition,
},
ItemFieldViewMeta: {
  fieldMode: (view: GraphQLFieldView) => view.fieldMode,
  fieldPosition: (view: GraphQLFieldView) => view.fieldPosition,
},
ListFieldViewMeta: {
  fieldMode: (view: GraphQLFieldView) => view.fieldMode,
  fieldPosition: (view: GraphQLFieldView) => view.fieldPosition,
},
```
Resolvers are pass-through only; there is no opportunity for context/item-aware evaluation except the separate item-page query path already hand-built in the client.

`src/features/cms/graphql-client.ts`
```ts
keystone {
  adminMeta {
    list(key: $listKey) {
      fields {
        path
        isNonNull
        fieldMeta
        itemView(id: $id) {
          fieldMode
          fieldPosition
        }
      }
    }
  }
}
```
The item page already depends on runtime `itemView(id)` overrides, which makes the missing `createView`/`listView` runtime path the next obvious parity hole.

## Architecture
- `types.ts` defines Keystone-compatible field view config, including dynamic `fieldMode` functions.
- `admin-meta.ts` normalizes list/field config into `AdminMeta`, but currently flattens all view modes to static strings via `staticFieldMode`.
- `runtime.ts` exposes that normalized metadata through GraphQL.
- `admin-meta-query.ts` and `graphql-client.ts` consume the GraphQL metadata for dashboard list/create/item screens.
- The item page has a special-case runtime metadata fetch for `itemView(id)`, but there is no equivalent runtime evaluation for `createView` or `listView`, and the base admin meta payload still bakes in fallback values instead of actual dynamic results.

## Start Here
Open `src/features/cms/admin-meta.ts` first. That is where dynamic `fieldMode` support is lost before GraphQL ever sees it.

## Finding: next single concrete fixable gap
**Gap:** dynamic field view modes are not honored for `createView` and `listView` at all, and are only partially honored for `itemView`. This diverges from official Keystone semantics, where `fieldMode` may be a function for create/item/list UI contexts.

This is target-only work; no `../next-keystone-starter` changes are needed.

### Why this is the next fix
The items named in the task are already covered. The next remaining parity issue in the target is deeper than styling or labels: the dashboard can show/edit fields that Keystone would hide or mark read-only when a list/field uses function-valued `ui.createView.fieldMode`, `ui.itemView.fieldMode`, or `ui.listView.fieldMode`.

Today, any config like:
```ts
createView: { fieldMode: ({ session }) => session ? 'edit' : 'hidden' }
```
gets normalized to fallback `'edit'`/`'read'`/`'hidden'` instead of being evaluated.

### Exact target files to change
1. `src/features/cms/admin-meta.ts`
2. `src/features/cms/runtime.ts`
3. `src/features/cms/admin-meta-query.ts`
4. `src/features/cms/graphql-client.ts`
5. Potentially the route loaders that consume admin meta for create/list pages:
   - `src/routes/dashboard/$listKey.create.tsx`
   - `src/routes/dashboard/$listKey.tsx`

### Minimal implementation
1. **Stop collapsing dynamic view configs in `admin-meta.ts`.**
   - Keep `fieldPosition` static as today.
   - Introduce helpers to evaluate `FieldModeConfig` with context/item when GraphQL asks for `createView`, `itemView`, or `listView`.
   - For the static exported `adminMeta`, keep a safe fallback only for non-context use, but do not rely on it for dashboard runtime.

2. **Teach GraphQL field resolvers in `runtime.ts` to evaluate field views per request.**
   Minimal shape:
   - Add resolver methods on `FieldMeta` for `createView`, `itemView(id: ID)`, and `listView`.
   - `createView` evaluates `field.createView.fieldMode` with `{ context, session, item: undefined }`.
   - `itemView(id: ID)` evaluates against the loaded item.
   - `listView` evaluates with `{ context, session, item: undefined }`.
   - Preserve existing `fieldPosition` from config.

3. **Update GraphQL schema in `runtime.ts` if needed so `FieldMeta.createView/itemView/listView` can accept the args required for runtime evaluation**
   - At minimum `itemView(id: ID)` must be formally declared, since the client already queries it.
   - For full parity/minimal consistency, expose `createView: CreateFieldViewMeta!` and `listView: ListFieldViewMeta!` through resolvers that use request context.

4. **Refresh dashboard queries to request runtime-evaluated create/list view metadata where it matters.**
   - `admin-meta-query.ts`: if list/create pages depend on `createView` and list tables/field selectors depend on `listView`, query the runtime-resolved fields rather than trusting the static payload.
   - `graphql-client.ts`: keep normalizing `fieldPosition`, but consume the runtime values returned by GraphQL.

### Risk / note
- This is not just a client issue. The root cause is the server-side admin meta normalization throwing away function-valued `fieldMode`.
- The current code already hints at the right design with the extra item-page metadata fetch; the fix is to extend that pattern cleanly to all view contexts.
- Because `hideCreate`/`hideDelete` were already fixed to evaluate from context in `getAdminMetaForContext`, this dynamic-`fieldMode` gap is now the next most direct Keystone-semantic mismatch.
