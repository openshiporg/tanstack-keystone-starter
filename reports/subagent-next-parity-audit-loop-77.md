# Code Context

## Files Retrieved
1. `src/components/dashboard/controller-fields.tsx` (lines 1-63) - shared renderer for create/item form labels; currently decides whether to show the required asterisk.
2. `src/components/dashboard/field-value-editor.tsx` (lines 55-68) - required validation already resolves against view-aware metadata via `requiredFieldMessage(field, view)`.
3. `src/routes/dashboard/$listKey.create.tsx` (lines 35-60) - create page uses controller-backed fields and relies on shared label rendering from `ControllerFields`.
4. `src/routes/dashboard/$listKey.$id.tsx` (lines 232-250) - singleton create flow also uses the same controller-backed shared form renderer.
5. `src/features/cms/graphql-client.ts` (lines 145-156) - normalized admin meta preserves `createView.isRequired` and `itemView.isRequired` on dashboard fields.
6. `src/features/cms/admin-meta.ts` (lines 49-63, 75-82) - server/admin meta builds `createView.isRequired` and `itemView.isRequired` from Keystone semantics before the client consumes them.
7. `../next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx` (lines 277-290) - reference app builds per-view `isRequireds` from `itemView.isRequired`, reinforcing that requiredness is view-specific metadata.
8. `../next-keystone-starter/features/dashboard/utils/useCreateItem.ts` (lines 50-58) - reference create flow likewise uses `createView.isRequired` instead of generic non-null metadata.

## Key Code

### Target already has view-aware required metadata
`src/features/cms/graphql-client.ts:147-156`
```ts
const fields = list.fields.map((field) => {
  const createView = field.createView as unknown as { fieldPosition?: 'form' | 'sidebar'; isRequired?: boolean }
  const itemView = field.itemView as unknown as { fieldPosition?: 'form' | 'sidebar'; isRequired?: boolean }
  return {
    ...field,
    createView: { ...field.createView, fieldPosition: createView.fieldPosition ?? 'form', isRequired: createView.isRequired ?? false },
    itemView: { ...field.itemView, fieldPosition: itemView.fieldPosition ?? 'form', isRequired: itemView.isRequired ?? false },
  }
})
```

`src/features/cms/admin-meta.ts:53-63`
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
```

### Target validation already follows the view
`src/components/dashboard/field-value-editor.tsx:55-68`
```ts
export function requiredFieldMessage(field: DashboardField, view: DashboardFieldEditView = 'itemView') {
  ...
  if (field[view].isRequired === true || field.isNonNull[0] === true || validationRecord?.isRequired === true) return `${field.label} is required.`
  return null
}

export function validateDraftValue(field: DashboardField, value: unknown, view: DashboardFieldEditView = 'itemView') {
  const requiredMessage = requiredFieldMessage(field, view)
  ...
}
```
So create/item submission now respects per-view requiredness.

### But the visible required marker still ignores per-view requiredness
`src/components/dashboard/controller-fields.tsx:55-60`
```tsx
function ControllerField({ field, value, onChange }: { field: ControllerBackedField; value: FieldControllerValue; onChange: (fieldPath: string, value: FieldControllerValue) => void }) {
  const Field = field.controller.Field
  return (
    <div className="space-y-2">
      <Label htmlFor={`field-${field.path}`}>{field.label}{field.isNonNull[0] === true ? <span className="ml-1 text-destructive">*</span> : null}</Label>
      <Field field={field} value={value} onChange={(nextValue) => onChange(field.path, nextValue)} />
    </div>
  )
}
```
This shows `*` only when the create-input non-null slot is true, regardless of whether the current rendered view is `createView` or `itemView`, and regardless of `field[view].isRequired`.

### Shared forms all flow through this component
`src/routes/dashboard/$listKey.create.tsx:35-40`
```ts
list.fields
  .filter((field) => field.path !== 'id' && field.createView.fieldMode !== 'hidden')
  .map((field) => withFieldController(field, 'createView'))
  .filter((field) => field.controller.isEditable(field))
```

`src/routes/dashboard/$listKey.$id.tsx:232-236`
```ts
data.list.fields
  .filter((field) => field.path !== 'id' && field.createView.fieldMode !== 'hidden')
  .map((field) => withFieldController(field, 'createView'))
  .filter((field) => field.controller.isEditable(field))
```
Both end up rendering labels through `ControllerFields`, so one fix covers create forms and singleton-create forms; the same shared path is also used for item editing.

### Reference app uses per-view requiredness, not generic non-null labels
`../next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx:277-284`
```ts
const isRequireds = useMemo(() => {
  const result: Record<string, any> = {}
  Object.entries(enhancedFields).forEach(([fieldPath, field]) => {
    result[fieldPath] = field.itemView?.isRequired || false
  })
```

`../next-keystone-starter/features/dashboard/utils/useCreateItem.ts:50-58`
```ts
const isRequireds = useMemo(() => {
  if (!enhancedFields) return {}
  return Object.fromEntries(
    Object.entries(enhancedFields).map(([key, field]: [string, any]) => [
      key,
      field.createView?.isRequired || false
    ])
  )
}, [enhancedFields])
```

## Architecture
- Server admin-meta generation in `src/features/cms/admin-meta.ts` computes `createView.isRequired` and `itemView.isRequired`.
- Client normalization in `src/features/cms/graphql-client.ts` preserves those values.
- Form pages (`$listKey.create`, singleton create in `$listKey.$id`, and item edit flows using the same controller pattern) convert `DashboardField` into `ControllerBackedField`.
- `ControllerFields` is the single shared label/layout component for those forms.
- Validation logic is already view-aware, but the visual required indicator is still hardcoded to `field.isNonNull[0]`.

## Start Here
Open `src/components/dashboard/controller-fields.tsx` first. The remaining parity gap is localized there: the UI’s required asterisk is not using the already-available view-aware `isRequired` metadata.

## Next single concrete fixable parity gap
**Gap:** form labels still mark fields as required using `field.isNonNull[0]` instead of the current view’s resolved `isRequired` metadata.

Why this matters:
- It creates a user-visible mismatch after the recent validation fix: a field can validate as required but show no `*`, or show `*` based on generic input nullability rather than current view semantics.
- Keystone semantics are view-aware here; the target now has that metadata, but the label renderer has not caught up.
- This is target-only and does not require any `../next-keystone-starter` edit.

## Minimal implementation
In `src/components/dashboard/controller-fields.tsx`:

1. Pass `view` into each `ControllerField` render.
2. Compute requiredness from `field[view].isRequired === true`.
3. Replace the current asterisk condition:
```tsx
field.isNonNull[0] === true
```
with:
```tsx
field[view].isRequired === true
```

Minimal sketch:
```tsx
{group.fields.map((field) => (
  <ControllerField
    key={field.path}
    field={field}
    value={values[field.path]}
    view={view}
    onChange={onChange}
  />
))}
```

and:
```tsx
function ControllerField({ field, value, view, onChange }: { ...; view: 'createView' | 'itemView' }) {
  ...
  <Label htmlFor={`field-${field.path}`}>
    {field.label}
    {field[view].isRequired === true ? <span className="ml-1 text-destructive">*</span> : null}
  </Label>
```

## Risk / constraint
- Very low risk: this is purely presentational and uses metadata already fetched and trusted by validation.
- Do not broaden this into backend changes; the gap is only the shared form label renderer.