# Dashboard create/item/controller/view parity audit

Date: 2026-05-18

## Inputs reviewed
- `/Users/junaid/code/tanstack-keystone-starter/progress.md`
- `/Users/junaid/code/tanstack-keystone-starter/plan.md` **was missing** at audit time (`ENOENT`)
- Target repo: `/Users/junaid/code/tanstack-keystone-starter`
- Reference repo: `/Users/junaid/code/next-keystone-starter`

## Executive verdict
The TanStack dashboard now has working create/item routes and better static field-position grouping than the Next reference, but it is still **materially behind on controller-backed form parity**. The biggest mismatch is architectural:

- **Reference** create/item flows are built on `enhanceFields` + controller `graphqlSelection` + controller `deserialize/serialize/validate` + shared `Fields` rendering.
- **Target** create/item flows bypass that stack and instead use a bespoke `withFieldController` → `field-value-editor` path with generic string/JSON editing.

That split leaves the target behind in:
- invalid-field UX
- dynamic required/read/edit/hidden behavior
- controller-specific serialize/deserialize semantics
- runtime `itemView.isRequired` parity
- per-kind rendering semantics for password/relationship/image/document/select/etc.

## What is already correct or better in target
1. **Static field-position metadata exists end-to-end** in TanStack admin meta and route rendering:
   - `src/features/cms/admin-meta.ts:67-79`
   - `src/features/cms/graphql-client.ts:147-156`
   - `src/components/dashboard/field-form-layout.tsx:3-12`
   - `src/routes/dashboard/$listKey.create.tsx:44-45,102-114`
   - `src/routes/dashboard/$listKey.$id.tsx:79,200-209,283-291`
2. **Singleton/hideCreate handling exists** in the target create/item routes:
   - `src/routes/dashboard/$listKey.create.tsx:18-23`
   - `src/routes/dashboard/$listKey.$id.tsx:155-159,226-297`
3. **List-column field selection keeps `id` pinned** similarly to the reference:
   - Target: `src/components/dashboard/filter-bar.tsx:306-343`, `src/features/cms/graphql-client.ts:249-260`
   - Reference: `features/dashboard/components/FieldSelection.tsx:52-99`

These should be preserved while closing the controller parity gap.

---

## Detailed gap report

### 1) Create and item pages are not using the controller/view stack that the reference uses

#### Reference
- Create page enhances fields and renders through shared `Fields`:
  - `features/dashboard/screens/CreatePage/CreatePageClient.tsx:51-57,158-185`
  - `features/dashboard/utils/useCreateItem.ts:37-175`
- Item page enhances fields, computes invalid fields/dirty state, and renders through shared `Fields`:
  - `features/dashboard/screens/ItemPage/ItemPageClient.tsx:255-301,505-547`

#### Target
- Create route builds `editableFields` from raw list meta, wraps them with `withFieldController`, then manually loops `serialize/validate` during submit:
  - `src/routes/dashboard/$listKey.create.tsx:35-44,51-79,109-113`
- Item route does the same with `withFieldController`, manual submit diffing, and manual delete/reset handling:
  - `src/routes/dashboard/$listKey.$id.tsx:64-79,92-119,128-148,205-209`

#### Gap
The target create/item pages are **not controller-view parity implementations**. They are using a separate generic form system instead of the enhanced-field stack that the reference relies on. That means the target cannot inherit controller-specific UI, controller-specific validation, or controller-specific GraphQL selection behavior.

#### Impact
This is the root cause behind nearly every downstream mismatch below.

#### Priority
**Blocker**

---

### 2) `enhance-fields` exists in target, but it is effectively filter/list infrastructure, not the create/item form substrate

#### Reference
- `enhanceFields` returns fully enhanced fields with real controllers and view components:
  - `features/dashboard/utils/enhanceFields.ts:10-82`
- The controller contract includes `graphqlSelection`, `defaultValue`, `deserialize`, `serialize`, `validate`, filter metadata, and is consumed by `Fields`:
  - `features/dashboard/types/index.ts:47-75,77-109,153-161`

#### Target
- Target `enhance-fields.tsx` returns a map, but its declared controller shape only models the filter surface:
  - `src/components/dashboard/enhance-fields.tsx:5-15`
- The only in-repo consumer of `enhanceFields(...)` is the filter bar:
  - `src/components/dashboard/filter-bar.tsx:74-75`
- Create/item routes do **not** use `enhanceFields(...)` at all:
  - `src/routes/dashboard/$listKey.create.tsx:35-44`
  - `src/routes/dashboard/$listKey.$id.tsx:64-79`

#### Gap
The target has a partial enhanced-field layer, but it is not the layer that powers form rendering. In the reference, enhanced fields are the core contract for create/item behavior. In the target, they are mostly a filter/cell helper.

#### Impact
Controller parity cannot be reached until create/item stop bypassing this layer.

#### Priority
**Blocker**

---

### 3) Target registry/controllers do not provide form semantics equivalent to the reference

#### Reference
- Registry returns per-kind implementations with real `Field`, `Cell`, `CardValue`, and controllers:
  - `features/dashboard/views/registry.ts:129-175`
- Example real controller contracts:
  - text: `features/dashboard/views/text/index.tsx:262-276`
  - select: `features/dashboard/views/select/index.tsx:285-311`
  - password: `features/dashboard/views/password/index.tsx:323-341`
  - relationship: `features/dashboard/views/relationship/index.tsx:304-420`
  - image: `features/dashboard/views/image/index.tsx:60-91`

#### Target
- Registry returns a placeholder `Field`, simplified `Cell`, and a minimal controller factory:
  - `src/components/dashboard/views/registry.tsx:146-159,251-259`
- The registry `Field` is literally `FieldPlaceholder` returning `null`:
  - `src/components/dashboard/views/registry.tsx:161-163,255`
- Instead of using registry `Field`, target form rendering always goes through generic `FieldValueEditor` via `withFieldController(...)`:
  - `src/components/dashboard/field-controllers.tsx:20-35`

#### Gap
The target does not have controller-backed per-kind form views. It has:
- real-ish cells and filters in registry,
- but generic edit UIs outside the registry.

That is a direct parity break for create/item/controller/view semantics.

#### Impact
Per-field behaviors cannot match the reference until the target registry exports real `Field` components and the routes consume them.

#### Priority
**Blocker**

---

### 4) GraphQL field selection is still hardcoded, not controller-driven

#### Reference
- The controller contract includes `graphqlSelection`:
  - `features/dashboard/types/index.ts:52-59`
- Utility exists to derive root GraphQL fields from controller selections:
  - `features/dashboard/lib/getRootGraphQLFieldsFromFieldController.ts:1-19`
- Controllers for complex fields request nested data:
  - image: `features/dashboard/views/image/index.tsx:62-69`
  - relationship: `features/dashboard/views/relationship/index.tsx:305-311`
  - password: `features/dashboard/views/password/index.tsx:326-340`

#### Target
- Item query selection is hardcoded to special-case only `id`, `password`, and `relationship`:
  - `src/features/cms/graphql-client.ts:282-289`
- `selectedItemFields(...)` simply includes all visible item fields; it does not derive selection from controller requirements:
  - `src/features/cms/graphql-client.ts:262-269,505-506,546`
- Item route deserializes from `data.item?.[field.path]` only:
  - `src/routes/dashboard/$listKey.$id.tsx:77`

#### Gap
The target cannot support full controller-backed fields because it is not fetching data via controller `graphqlSelection`. That blocks parity for any field whose form state depends on nested or structured server data.

#### Impact
This especially affects image/file/relationship/password/document/virtual-style fields and any future custom view.

#### Priority
**Blocker**

---

### 5) Invalid-field handling is missing from target create/item flows

#### Reference
- Invalid fields are computed centrally:
  - `features/dashboard/utils/useInvalidFields.tsx:9-53`
- `Fields` passes `forceValidation` only to invalid fields and computes `isRequired` against serialized state:
  - `features/dashboard/components/Fields.tsx:62-113`
- Create and item save paths check `invalidFields` before mutation:
  - create: `features/dashboard/utils/useCreateItem.ts:61-78`
  - item: `features/dashboard/screens/ItemPage/ItemPageClient.tsx:307-312`

#### Target
- No equivalent hook exists in `src` (audit search found no `useInvalidFields`, `useHasChanges`, or `serializeValueToOperationItem` implementation under `src`)
- Create route validates one field at a time only during submit and shows a top-level error banner:
  - `src/routes/dashboard/$listKey.create.tsx:51-80,112`
- Item route does the same for save:
  - `src/routes/dashboard/$listKey.$id.tsx:92-117,208`
- `ControllerFields`/`FieldValueEditor` have no invalid-field set, no force-validation prop, and no per-field error UI:
  - `src/components/dashboard/controller-fields.tsx:42-61`
  - `src/components/dashboard/field-controllers.tsx:7-15`
  - `src/components/dashboard/field-value-editor.tsx:95-170`

#### Gap
Target create/item parity is missing the reference invalid-field architecture entirely.

#### Impact
Users only learn about validation failures at submit time, and they do not get per-field inline feedback or invalid state preservation.

#### Priority
**High**

---

### 6) View-scoped required metadata is only partially propagated, and item-level runtime `isRequired` is missing

#### Reference
- Field meta types allow view-specific `isRequired` values:
  - `features/dashboard/types/index.ts:92-100`
- Item page fetches runtime validation metadata and overlays it before client render:
  - `features/dashboard/screens/ItemPage/index.tsx:46-64`
- Item client uses per-field `isRequired` data and passes it into `useInvalidFields` / `Fields`:
  - `features/dashboard/screens/ItemPage/ItemPageClient.tsx:277-298,511-545`

#### Target
- Static admin meta correctly computes `createView.isRequired` and `itemView.isRequired`:
  - `src/features/cms/admin-meta.ts:67-75`
- Static normalization preserves those values:
  - `src/features/cms/graphql-client.ts:147-156`
- But the runtime item-page query only requests `itemView { fieldMode fieldPosition }`, not `isRequired`:
  - `src/features/cms/graphql-client.ts:510-526`
- Returned `fieldMetaByPath` therefore lacks runtime `itemView.isRequired`:
  - `src/features/cms/graphql-client.ts:538-551`
- UI required marker is based only on `isNonNull[0]`:
  - `src/components/dashboard/controller-fields.tsx:58-60`
- Form validation checks static booleans and `fieldMeta.validation.isRequired`, not conditional/runtime `isRequired`:
  - `src/components/dashboard/field-value-editor.tsx:55-68`

#### Gap
The target loses the runtime `itemView.isRequired` overlay that the reference item flow uses. It also does not render required state with the same semantics as the reference.

#### Impact
Any item-page requiredness that depends on runtime/admin-evaluated metadata will drift.

#### Priority
**High**

---

### 7) Read/edit/hidden behavior is static in target and does not evaluate conditional field modes

#### Reference
- `Fields` evaluates `fieldMode` per view, supporting both string modes and conditional filter objects:
  - `features/dashboard/components/Fields.tsx:76-112`
- It can render edit, read, or hidden based on serialized form state.

#### Target
- Editability is just a static string equality check:
  - `src/components/dashboard/field-value-editor.tsx:17-23`
- Field grouping only treats literal `'hidden'` as hidden:
  - `src/components/dashboard/field-form-layout.tsx:6-10`
- `selectedItemFields(...)` also only filters literal `'hidden'`:
  - `src/features/cms/graphql-client.ts:262-269`
- There is no `testFilter(...)` or serialized-state evaluation in create/item form rendering.

#### Gap
If `createView.fieldMode` or `itemView.fieldMode` is conditional rather than a plain string, the target will not match the reference. It will either:
- treat the field as editable when it should be read-only/hidden, or
- drop it from editable mode entirely because the value is not literally `'edit'`.

#### Impact
This is a correctness bug once any list starts using conditional field modes.

#### Priority
**High**

---

### 8) Per-field rendering semantics are flattened into a generic editor

#### Reference examples
- text: structured nullable/create/update state + length/regex validation
  - `features/dashboard/views/text/index.tsx:262-276`
- select: nullable wrappers + option objects + validate
  - `features/dashboard/views/select/index.tsx:285-311`
- password: structured confirmation state + empty-keep semantics
  - `features/dashboard/views/password/index.tsx:323-341`
- relationship: one/many/cards/count states + connect/disconnect diffing
  - `features/dashboard/views/relationship/index.tsx:304-420`
- image: upload/remove/no-op semantics
  - `features/dashboard/views/image/index.tsx:60-91`

#### Target
- All create/item editors go through one generic `FieldValueEditor`:
  - `src/components/dashboard/field-controllers.tsx:20-35`
  - `src/components/dashboard/field-value-editor.tsx:95-170`
- Generic conversions are simplified string/JSON/CSV transforms:
  - `src/components/dashboard/field-value-editor.tsx:42-52,71-92`

#### Concrete mismatches
1. **Text fields** lose structured create/update/null semantics and reference validation rules.
2. **Select fields** are reduced to plain strings rather than controller option objects.
3. **Password fields** have no confirmation model; target just uses one password input and a blank-skip rule on item save:
   - target skip rule: `src/routes/dashboard/$listKey.$id.tsx:101`
4. **Number/timestamp/decimal/bigInt fields** lose controller-specific validation and state handling; target only parses `integer` and `float` explicitly:
   - `src/components/dashboard/field-value-editor.tsx:82-90`
5. **JSON/document fields** are plain textareas with `JSON.parse`, not controller-specific editors/validation UIs:
   - `src/components/dashboard/field-value-editor.tsx:75,121-123`

#### Priority
**Blocker**

---

### 9) Relationship field behavior is only partial in target

#### Reference
- Relationship controller models:
  - count mode
  - cards view
  - inline create/edit
  - connect/disconnect diffing
  - hide buttons / hide create / display options
  - one vs many structured state
  - `features/dashboard/views/relationship/index.tsx:304-420`

#### Target
- Relationship editor is a search/select box with external links and optional create/view buttons:
  - `src/components/dashboard/relationship-field-editor.tsx:28-135`
- Serialization uses comma-separated ids and:
  - many → `{ set: [...] }`
  - one → `{ connect: ... }` or `{ disconnect: true }`
  - `src/components/dashboard/field-value-editor.tsx:77-80`

#### Gap
The target supports only a thin subset of the reference relationship behavior. It does not have cards mode, inline create/edit, count mode, or incremental connect/disconnect diffing for many relationships.

#### Impact
Relationship fields will continue to be one of the biggest UX and behavior mismatches on create/item pages.

#### Priority
**High**

---

### 10) Image/file field behavior is not controller-parity and likely mutation-shape fragile

#### Reference
- Image controller expects structured value states and serializes to upload/remove/no-op mutations:
  - `features/dashboard/views/image/index.tsx:60-91`

#### Target
- File/image editor uploads through `/api/cms/upload`, then stores a JSON string back into generic form state:
  - `src/components/dashboard/file-field-editor.tsx:31-47`
- Generic parser then `JSON.parse`s that string and returns the raw object:
  - `src/components/dashboard/field-value-editor.tsx:75,117-119,173-180`

#### Gap
This is not using the reference controller contract (`{ kind: 'upload' | 'remove' | 'from-server' | 'empty' }` style semantics). It is a custom upload flow attached to a generic JSON editor path.

#### Impact
Even when it works for current storage wiring, it is not parity-safe and will be brittle for richer file/image controller behavior.

#### Priority
**High**

---

### 11) Item deserialization/dirtiness semantics are simplified and do not match controller behavior

#### Reference
- Item client deserializes full item data through enhanced controllers:
  - `features/dashboard/screens/ItemPage/ItemPageClient.tsx:223-248,260-301`
- Change detection uses controller serialization + GraphQL non-null semantics:
  - `features/dashboard/utils/useHasChanges.ts:7-49`

#### Target
- Item route deserializes only the raw field value at `item[field.path]`:
  - `src/routes/dashboard/$listKey.$id.tsx:77`
- Dirty-state check is shallow value inequality over draft vs currentDraft:
  - `src/routes/dashboard/$listKey.$id.tsx:78`
- There is no controller-aware change detection for nested/structured values.

#### Gap
The target cannot reliably detect changes for complex controller state because it is not comparing serialized controller output the way the reference does.

#### Impact
This will drift more as controller-backed fields are ported.

#### Priority
**High**

---

### 12) Field positioning is actually ahead in target, but the future controller port must not regress it

#### Reference
- Current Next create/item clients compute `fieldsSplit`, but still place all fields in main content:
  - create: `features/dashboard/screens/CreatePage/CreatePageClient.tsx:110-121`
  - item: `features/dashboard/screens/ItemPage/ItemPageClient.tsx:380-391`

#### Target
- TanStack already partitions form vs sidebar fields and groups them:
  - `src/components/dashboard/field-form-layout.tsx:3-30`
  - `src/components/dashboard/controller-fields.tsx:18-39`
  - `src/routes/dashboard/$listKey.create.tsx:44-45,109-113`
  - `src/routes/dashboard/$listKey.$id.tsx:79,205-209,287-291`

#### Finding
This is one area where the target is **not behind**. It is a parity divergence, but in a direction that is closer to Keystone’s intended metadata than the current Next client implementation.

#### Recommendation
When porting the reference controller stack, keep the TanStack grouping/positioning substrate rather than flattening everything back to main content.

#### Priority
**Keep / do not regress**

---

## Ordered implementation slices

### Slice 1 — Put create/item on the enhanced-field/controller stack
**Goal:** remove the parallel generic form system.

**Target files**
- `src/routes/dashboard/$listKey.create.tsx`
- `src/routes/dashboard/$listKey.$id.tsx`
- new shared form renderer/hook files under `src/components/dashboard/` or `src/features/cms/`

**Work**
1. Replace `withFieldController(...)` + `FieldValueEditor` form rendering with `enhanceFields(...)` output.
2. Introduce a TanStack equivalent of the reference `Fields` component contract.
3. Keep existing `field-form-layout.tsx` grouping logic, but feed it enhanced fields instead of bespoke controller-backed fields.

**Why first**
Everything else depends on create/item routes consuming the same controller substrate as the reference.

---

### Slice 2 — Expand target registry/controller contract to real form controllers
**Goal:** make `enhance-fields.tsx` form-capable.

**Target files**
- `src/components/dashboard/enhance-fields.tsx`
- `src/components/dashboard/views/registry.tsx`
- new/expanded `src/components/dashboard/views/*`

**Work**
1. Make target controller typing match the reference contract: `graphqlSelection`, `defaultValue`, `deserialize`, `serialize`, `validate`, `filter`.
2. Stop returning `FieldPlaceholder`; export real `Field` components from per-kind views.
3. Preserve current `Cell` and filter behavior while adding create/item field rendering parity.

**Why second**
Routes can only be ported cleanly once the registry exposes the full controller surface.

---

### Slice 3 — Make data fetching controller-driven
**Goal:** fetch what controllers actually need.

**Target files**
- `src/features/cms/graphql-client.ts`
- any supporting selection helpers

**Work**
1. Replace hardcoded `graphQLSelectionForField(...)` usage with controller `graphqlSelection`-driven selection.
2. For item pages, deserialize from the full item object, not `item[field.path]` only.
3. Include runtime `itemView.isRequired` in item-page meta fetch alongside `fieldMode` and `fieldPosition`.

**Why third**
Without controller-driven data selection, complex field parity will keep breaking even after UI porting.

---

### Slice 4 — Port invalid-fields, requiredness, and read/edit/hidden evaluation
**Goal:** match reference form semantics.

**Target files**
- new `useInvalidFields` equivalent
- new `useHasChanges` equivalent
- shared field renderer introduced in Slice 1
- `src/routes/dashboard/$listKey.create.tsx`
- `src/routes/dashboard/$listKey.$id.tsx`

**Work**
1. Port `testFilter(...)`-style serialized-state evaluation.
2. Support conditional `fieldMode` and conditional `isRequired` instead of only string/boolean handling.
3. Add `forceValidation`, `invalidFields`, and controller-aware dirty-state logic.

**Why fourth**
This is the semantic layer that turns controller wiring into actual parity.

---

### Slice 5 — Port per-kind field behavior in priority order
**Goal:** close the user-visible gaps field-by-field.

**Priority order**
1. text / select / checkbox
2. password
3. integer / float / decimal / bigInt / timestamp
4. relationship
5. image / file
6. document / json / virtual-related cases

**Reference anchors**
- text: `features/dashboard/views/text/index.tsx`
- select: `features/dashboard/views/select/index.tsx`
- password: `features/dashboard/views/password/index.tsx`
- relationship: `features/dashboard/views/relationship/index.tsx`
- image: `features/dashboard/views/image/index.tsx`

**Why fifth**
These controllers are the concrete behavior layer once the architecture is in place.

---

### Slice 6 — Reconcile route UX and harden with coverage
**Goal:** validate parity on real flows.

**Target files**
- create/item routes
- any new tests added under repo test locations

**Work**
1. Re-verify singleton create/edit behavior after controller port.
2. Add smoke/integration coverage for:
   - required-field validation
   - read/edit/hidden switching
   - relationship connect/disconnect
   - password unchanged-vs-updated semantics
   - image/file upload/remove semantics
3. Keep field-position grouping intact while upgrading the form engine.

**Why sixth**
This locks in the controller-port work and avoids regressions.

---

## Short version / actionable summary
If the goal is true parity with `next-keystone-starter`, the next milestone should **not** keep extending `field-value-editor.tsx` or `withFieldController(...)`. The correct path is:

1. move create/item onto `enhanceFields` + shared `Fields`
2. expand the registry/controllers to real form controllers
3. make item/list GraphQL selection controller-driven
4. port invalid-field / read-edit-hidden / requiredness semantics
5. then finish per-kind behavior

The current target already has decent route scaffolding and better static field positioning than the reference client. The missing piece is the **controller-backed form architecture itself**.