# Code Context

## Files Retrieved
1. `src/features/cms/runtime.ts` (lines 182-208) - GraphQL schema defines `FieldMeta.createView`, `itemView`, and `listView` as plain object fields with no arguments.
2. `src/features/cms/runtime.ts` (lines 998-1016, 1036-1054) - runtime resolvers for `CreateFieldViewMeta`, `ItemFieldViewMeta`, and `ListFieldViewMeta` only echo static values already embedded in admin meta.
3. `src/features/cms/admin-meta.ts` (lines 27-68) - `toAdminMetaField()` freezes `createView`, `itemView`, and `listView` with `staticFieldMode(...)`, so function-valued field view config is collapsed to defaults.
4. `src/features/cms/graphql-client.ts` (lines 454-482) - item page query asks for `itemView(id: $id)`, expecting request/item-aware field view resolution.
5. `../next-keystone-starter/features/dashboard/actions/getAdminMetaAction.ts` (lines 1-61) - comparison app only fetches static admin meta for list bootstrap; it does not have this target’s extra dynamic itemView query path.

## Key Code
Current target schema exposes static field-view metadata only:

```ts
// src/features/cms/runtime.ts
 type FieldMeta {
   path: String!
   label: String!
   description: String
   fieldMeta: JSON
   isOrderable: Boolean!
   isFilterable: Boolean!
   viewsIndex: Int!
   customViewsIndex: Int
   search: String
   isNonNull: [Boolean!]!
   createView: CreateFieldViewMeta!
   itemView: ItemFieldViewMeta!
   listView: ListFieldViewMeta!
 }
```

But the client already assumes Keystone-style dynamic item view evaluation:

```ts
// src/features/cms/graphql-client.ts
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

The admin-meta builder currently strips away dynamic fieldMode functions:

```ts
// src/features/cms/admin-meta.ts
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

And resolvers only return those static values:

```ts
// src/features/cms/runtime.ts
CreateFieldViewMeta: {
  fieldMode: (view) => view.fieldMode,
},
ItemFieldViewMeta: {
  fieldMode: (view) => view.fieldMode,
  fieldPosition: (view) => view.fieldPosition,
},
ListFieldViewMeta: {
  fieldMode: (view) => view.fieldMode,
},
```

## Architecture
- `admin-meta.ts` converts `CmsList`/`CmsField` config into transportable `AdminMeta`.
- `runtime.ts` publishes that metadata through GraphQL under `keystone.adminMeta`.
- `graphql-client.ts` uses `adminMeta` twice:
  - static bootstrap for list/index pages
  - dynamic item-page follow-up query for per-item `itemView(id: $id)` overrides
- Today those two layers disagree:
  - schema does **not** define `itemView(id: ID!)`
  - metadata generation precomputes only static view modes
  - client already queries dynamic view state.

This is a real parity/runtime gap inside the target only, and it is more concrete than broader comparison-only differences.

## Start Here
Open `src/features/cms/runtime.ts` first. The schema and resolver contract for `FieldMeta.itemView` is currently incompatible with the query already issued by `src/features/cms/graphql-client.ts`.

## Findings
### Next concrete fixable gap
**Request/item-aware field view metadata is not implemented, despite the target client already querying it.**

Why this is the next gap:
- It is entirely inside the target repo.
- It is directly fixable with a small runtime/admin-meta change.
- It aligns with official Keystone semantics: field view mode can depend on request/session/item, especially on item pages.
- The current target likely throws a GraphQL validation error for `itemView(id: $id)` because `FieldMeta.itemView` is declared with no args.

### Minimal implementation
1. **Add field-view args types to GraphQL schema in `src/features/cms/runtime.ts`.**
   - Change `FieldMeta` so:
     - `createView` accepts no args or optionally request-aware args
     - `itemView(id: ID): ItemFieldViewMeta!`
     - `listView` remains static unless you also want full parity later
   - Minimal safe change: support `itemView(id: ID)` only, because that is already queried.

2. **Resolve `itemView.fieldMode` dynamically in `src/features/cms/runtime.ts`.**
   - In the `FieldMeta.itemView` resolver, look up the actual `CmsField` definition by list key/path.
   - If `field.itemView?.fieldMode` is a function, fetch the item by `id` from context.adapter and call it with `{ context, session: context.session, item }`.
   - Fall back to existing static/default mode when no function is configured or item missing.
   - Return `{ fieldMode, fieldPosition }`.

3. **Preserve enough source metadata to evaluate dynamic view mode.**
   - Easiest minimal path: in the `FieldMeta` resolver, do not rely solely on the flattened `AdminMetaField`; instead rehydrate from `cmsLists` by parent list + field path.
   - If needed, add parent list key/path context when returning `fields` from `ListMeta`.

### Exact target files
- `src/features/cms/runtime.ts`
- Possibly `src/features/cms/admin-meta.ts` only if you choose to carry extra identifiers, but the smaller fix is to keep admin-meta transport static and compute dynamic `itemView` in GraphQL resolvers.

## Risks / constraints
- `AdminMeta.list(key: ...)` exists already, so the missing piece is not list lookup but dynamic field-view resolution.
- Avoid changing `../next-keystone-starter`; this gap is local to the target.
- Be careful not to break current static admin-meta consumers; keep top-level list bootstrap fields backward-compatible.
- If you later extend parity further, `createView` and `listView` may also need request-aware resolver treatment, but `itemView(id: $id)` is the immediate broken contract.
