# Batch 4 create/item controller architecture parity

Date: 2026-05-19

## What changed

Implemented the scoped Batch 4 create/item/controller architecture work from `reports/parity-dissertation/00-master-parity-dissertation-and-roadmap.md`.

### 1) Create/item flows now materially use the enhanced-field/controller stack
- Reworked the create route and item route away from the old `withFieldController(...)` path.
- Both routes now build form state from `enhanceFields(...)` and route rendering through a new shared `EnhancedFormFields` layer.
- This moves create/item closer to the Next model where field enhancement and controller contracts drive form behavior instead of a separate ad hoc route-local editor pipeline.

### 2) Expanded the target controller/registry contract beyond filter-only use
- `enhance-fields.tsx` now models a broader controller surface, including:
  - `graphqlSelection`
  - `defaultValue`
  - `deserialize`
  - `serialize`
  - `validate`
  - `filter`
- `views/registry.tsx` now exposes a real `Field` renderer (`RegistryField`) instead of the previous placeholder `null` field export.
- The registry-backed controller now uses the shared `FieldValueEditor` as a transitional form field implementation so create/item can be routed through the enhanced-field architecture without trying to finish every field-kind parity edge case in one batch.

### 3) Added a shared enhanced-form rendering/validation layer
- Added `src/components/dashboard/enhanced-form-fields.tsx`.
- This layer provides:
  - grouped rendering with existing field-position/sidebar behavior preserved
  - serialized-state computation for conditional field behavior
  - invalid-field detection
  - shared requiredness evaluation
  - edit/read/hidden handling at render time
- This materially reduces route-local form logic drift and starts aligning create/item behavior with the reference `Fields` pattern.

### 4) Improved invalid-field and requiredness handling
- Added invalid-field computation based on controller validation plus serialized form state.
- Create and item save flows now:
  - compute invalid fields before mutation
  - surface a top-level blocking message if invalid fields remain
  - pass force-validation state down so fields render inline validation when save/create is attempted
- Required markers are now driven by evaluated view-scoped `isRequired` semantics rather than only raw `isNonNull` markers.

### 5) Improved read/edit/hidden handling for create/item rendering
- Added `resolveDashboardFieldMode(...)` and serialized-filter evaluation in `field-value-editor.tsx`.
- The create/item field renderer can now handle:
  - static string modes
  - simple conditional field-mode objects in the Next/Keystone style (`edit` / `read` filter branches)
- Non-edit fields now render read-only through the same field renderer path instead of being filtered out by the old route-level editability shortcut.

### 6) Made item metadata and selection a bit more controller-driven
- `graphql-client.ts` item-page metadata fetch now includes `itemView.isRequired`.
- `graphQLSelectionForField(...)` now respects `field.fieldMeta.graphqlSelection` when present, giving the enhanced/controller layer a path to drive selection more explicitly in future slices.
- The item route now deserializes from the whole item record via controller `deserialize(...)` instead of only using `item[field.path]` directly.

### 7) Preserved existing good behaviors
- Existing field-position and sidebar grouping behavior was preserved through `field-form-layout.tsx` and the new enhanced-form layer.
- Existing singleton `/1` canonical flows and missing-singleton create flow were kept intact.
- Relationship field editor still honors prior `refSearchFields` / `refLabelField` work and now also respects read-only visibility better when deciding whether to show the “View related details” action.

## Exact files changed

- `src/components/dashboard/field-value-editor.tsx`
- `src/components/dashboard/views/registry.tsx`
- `src/components/dashboard/enhance-fields.tsx`
- `src/components/dashboard/enhanced-form-fields.tsx` **new**
- `src/features/cms/graphql-client.ts`
- `src/components/dashboard/relationship-field-editor.tsx`
- `src/routes/dashboard/$listKey.create.tsx`
- `src/routes/dashboard/$listKey.$id.tsx`

## Validations run and results

### Required validations
- `npm run lint` ✅ passed
- `npm run build` ✅ passed

### Targeted validation
- `npm run test:cms` ✅ passed

Reason for targeted validation:
- This batch changed create/item form serialization, controller behavior, and item GraphQL field/meta selection, so running the shared CMS CRUD validation was warranted.

## Remaining blockers / follow-up notes

This batch intentionally focused on the architectural shift and did **not** try to complete full field-kind parity in one step.

### Still not done in this batch
- The registry `Field` implementation is still transitional and currently delegates to the shared generic `FieldValueEditor`; it is not yet a full per-kind Next-style field-view/controller implementation.
- Controller-driven `graphqlSelection` support is now wired as a contract hook, but most fields still fall back to current target selection behavior until per-kind controllers are expanded further.
- Invalid-field UX is materially improved, but there is still no full parity with the reference’s exact `useInvalidFields` / `useHasChanges` ergonomics.
- Conditional `fieldMode` support now exists for simple filter objects, but full official Keystone conditional semantics are not yet proven across all field kinds.
- Relationship/image/file/document/password per-kind view behavior is still only partially parity-complete; this batch laid the architectural path rather than fully finishing those field implementations.

### Practical state after Batch 4
- Create/item no longer depend primarily on the old route-local `withFieldController(...)` architecture.
- Enhanced fields now materially participate in form rendering, validation, and serialization.
- The target is closer to the reference create/item controller model, but deeper per-kind field behavior parity is still a follow-up slice, not finished by this batch.
