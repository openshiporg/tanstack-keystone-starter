# Code Context

## Files Retrieved
1. `src/components/dashboard/field-value-editor.tsx` (lines 1-76) - target editability logic only treats fields as editable when `field[view].fieldMode === 'edit'` and validates required-ness from static `fieldMeta`, not runtime view metadata.
2. `src/components/dashboard/field-controllers.tsx` (lines 1-33) - target controller wrapper delegates editability and validation to the simplified field-value editor helpers.
3. `src/routes/dashboard/$listKey.create.tsx` (lines 33-44) - target create page builds editable fields from `field.createView.fieldMode !== 'hidden'`, so `read` fields still render in the form and required state cannot come from view metadata.
4. `src/routes/dashboard/$listKey.$id.tsx` (lines 64-79) - target item page merges runtime `itemView` overrides, but downstream editability/validation still ignore Keystone-style dynamic view metadata.
5. `src/features/cms/types.ts` (lines 1-16) - target types allow `FieldModeConfig` functions, but the UI layer does not support Keystone’s richer controller semantics.
6. `../next-keystone-starter/features/dashboard/components/Fields.tsx` (lines 1-102) - reference app supports Keystone-style conditional `fieldMode` filters and `isRequired` evaluation via `testFilter(...)`.
7. `../next-keystone-starter/features/dashboard/utils/enhanceFields.ts` (lines 41-65) - reference enhanced fields preserve `createView.isRequired` and `itemView.isRequired` alongside view metadata.
8. `../next-keystone-starter/features/dashboard/utils/useCreateItem.ts` (lines 50-63) - reference create flow validates fields using `createView.isRequired` instead of only static schema rules.
9. `../next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx` (lines 141-176, 277-298) - reference item page computes `isRequireds` from adminMeta/item-specific metadata before validation.
10. `../next-keystone-starter/features/dashboard/actions/getItemValidationAction.ts` (lines 11-58) - reference fetches runtime item metadata and maps it into per-field validation/editability inputs.

## Key Code
Target editability is hard-coded to string mode equality:

```ts
// src/components/dashboard/field-value-editor.tsx:13-16
export function isEditableDashboardField(field: DashboardField, view: DashboardFieldEditView = 'itemView') {
  return field.path !== 'id' && field[view].fieldMode === 'edit' && ['text', 'password', 'json', 'document', 'image', 'file', 'select', 'multiselect', 'checkbox', 'integer', 'float', 'decimal', 'timestamp', 'bigInt', 'relationship'].includes(field.kind)
}
```

Target required validation is also derived only from static schema metadata:

```ts
// src/components/dashboard/field-value-editor.tsx:52-57
export function requiredFieldMessage(field: DashboardField) {
  const validation = field.fieldMeta.validation
  const validationRecord = validation && typeof validation === 'object' && !Array.isArray(validation) ? validation as { isRequired?: unknown } : undefined
  if (field.isNonNull[0] === true || validationRecord?.isRequired === true) return `${field.label} is required.`
  return null
}
```

Target create page only excludes `hidden`, so `read` fields are still included in the form pipeline:

```ts
// src/routes/dashboard/$listKey.create.tsx:36-40
const editableFields = useMemo(
  () =>
    list.fields
      .filter((field) => field.path !== 'id' && field.createView.fieldMode !== 'hidden')
      .map((field) => withFieldController(field, 'createView'))
      .filter((field) => field.controller.isEditable(field)),
```

Reference app keeps Keystone-style dynamic view metadata and required filters alive in the form system:

```ts
// ../next-keystone-starter/features/dashboard/utils/enhanceFields.ts:46-58
createView: {
  fieldMode: field.createView?.fieldMode ?? null,
  isRequired: field.createView?.isRequired ?? false,
},
itemView: {
  fieldMode: field.itemView?.fieldMode ?? null,
  fieldPosition: field.itemView?.fieldPosition ?? null,
  isRequired: field.itemView?.isRequired ?? false,
},
```

```ts
// ../next-keystone-starter/features/dashboard/components/Fields.tsx:67-91
const fieldModeFilter = field[view]?.fieldMode || 'edit'
let fieldMode: 'read' | 'edit' | 'hidden'

if (typeof fieldModeFilter === 'string') {
  fieldMode = fieldModeFilter as 'read' | 'edit' | 'hidden'
} else {
  if (testFilter(fieldModeFilter?.edit, serialized)) fieldMode = 'edit'
  else if (view === 'itemView' && testFilter(fieldModeFilter?.read, serialized)) fieldMode = 'read'
  else fieldMode = 'hidden'
}
...
isRequired={testFilter(isRequireds?.[fieldPath] ?? false, serialized)}
```

```ts
// ../next-keystone-starter/features/dashboard/utils/useCreateItem.ts:51-56
const isRequireds = useMemo(() => {
  if (!enhancedFields) return {}
  return Object.fromEntries(
    Object.entries(enhancedFields).map(([key, field]: [string, any]) => [
      key,
      field.createView?.isRequired || false
```

## Architecture
- In the target, `src/features/cms/runtime.ts` and `src/features/cms/graphql-client.ts` now provide view metadata, but the final dashboard controller layer does not consume Keystone-style runtime validation/editability semantics.
- The target form stack is: route (`$listKey.create.tsx` / `$listKey.$id.tsx`) -> `withFieldController()` -> `isEditableDashboardField()` / `validateDraftValue()` in `field-value-editor.tsx`.
- That stack only understands plain string `fieldMode` and static required rules from `fieldMeta.validation` / `isNonNull`.
- In the reference app, `enhanceFields.ts` preserves view-scoped metadata, `Fields.tsx` evaluates conditional field-mode filters, and create/item hooks compute `isRequireds` from adminMeta before validation.
- So even after the server-side metadata fixes, the target still cannot honor Keystone-style runtime `isRequired` and conditional view-mode behavior at the form/controller layer.

## Start Here
Open `src/components/dashboard/field-value-editor.tsx` first. That is the narrowest point where the target still collapses Keystone dashboard semantics into static string editability and static required validation.

## Finding: next single concrete fixable gap
**Gap:** target dashboard forms still ignore Keystone-style view-scoped required/editability metadata (`createView.isRequired`, item-specific required state, and conditional/non-string `fieldMode` behavior) that the reference dashboard form system supports.

This remains user-visible after the recent parity fixes because fields can still be validated or rendered using static schema assumptions instead of the per-view/per-item admin metadata Keystone-style dashboard code expects.

### Why this is the next fix
The named fixes in the task are already reflected elsewhere. The next concrete parity hole is now in the last-mile form controller layer:
- server/runtime metadata can say a field is read-only or conditionally required in a given view,
- but target create/item forms still decide editability with `fieldMode === 'edit'`,
- and still decide required-ness with static `fieldMeta.validation` / `isNonNull` only.

That is a smaller, more actionable parity gap than deeper storage/model work, and it is directly comparable to the reference app’s dashboard behavior.

### Exact files to change
1. `src/components/dashboard/field-value-editor.tsx`
2. `src/components/dashboard/field-controllers.tsx`
3. `src/routes/dashboard/$listKey.create.tsx`
4. `src/routes/dashboard/$listKey.$id.tsx`
5. `src/features/cms/graphql-client.ts` (only if a small type extension is needed for runtime `isRequired` metadata)
6. Potentially `src/components/dashboard/controller-fields.tsx` if the chosen implementation passes `isRequireds` through grouped field rendering.

### Minimal implementation
1. **Add a Keystone-style field-mode resolver in the target dashboard form layer.**
   - In `src/components/dashboard/field-value-editor.tsx`, replace direct `field[view].fieldMode === 'edit'` checks with a helper that resolves `'edit' | 'read' | 'hidden'` from the current view metadata.
   - Keep the minimal target shape if you want: support plain strings first, but also safely handle any future non-string/object form by falling back to read/hidden rules instead of assuming edit.

2. **Move required validation to view-aware metadata.**
   - Stop using only `field.fieldMeta.validation` / `field.isNonNull[0]` in `requiredFieldMessage()`.
   - Thread per-view required state from route-level field metadata into validation, similar to the reference app’s `isRequireds` map.
   - For create forms, derive required state from `createView` metadata.
   - For item forms, derive required state from runtime item metadata already fetched for `itemView(id: $id)`.

3. **Use resolved field mode when assembling editable form fields.**
   - In `src/routes/dashboard/$listKey.create.tsx`, do not include fields based only on `!== 'hidden'`; require resolved mode `'edit'`.
   - Apply the same rule to singleton-create flow in `src/routes/dashboard/$listKey.$id.tsx`.

4. **Preserve read-only visible fields separately if desired.**
   - If target UX should show read-only fields on item pages, keep them in `allVisibleFields` but filter `editableFields` strictly by resolved mode `'edit'`.

### Risk / note
- This is a dashboard/controller parity gap, not a Prisma/GraphQL operator gap.
- The server-side adminMeta work already done will not fully matter until the form layer stops collapsing everything into static editability + static required validation.
- If the target currently does not expose explicit `isRequired` in its `DashboardField` shape, the smallest compatible bridge is to compute it from existing runtime metadata and pass it alongside the field objects at route/component level, rather than redesigning the whole CMS type system first.
