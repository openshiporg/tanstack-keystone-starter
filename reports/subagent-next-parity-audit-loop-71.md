# Code Context

## Files Retrieved
1. `src/features/cms/runtime.ts` (lines 146-210, 1005-1051) - GraphQL adminMeta schema/resolvers define `CreateFieldViewMeta` and `ListFieldViewMeta`; they currently omit `fieldPosition` even though target admin meta query requests it.
2. `src/features/cms/admin-meta-query.ts` (lines 28-57) - target admin meta query explicitly requests `fieldPosition` for `createView`, `itemView`, and `listView`.
3. `src/features/cms/admin-meta.ts` (lines 32-68) - target in-memory admin meta already computes `fieldPosition` for all three view types, so the gap is in GraphQL exposure rather than source data.
4. `src/features/cms/types.ts` (lines 261-277) - target `AdminMetaField` type already expects `createView`, `itemView`, and `listView` to include `fieldPosition`.
5. `src/features/cms/graphql-client.ts` (lines 58-71) - target client normalizes `createView.fieldPosition` and `listView.fieldPosition`, showing the UI is already prepared to consume them.
6. `../next-keystone-starter/features/dashboard/actions/getAdminMetaAction.ts` (lines 45-68) - reference query already requests `fieldPosition` for all three view types.
7. `../next-keystone-starter/features/dashboard/types/index.ts` (lines 91-104) - reference field metadata only models `itemView.fieldPosition`, revealing the target is further along in types but still not exposing parity through GraphQL.
8. `src/components/dashboard/field-form-layout.tsx` (lines 3-12) and `src/components/dashboard/controller-fields.tsx` (lines 34-38) - target layout logic partitions fields by `fieldPosition`, so missing GraphQL exposure can prevent create/list/sidebar placement parity.

## Key Code
### Target adminMeta query already asks for `fieldPosition` everywhere
`src/features/cms/admin-meta-query.ts:38-49`
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

### Target admin meta source data already has the values
`src/features/cms/admin-meta.ts:51-67`
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

### But the GraphQL schema still omits `fieldPosition` on create/list view meta
`src/features/cms/runtime.ts:198-209`
```ts
type CreateFieldViewMeta {
  fieldMode: String!
}

type ItemFieldViewMeta {
  fieldMode: String!
  fieldPosition: String!
}

type ListFieldViewMeta {
  fieldMode: String!
}
```

### Resolvers also omit those fields
`src/features/cms/runtime.ts:1008-1017` and `src/features/cms/runtime.ts:1046-1051`
```ts
CreateFieldViewMeta: {
  fieldMode: (view: GraphQLFieldView) => view.fieldMode,
},
...
ListFieldViewMeta: {
  fieldMode: (view: GraphQLFieldView) => view.fieldMode,
},
```

### UI/layout code is ready to use `fieldPosition`
`src/components/dashboard/field-form-layout.tsx:3-10`
```ts
export function partitionFieldsByPosition(fields: DashboardField[], mode: 'createView' | 'itemView') {
  const form: DashboardField[] = []
  const sidebar: DashboardField[] = []
  for (const field of fields) {
    const view = field[mode]
    if (view.fieldMode === 'hidden') continue
    if (view.fieldPosition === 'sidebar') sidebar.push(field)
    else form.push(field)
  }
```

### Reference app expects these fields in adminMeta too
`../next-keystone-starter/features/dashboard/actions/getAdminMetaAction.ts:54-63`
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

## Architecture
- `src/features/cms/admin-meta.ts` builds the canonical admin meta object from list config, including `fieldPosition` for `createView`, `itemView`, and `listView`.
- `src/features/cms/runtime.ts` is the GraphQL bridge exposing that admin meta via `keystone.adminMeta`.
- `src/features/cms/admin-meta-query.ts` fetches admin meta from GraphQL and already requests all three `fieldPosition` values.
- `src/features/cms/graphql-client.ts` normalizes the response and defaults missing `createView/listView.fieldPosition` to `'form'`.
- UI layout code such as `src/components/dashboard/field-form-layout.tsx` and `src/components/dashboard/controller-fields.tsx` consumes `fieldPosition` to place fields in main vs sidebar regions.
- Because the runtime schema/resolvers omit `createView.fieldPosition` and `listView.fieldPosition`, the GraphQL layer cannot faithfully expose the metadata already present in the underlying admin meta object.

## Start Here
Open `src/features/cms/runtime.ts` first. It is the narrowest enforcement point and contains both halves of the bug: the GraphQL type definitions and the corresponding resolvers.

## Next single concrete fixable parity gap
**Gap:** the target app’s adminMeta GraphQL schema does not expose `fieldPosition` on `createView` and `listView`, even though:
- target source admin meta already computes those values,
- target client query already requests them,
- and the reference app’s admin meta query expects them.

This leaves a parity hole around adminMeta view metadata. It can silently force fallback-to-`form` behavior for create/list layouts and prevents exact Keystone-style metadata round-tripping.

### Minimal implementation
1. **Extend the GraphQL schema** in `src/features/cms/runtime.ts`:
   - add `fieldPosition: String!` to `CreateFieldViewMeta`
   - add `fieldPosition: String!` to `ListFieldViewMeta`

2. **Add resolvers** in `src/features/cms/runtime.ts` for both schema blocks:
```ts
CreateFieldViewMeta: {
  fieldMode: (view: GraphQLFieldView) => view.fieldMode,
  fieldPosition: (view: GraphQLFieldView) => view.fieldPosition,
},
...
ListFieldViewMeta: {
  fieldMode: (view: GraphQLFieldView) => view.fieldMode,
  fieldPosition: (view: GraphQLFieldView) => view.fieldPosition,
},
```

### Why this is the next fix
The previously listed singleton-routing and relationship parity items already appear fixed in the target:
- `src/routes/dashboard/$listKey.create.tsx:20-21` now redirects singleton create routes to `/dashboard/$listKey/$id` with `id: '1'`.
- `src/routes/dashboard/index.tsx:62-76` now points missing singleton entry cards at `/dashboard/$listKey/$id`.
- `src/components/dashboard/relationship-field-editor.tsx:116-124` now routes related singleton create CTAs to `/dashboard/$listKey/$id`.
- `src/components/dashboard/views/relationship-filter-input.tsx:109` and `src/components/dashboard/relationship-field-editor.tsx:109` already have the relationship “Load more related items” UX in place.

The next concrete, self-contained parity gap I found is therefore the adminMeta `fieldPosition` exposure mismatch at the runtime GraphQL boundary.

### Risk / constraint
This is low-risk because the backing data model and consuming code already support the field. The change is localized to GraphQL type/resolver exposure in `src/features/cms/runtime.ts`. No broader UI rewrite is needed.