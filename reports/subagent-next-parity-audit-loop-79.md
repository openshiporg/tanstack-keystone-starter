# Code Context

## Files Retrieved
1. `src/features/cms/admin-meta-query.ts` (lines 1-58) - target canonical admin meta GraphQL query shape.
2. `src/features/cms/admin-meta.ts` (lines 1-167) - target admin meta producer includes `initialFilter` and full view-scoped metadata.
3. `src/features/cms/types.ts` (lines 250-279) - target `AdminMetaField` shape requires `createView.fieldPosition/isRequired`, `itemView.fieldPosition/isRequired`, and `listView.fieldPosition`.
4. `../next-keystone-starter/features/dashboard/actions/getAdminMetaAction.ts` (lines 1-136) - next app’s admin meta fetcher; current parity gap source.
5. `../next-keystone-starter/features/dashboard/types/index.ts` (lines 141-197) - next app types show reduced view metadata and assume `initialFilter` exists.
6. `../next-keystone-starter/features/dashboard/utils/enhanceFields.ts` (lines 1-74) - next app only preserves partial `createView/itemView/listView` metadata from fetched admin meta.
7. `../next-keystone-starter/features/dashboard/actions/getItemValidationAction.ts` (lines 1-60) - next app compensates for missing `itemView` validation metadata with an extra query.
8. `../next-keystone-starter/features/dashboard/lib/buildWhereClause.ts` (lines 280-329) - next app already consumes `list.initialFilter`, so missing fetch parity matters.

## Key Code
Target query requests full admin meta view payloads and list initial filter:

`src/features/cms/admin-meta-query.ts:10-52`
```ts
          initialFilter
...
            createView {
              fieldMode
              fieldPosition
              isRequired
            }
            itemView {
              fieldMode
              fieldPosition
              isRequired
            }
            listView {
              fieldMode
              fieldPosition
            }
```

Target static admin meta shape also guarantees those fields:

`src/features/cms/admin-meta.ts:66-78`
```ts
    createView: {
      fieldMode: staticFieldMode(field.createView, field.kind === 'id' ? 'hidden' : 'edit'),
      fieldPosition: field.createView?.fieldPosition ?? 'form',
      isRequired: field.createView?.isRequired ?? field.validation?.isRequired ?? field.isNonNull?.[0] === true,
    },
    itemView: {
      fieldMode: staticFieldMode(field.itemView, 'edit'),
      fieldPosition: field.itemView?.fieldPosition ?? 'form',
      isRequired: field.itemView?.isRequired ?? field.validation?.isRequired ?? field.isNonNull?.[0] === true,
    },
    listView: {
      fieldMode: staticFieldMode(field.listView, field.kind === 'password' ? 'hidden' : 'read'),
      fieldPosition: field.listView?.fieldPosition ?? 'form',
    },
```

Next app still fetches a reduced subset:

`../next-keystone-starter/features/dashboard/actions/getAdminMetaAction.ts:16-61`
```ts
              initialSort {
                field
                direction
              }
              path
...
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

Next app types reflect the reduced shape:

`../next-keystone-starter/features/dashboard/types/index.ts:149-168`
```ts
  createView: {
    fieldMode: any
    isRequired: any
  }
  itemView: {
    fieldMode: any
    isRequired: any
    fieldPosition: 'form' | 'sidebar'
  }
  listView: {
    fieldMode: 'read' | 'hidden'
  }
```

Next app also rehydrates only partial view metadata when enhancing fields:

`../next-keystone-starter/features/dashboard/utils/enhanceFields.ts:43-59`
```ts
        createView: {
          fieldMode: field.createView?.fieldMode ?? null,
          isRequired: field.createView?.isRequired ?? false,
        },
        itemView: {
          fieldMode: field.itemView?.fieldMode ?? null,
          fieldPosition: field.itemView?.fieldPosition ?? null,
          isRequired: field.itemView?.isRequired ?? false,
        },
        listView: {
          fieldMode: field.listView?.fieldMode ?? null,
        },
```

## Architecture
In target, admin meta is the canonical source for list/page/filter UI metadata. The GraphQL admin-meta query, runtime schema, and in-memory admin meta producer all agree on a complete shape.

In `next-keystone-starter`, `getAdminMetaAction()` is the main metadata entry point used by dashboard pages, hooks, and relationship UI. That fetch currently underspecifies admin meta compared with target. The app partially works because:
- `getItemValidationAction.ts` does a second item-specific query to recover some `itemView` metadata.
- callers often default missing values in `enhanceFields.ts`.
- `buildWhereClause.ts` expects `initialFilter`, but `getAdminMetaAction.ts` never requests it.

So the next parity gap is not in downstream consumers first; it is the incomplete upstream admin meta fetch contract.

## Start Here
Open `../next-keystone-starter/features/dashboard/actions/getAdminMetaAction.ts` first. It is the narrowest upstream source of the parity drift and can be fixed without touching runtime behavior elsewhere first.

## Recommended next single parity fix
**Gap:** `next-keystone-starter` admin meta fetch is still missing canonical fields present in target: `initialFilter`, `createView.fieldPosition`, `createView.isRequired`, `itemView.isRequired`, and `listView.fieldPosition`.

**Why this is the next fix:**
- It is a single, concrete upstream parity gap.
- It aligns the fetched shape with target’s canonical admin meta contract.
- It removes the need for ad hoc fallbacks and extra metadata repair downstream.
- It directly supports the recently-fixed parity areas around view-scoped required metadata and create-view behavior.

## Minimal implementation
1. **Edit** `../next-keystone-starter/features/dashboard/actions/getAdminMetaAction.ts`
   - In the GraphQL query, add:
     - `initialFilter` next to `initialSort`
     - `fieldPosition` and `isRequired` under `createView`
     - `isRequired` under `itemView`
     - `fieldPosition` under `listView`

   Minimal query diff conceptually:
   ```ts
   initialSort {
     field
     direction
   }
   initialFilter
   ...
   createView {
     fieldMode
     fieldPosition
     isRequired
   }
   itemView {
     fieldMode
     fieldPosition
     isRequired
   }
   listView {
     fieldMode
     fieldPosition
   }
   ```

2. **Likely follow-up in same change for type parity**: update `../next-keystone-starter/features/dashboard/types/index.ts`
   - add `fieldPosition` to `createView`
   - add `fieldPosition` to `listView`
   - keep `isRequired` on both `createView` and `itemView`

3. **Optional but consistent**: update `../next-keystone-starter/features/dashboard/utils/enhanceFields.ts`
   - preserve `createView.fieldPosition`
   - preserve `listView.fieldPosition`
   so the enhanced field object continues to match fetched admin meta.

## Risk / constraints
- Low risk: this is additive metadata requested from Keystone admin meta and should already be supported by the upstream schema.
- If only the query file is changed, TypeScript/runtime consumers may still silently drop new properties; that is why the matching type/enhanceFields updates are the minimal complete implementation.
- This is a cleaner next step than more downstream fixes because multiple dashboard features depend on admin meta shape fidelity.
