# Code Context

## Files Retrieved
1. `src/routes/dashboard/$listKey.create.tsx` (lines 36-40) - create screen derives editable fields by force-overriding `itemView.fieldMode` to `'edit'`, bypassing `createView.fieldMode` semantics.
2. `src/routes/dashboard/$listKey.$id.tsx` (lines 232-236) - singleton-create fallback repeats the same create-view override bug.
3. `src/components/dashboard/field-value-editor.tsx` (lines 13-16) - shared editability helper only checks `itemView.fieldMode`, so create flows cannot respect `createView: { fieldMode: 'read' }`.
4. `src/components/dashboard/field-controllers.tsx` (lines 17-27) - all route code gets `controller.isEditable()` from this shared helper, so the bug is centralized/fixable in target.
5. `src/components/dashboard/controller-fields.tsx` (lines 32-57) - create/item rendering already takes a `view: 'createView' | 'itemView'`, showing the UI layer is view-aware and the gap is specifically editability gating.
6. `src/components/dashboard/field-form-layout.tsx` (lines 3-11) - field placement already honors the requested view (`createView` vs `itemView`), reinforcing that create-mode fieldMode should also be view-specific.
7. `src/features/cms/runtime.ts` (lines 184-210, 1008-1023) - GraphQL schema/resolvers already expose distinct `createView`, `itemView(id)`, and `listView` metadata, so backend semantics are present.
8. `../next-keystone-starter/features/dashboard/components/Fields.tsx` (lines 61-83) - reference implementation chooses field mode from the active `view`, matching official Keystone semantics.

## Key Code
Target create route currently treats every non-hidden create field as editable:

```ts
// src/routes/dashboard/$listKey.create.tsx:36-40
list.fields
  .filter((field) => field.path !== 'id' && field.createView.fieldMode !== 'hidden')
  .map((field) => withFieldController({ ...field, itemView: { ...field.itemView, fieldMode: 'edit' } }))
  .filter((field) => field.controller.isEditable(field))
```

Singleton-create fallback does the same:

```ts
// src/routes/dashboard/$listKey.$id.tsx:233-236
data.list.fields
  .filter((field) => field.path !== 'id' && field.createView.fieldMode !== 'hidden')
  .map((field) => withFieldController({ ...field, itemView: { ...field.itemView, fieldMode: 'edit' } }))
  .filter((field) => field.controller.isEditable(field))
```

But shared editability logic ignores `createView` entirely:

```ts
// src/components/dashboard/field-value-editor.tsx:13-16
export function isEditableDashboardField(field: DashboardField) {
  return field.path !== 'id' && field.itemView.fieldMode === 'edit' && [...].includes(field.kind)
}
```

That helper is wired into every controller:

```ts
// src/components/dashboard/field-controllers.tsx:17-23
isEditable: (candidate) => isEditableDashboardField(candidate),
```

Reference behavior is view-aware instead of hardcoding item-view logic:

```ts
// ../next-keystone-starter/features/dashboard/components/Fields.tsx:67-78
const fieldModeFilter = field[view]?.fieldMode || 'edit'
...
if (typeof fieldModeFilter === 'string') {
  fieldMode = fieldModeFilter
}
```

## Architecture
- Backend admin-meta/runtime is already correct enough to expose separate create/item/list field modes.
- Dashboard rendering is also mostly view-aware: `ControllerFields` and `partitionFieldsByPosition()` accept the active view and hide fields accordingly.
- The remaining mismatch is the editability gate used when constructing create-form fields:
  - routes gather fields for create,
  - `withFieldController()` attaches a generic controller,
  - `controller.isEditable()` delegates to `isEditableDashboardField()`,
  - that helper only inspects `itemView.fieldMode`.
- To compensate, the create routes mutate `itemView.fieldMode` to `'edit'`, which accidentally makes `createView: { fieldMode: 'read' }` impossible to honor.

## Start Here
Open `src/components/dashboard/field-value-editor.tsx` first. The core parity gap is centralized there: editability is hardcoded to `itemView`, forcing route-level hacks in create flows.

## Findings
### Next concrete fixable gap
**Create forms do not honor `createView.fieldMode: 'read'`; they force such fields to be editable.**

This is a target-only gap and does not require changing `../next-keystone-starter`.

Why this matters under Keystone semantics:
- Keystone treats `createView` and `itemView` as separate view configs.
- A field may be visible on create but read-only there (`createView.fieldMode = 'read'`).
- Current target code collapses that distinction by rewriting `itemView.fieldMode` to `'edit'` during create flows.

Observable consequence:
- Any field configured as `createView: { fieldMode: 'read' }` will still render as editable in:
  - `/dashboard/$listKey/create`
  - singleton create fallback in `/dashboard/$listKey/$id` when the singleton item does not exist.

## Minimal implementation
1. Make editability view-aware instead of hardcoded to `itemView`.
   - Update `src/components/dashboard/field-value-editor.tsx` so the helper can evaluate either `createView` or `itemView`.
   - Minimal shape: add a `view: 'createView' | 'itemView'` parameter and check `field[view].fieldMode === 'edit'`.

2. Thread that through controller creation.
   - Update `src/components/dashboard/field-controllers.tsx` so `getFieldController()` / `withFieldController()` can be created for a specific view, and `isEditable()` uses that active view.

3. Remove the create-route hack.
   - In `src/routes/dashboard/$listKey.create.tsx`, stop overwriting `itemView.fieldMode` to `'edit'`; instead call `withFieldController(field, 'createView')` or equivalent.
   - Do the same in `src/routes/dashboard/$listKey.$id.tsx` for `SingletonCreateForm`.

That is the smallest targeted change that restores official Keystone create-view semantics while leaving the already-fixed request-aware admin meta/runtime work intact.