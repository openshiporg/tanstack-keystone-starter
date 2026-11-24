# Code Context

## Files Retrieved
1. `src/features/cms/admin-meta.ts` (lines 1-119) - builds request-aware `AdminMeta` and currently computes static view metadata, showing `createView`, `itemView`, and `listView` all carry `fieldPosition` in the in-memory type.
2. `src/features/cms/types.ts` (lines 201-296) - defines `AdminMetaField` and confirms all three view metas include `fieldPosition: 'form' | 'sidebar'`.
3. `src/features/cms/runtime.ts` (lines 140-208, 995-1054) - GraphQL schema/resolvers expose `CreateFieldViewMeta`, `ItemFieldViewMeta`, and `ListFieldViewMeta`; `fieldPosition` is already part of the GraphQL types for item/create/list view metadata support.
4. `src/features/cms/admin-meta-query.ts` (lines 1-53) - client query for admin meta currently requests `itemView.fieldPosition` only, omitting `createView.fieldPosition` and `listView.fieldPosition`.
5. `src/features/cms/graphql-client.ts` (lines 137-169) - normalization layer already expects `createView.fieldPosition` and `listView.fieldPosition`, but falls back to `'form'` when absent.
6. `src/components/dashboard/field-form-layout.tsx` (lines 1-43) - rendering/layout helper actually uses `field[mode].fieldPosition` to split fields into form vs sidebar.
7. `src/components/dashboard/controller-fields.tsx` (lines 1-64) - create/item forms call `partitionFieldsByPosition`, so missing `createView.fieldPosition` changes visible layout behavior.
8. `src/components/dashboard/enhance-fields.tsx` (lines 1-70) - enhanced field objects preserve `createView.fieldPosition` and `listView.fieldPosition`, confirming the client is built to consume them.
9. `src/routes/dashboard/$listKey.create.tsx` (lines 1-80) - create route uses controller-backed fields/groups, so the missing `createView.fieldPosition` metadata directly affects the create screen.
10. `../next-keystone-starter/features/dashboard/actions/getAdminMetaAction.ts` (lines 1-95) - comparison app has the same omission in its admin meta query, so this is not a reason to edit that app; target can fix it independently.

## Key Code
`src/features/cms/types.ts` defines the contract the client is supposed to receive:

```ts
export type AdminMetaField = ... & {
  createView: { fieldMode: FieldMode; fieldPosition: 'form' | 'sidebar' }
  itemView: { fieldMode: FieldMode; fieldPosition: 'form' | 'sidebar' }
  listView: { fieldMode: FieldMode; fieldPosition: 'form' | 'sidebar' }
}
```

`src/features/cms/admin-meta.ts` already constructs those values:

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

But `src/features/cms/admin-meta-query.ts` does not fetch the full shape:

```ts
createView {
  fieldMode
}
itemView {
  fieldMode
  fieldPosition
}
listView {
  fieldMode
}
```

`src/features/cms/graphql-client.ts` shows the consequence: the client silently invents defaults when those properties are missing:

```ts
const createView = field.createView as unknown as { fieldPosition?: 'form' | 'sidebar' }
const listView = field.listView as unknown as { fieldPosition?: 'form' | 'sidebar' }
...
createView: { ...field.createView, fieldPosition: createView.fieldPosition ?? 'form' },
listView: { ...field.listView, fieldPosition: listView.fieldPosition ?? 'form' },
```

And the create/item layout depends on the real server-provided value:

```ts
if (view.fieldPosition === 'sidebar') sidebar.push(field)
else form.push(field)
```

## Architecture
The data path is:

1. `getAdminMetaForContext()` / `toAdminMetaField()` in `src/features/cms/admin-meta.ts` computes per-field view metadata.
2. `cmsResolvers` in `src/features/cms/runtime.ts` expose that metadata through GraphQL.
3. `adminMetaGraphQLQuery` in `src/features/cms/admin-meta-query.ts` chooses which view properties actually reach the dashboard client.
4. `fetchKeystoneAdminMeta()` / `normalizeAdminMeta()` in `src/features/cms/graphql-client.ts` normalize the payload.
5. `enhanceFields()` + `partitionFieldsByPosition()` drive create/item form layout.

So the server already knows `createView.fieldPosition` and `listView.fieldPosition`; the only broken step is the client query shape. Because of that, any field configured for sidebar placement in create view is flattened back into the form column in the dashboard.

## Start Here
Open `src/features/cms/admin-meta-query.ts` first. It is the narrowest, concrete parity gap: the query under-fetches metadata that the runtime already exposes and the client already expects.

## Finding: next concrete fixable gap
**Gap:** `adminMetaGraphQLQuery` omits `createView.fieldPosition` and `listView.fieldPosition`, so dashboard admin meta hydration loses valid Keystone-style view placement metadata and falls back to `'form'` client-side.

This is a target-only fix. `../next-keystone-starter` appears to share the same omission, but per instruction it should not be recommended for editing.

### Why this is a real bug
- Target types say all view metas include `fieldPosition`.
- Runtime/admin-meta builder already computes those positions.
- Dashboard create/item layout code uses `fieldPosition` to place fields in the sidebar.
- The GraphQL query drops two of the three fields, causing incorrect layout whenever a field is configured with `createView.fieldPosition: 'sidebar'` or if list-view placement metadata is later consumed.

### Minimal implementation
Update `src/features/cms/admin-meta-query.ts` to request the missing properties:

```ts
createView {
  fieldMode
  fieldPosition
}
itemView {
  fieldMode
  fieldPosition
}
listView {
  fieldMode
  fieldPosition
}
```

No runtime/schema change is needed; `src/features/cms/runtime.ts` and `src/features/cms/admin-meta.ts` already support this shape.

### Risk / scope
Low risk. This is a query-shape fix only:
- no schema change
- no mutation behavior change
- no adapter/database impact
- immediately improves fidelity for existing sidebar field configuration in create views

### Open question
None blocking. The codebase already models the full shape; the query is just incomplete.