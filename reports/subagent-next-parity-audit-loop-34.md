# Code Context

## Files Retrieved
1. `src/routes/dashboard/$listKey.create.tsx` (lines 1-104) - target create route logic; currently forces `itemView.fieldMode = 'edit'` and relies on item-view editability to decide which create fields render.
2. `src/components/dashboard/field-value-editor.tsx` (lines 1-187) - target field editability gate; `isEditableDashboardField()` only checks `itemView.fieldMode === 'edit'`.
3. `src/components/dashboard/controller-fields.tsx` (lines 1-53) - target renderer for create/item forms using controller-backed fields.
4. `src/components/dashboard/field-form-layout.tsx` (lines 1-47) - target grouping/position logic for visible create/item fields.
5. `src/features/cms/graphql-client.ts` (lines 327-382) - target list/item data fetching; useful to rule out list/item parity items already addressed.
6. `src/components/dashboard/page-container.tsx` (lines 1-55) - target page container already has right sidebar trigger parity.
7. `src/components/dashboard/page-breadcrumbs.tsx` (lines 1-48) - target item/create header already has actions plus right sidebar trigger parity.
8. `../next-keystone-starter/features/dashboard/screens/CreatePage/CreatePageClient.tsx` (lines 1-188) - source create screen uses Keystone-style `Fields` with `view="createView"`, so create visibility/editability are driven by create view, not item view.
9. `../next-keystone-starter/features/dashboard/components/Fields.tsx` (lines 1-260) - source renderer resolves `field[view]?.fieldMode` dynamically for `createView` or `itemView`.
10. `../next-keystone-starter/features/dashboard/components/ListTable.tsx` (lines 1-333) - source list table already matches supportLinkTo/view registry parity.
11. `../next-keystone-starter/features/dashboard/lib/sort.ts` (lines 1-200) - source initialSort fallback logic already matched in target.
12. `../next-keystone-starter/features/dashboard/components/PageBreadcrumbs.tsx` (lines 1-66) - source breadcrumb header pattern; target already matches right-trigger parity.
13. `../next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx` (lines 260-563) - source item page uses view-aware field rendering and grouped layouts; helped isolate remaining create-only gap.

## Key Code

### Confirmed already-fixed parity areas
- List cell view registry / `supportsLinkTo` fallback exists in target:
  - `src/components/dashboard/views/registry.tsx` (lines 106-143)
  - `src/components/dashboard/keystone-list-table.tsx` (lines 1-260)
- `initialSort` fallback exists in target:
  - `src/features/cms/graphql-client.ts` (lines 299-325, 327-382)
- Header right trigger parity exists:
  - `src/components/dashboard/page-container.tsx` (lines 1-55)
  - `src/components/dashboard/page-breadcrumbs.tsx` (lines 1-48)
- Item visible fields/controller renderer exists:
  - `src/routes/dashboard/$listKey.$id.tsx` (lines 1-169)
  - `src/components/dashboard/controller-fields.tsx` (lines 1-53)

### Next concrete parity gap: create form still uses item-view editability semantics
Target currently mutates fields to fake item-view editability during create:

`src/routes/dashboard/$listKey.create.tsx:33-39`
```ts
const editableFields = useMemo(
  () =>
    list.fields
      .filter((field) => field.path !== 'id' && field.createView.fieldMode !== 'hidden')
      .map((field) => withFieldController({ ...field, itemView: { ...field.itemView, fieldMode: 'edit' } }))
      .filter((field) => field.controller.isEditable(field)),
  [list.fields],
)
```

But target controller editability only knows about item view:

`src/components/dashboard/field-value-editor.tsx:16`
```ts
export function isEditableDashboardField(field: DashboardField) {
  return field.path !== 'id' && field.itemView.fieldMode === 'edit' && [/* kinds */].includes(field.kind)
}
```

This is a parity risk because create-mode visibility/editability in Keystone source is resolved against `createView`, not `itemView`:

`../next-keystone-starter/features/dashboard/components/Fields.tsx:63-81`
```ts
const fieldModeFilter = field[view]?.fieldMode || 'edit'
...
if (testFilter(fieldModeFilter?.edit, serialized)) fieldMode = 'edit'
else if (view === 'itemView' && testFilter(fieldModeFilter?.read, serialized)) fieldMode = 'read'
else fieldMode = 'hidden'
```

And source create page passes `view="createView"` directly:

`../next-keystone-starter/features/dashboard/screens/CreatePage/CreatePageClient.tsx:159-184`
```tsx
<Fields {...createItem.props} fields={fieldsSplit.sidebarFields} view="createView" groups={list.groups} />
...
<Fields {...createItem.props} fields={fieldsSplit.mainFields} view="createView" groups={list.groups} />
```

## Architecture
- Target list/item/create pages all consume normalized admin meta from `src/features/cms/graphql-client.ts`.
- List page parity work is largely done: view-registry cell rendering, link support fallback, and initial sort resolution are in place.
- Item page uses controller-backed fields plus layout grouping and no longer appears to be the main parity gap.
- Create page diverges architecturally: instead of a renderer/controller that understands current view mode, it reuses item-view editability by overwriting `itemView.fieldMode` to `'edit'`.
- That workaround can mis-handle fields where create/item semantics differ, especially if future metadata includes `createView: read/hidden/edit` distinctions, per-view positioning, or stricter parity with Keystone field rendering.

## Start Here
Open `src/routes/dashboard/$listKey.create.tsx` first. It contains the remaining workaround causing create-mode parity drift and points directly to the minimal fix surface.

## Minimal implementation
Single fixable parity gap:

1. **Make field controller editability view-aware for create pages.**
   - Update `src/components/dashboard/field-value-editor.tsx`
     - Change `isEditableDashboardField()` to accept a view mode parameter, e.g. `'createView' | 'itemView'`.
     - Check `field[view].fieldMode === 'edit'` instead of hardcoding `itemView`.
   - Update `src/components/dashboard/field-controllers.tsx`
     - Add optional `view` parameter to `FieldController.isEditable()` and `getFieldController()`/`withFieldController()` plumbing, or create a create-specific wrapper.
   - Update `src/routes/dashboard/$listKey.create.tsx`
     - Stop mutating `itemView.fieldMode`.
     - Filter editable fields via create view directly, e.g. `field.controller.isEditable(field, 'createView')`.

This is the smallest parity correction because it preserves the existing controller-based target architecture while removing the create-page workaround.

## Exact files to change
- `src/components/dashboard/field-value-editor.tsx`
- `src/components/dashboard/field-controllers.tsx`
- `src/routes/dashboard/$listKey.create.tsx`

## Why this is the next best fix
Everything named in the audit prompt appears covered already in target except create-mode parity is still implemented via a workaround instead of true view-aware behavior. That makes it the next concrete, isolated, low-risk fix.