## Review
- Correct:
  - The starter exposes the expected Keystone-shaped entry points: `config`, `list`, `group` in `src/features/cms/keystone/core.ts:1-20`, field exports in `src/features/cms/keystone/fields.ts:1-18`, and auth exports in `src/features/cms/keystone/auth.ts:1-26`.
  - Basic dynamic-list/admin-meta flow is exercised by `scripts/validate-cms-dynamic-model.ts:22-104,141-143`, which verifies arbitrary list keys, `group()` metadata survival, inherited `graphql.maxTake`, and `getAdminMeta(lists)`.
  - Auth projection works for valid `sessionData` selections in practice: `scripts/validate-cms-auth.ts:112-115` verifies selected scalar/nested role fields are materialized into `context.session.data`.
- Fixed:
  - None. Read-only audit.
- Blocker:
  - I did **not** write `/Users/junaid/code/tanstack-keystone-starter/reports/parity-dissertation/06-runtime-config-dsl-adminmeta.md` because the task also said **“Read-only; do not edit.”** I escalated the conflict and received no supervisor reply, so I left the repo unchanged.
  - The current runtime is **not parity-safe** for official Keystone config/DSL/adminMeta claims. The biggest blockers are:
    1. `config()` is mostly a passthrough and does not implement Keystone defaulting/validation (`src/features/cms/config.ts:81-87` vs `packages/core/src/schema.ts:86-161`).
    2. `adminMeta` omits major official semantics: root access gating, actions, authoritative `views` registry, `list(key, itemId)`, conditional filter-shaped field modes, and default `hideCreate/hideDelete` behavior from omitted GraphQL ops (`src/features/cms/admin-meta.ts:105-153`, `src/features/cms/runtime.ts:143-224,998-1073` vs `packages/core/src/lib/admin-meta.ts:104-350`, `packages/core/src/lib/admin-meta-graphql.ts:11-391`).
    3. Unsupported Keystone options are mostly **silently accepted** instead of validated or rejected (`src/features/cms/fields/index.ts:15-32,70-115` vs per-field validators across `packages/core/src/fields/types/*`).
- Note:
  - `/Users/junaid/code/tanstack-keystone-starter/plan.md` does not exist; only `progress.md` was readable.
  - The strongest existing parity coverage is in ad hoc validation scripts, not focused parity tests. I found no dedicated tests for config defaulting, view portability validation, unsupported option rejection, or adminMeta access gating.

# Exact code-difference report

## 1) `config()` parity

### Official Keystone
- `config()` applies runtime defaults and validates core invariants:
  - validates `db.provider` in `packages/core/src/schema.ts:89-91`
  - defaults `db.url` in `packages/core/src/schema.ts:93-95`
  - defaults `db.idField`, Prisma paths, logging, etc. in `packages/core/src/schema.ts:118-133`
  - defaults GraphQL path/playground/schemaPath in `packages/core/src/schema.ts:134-140`
  - defaults server CORS/maxFileSize/hooks/options in `packages/core/src/schema.ts:97-111,142-149`
  - defaults UI basePath/access/publicPages/pageMiddleware in `packages/core/src/schema.ts:152-160`
  - injects normalized lists via `listsWithDefaults()` in `packages/core/src/schema.ts:18-74,141`

### Starter
- `config()` is a direct passthrough: `src/features/cms/config.ts:81-83`
- No runtime validation/defaulting in the Keystone wrapper either: `src/features/cms/keystone/core.ts:7-9`

### Exact differences
- No provider validation
- No default `db.url`
- No default GraphQL/server/UI values
- No reserved `fields.id` enforcement
- No singleton `db.idField` conflict enforcement
- No automatic list default expansion at `config()` time

### Impact
A copied Keystone config can type-check locally but diverge at runtime because starter behavior is much looser and under-normalized.

---

## 2) `list()` parity

### Official Keystone
- `list()` is shallow, but the real semantics are completed in `listsWithDefaults()` and `initialiseLists()`:
  - reserved `fields.id` check: `packages/core/src/schema.ts:20-25`
  - singleton id semantics: `packages/core/src/schema.ts:27-29,47-55`
  - default filter/order flags: `packages/core/src/schema.ts:38-41`
  - labelField/searchFields/graphql/ui defaults in `packages/core/src/lib/core/initialise-lists.ts:751-909`

### Starter
- `list()` is also shallow: `src/features/cms/config.ts:85-87`
- Normalization happens in `normaliseList()`: `src/features/cms/config.ts:187-223`

### Exact differences
- Starter injects an `id` field if missing (`src/features/cms/config.ts:190-193`) but does **not** reserve `fields.id` or reject conflicts.
- Starter does not implement singleton numeric-id behavior equivalent to Keystone.
- Starter defaults `initialColumns` to the first **4** non-id fields (`src/features/cms/config.ts:202`) while Keystone defaults to labelField + next visible fields, capped to **3** (`packages/core/src/lib/admin-meta.ts:127-142`).
- Starter defaults `initialSearchFields` to `[]` (`src/features/cms/config.ts:203`); Keystone infers searchable defaults from field filters and label field (`packages/core/src/lib/admin-meta.ts:144-147`, `packages/core/src/lib/core/initialise-lists.ts:883-907`).
- Starter does not support `ui.searchFields`, `ui.listView.initialFilter` as session functions, or `ui.listView.defaultFieldMode`.

### Impact
List-level DSL is only superficially compatible; UI/search/filter defaults do not match official Keystone.

---

## 3) `group()` parity

### Official Keystone
- `group()` returns a synthetic `__groupN` marker followed by fields, preserving order and carrying group UI defaults: `packages/core/src/schema.ts:164-209`
- Rejects nested groups: `packages/core/src/schema.ts:195-198`
- Group UI default field modes are supported in type shape: `packages/core/src/schema.ts:173-187`
- Group markers are interpreted during list initialization: `packages/core/src/lib/core/initialise-lists.ts:642-660,666`

### Starter
- `group()` has two modes:
  - explicit array-style field group passthrough
  - field-spread mode that stamps `fieldMeta.group` onto each field
- Implementation: `src/features/cms/config.ts:89-107`
- Normalization merges explicit groups + `fieldMeta.group` metadata: `src/features/cms/config.ts:145-185`

### Exact differences
- No synthetic `__groupN` entries
- No nested-group rejection
- No group-level UI defaults like `defaultFieldMode`
- No ordered group marker verification like Keystone’s `fieldKeys.slice(...)` check in `packages/core/src/lib/core/initialise-lists.ts:651-653`

### Impact
Starter supports grouped metadata display, but not official group DSL semantics.

---

## 4) Field factory parity

## 4.1 Starter factory architecture
- One generic `field()` accepts many arbitrary options and spreads them into `fieldMeta`/`db`: `src/features/cms/fields/index.ts:70-115`
- Exports specific names (`text`, `select`, `relationship`, etc.) but they all route through the same generic normalizer: `src/features/cms/fields/index.ts:118-188`

## 4.2 Official Keystone architecture
- Each field type has a dedicated implementation with:
  - strong config typing
  - option validation
  - Prisma mapping
  - GraphQL input/output/filter/order support
  - `views` path
  - `getAdminMeta()`
- Examples:
  - text: `packages/core/src/fields/types/text/index.ts:58-192`
  - select: `packages/core/src/fields/types/select/index.ts:58-195`
  - multiselect: `packages/core/src/fields/types/multiselect/index.ts:66-154`
  - relationship: `packages/core/src/fields/types/relationship/index.ts:144-330`

## 4.3 Exact differences by capability

### a) Unsupported-option handling
- Starter explicitly allows arbitrary keys: `src/features/cms/fields/index.ts:32`
- Official field types reject invalid configs, e.g.:
  - duplicate select options: `packages/core/src/fields/types/select/index.ts:74-77`
  - multiselect unique indexing unsupported: `packages/core/src/fields/types/multiselect/index.ts:75-77`
  - decimal precision/scale validation: `packages/core/src/fields/types/decimal/index.ts:64-78`
  - relationship mode constraints: `packages/core/src/fields/types/relationship/index.ts:198-223`
  - invalid search field refs: `packages/core/src/fields/types/relationship/index.ts:78-98`

**Starter result:** options are often silently preserved in `fieldMeta`, even if no runtime actually honors them.

### b) Text/select/multiselect UI options
- Official supports and serializes display modes:
  - text `ui.displayMode`: `packages/core/src/fields/types/text/index.ts:18-19,183-184`
  - select `ui.displayMode`: `packages/core/src/fields/types/select/index.ts:38-40,104-107`
  - multiselect `ui.displayMode`: `packages/core/src/fields/types/multiselect/index.ts:52-53,149-150`
- Starter accepts `ui` but generic dashboard rendering ignores these official display-mode semantics; it uses a generic controller/cell system: `src/components/dashboard/views/registry.tsx:1-259`

### c) Relationship UI/options
- Official relationship field supports `displayMode`, `labelField`, `searchFields`, `filter`, `sort`, `table`, `count`, `hideCreate`, table columns, etc.: `packages/core/src/fields/types/relationship/index.ts:14-141,169-330`
- Starter stores relationship UI metadata in `fieldMeta.ui` via generic field factory (`src/features/cms/fields/index.ts:42-48,87-99`) but admin/runtime only derives ref list/path/label/search defaults: `src/features/cms/admin-meta.ts:31-42`

**Missing parity in starter:**
- no validated `displayMode: count/table/select`
- no table/count GraphQL selection behavior
- no list-specific relationship view module behavior
- no validation of referenced columns/search fields/sort

### d) Decimal/file/image specifics
- Official decimal validates precision/scale and exposes proper scalar/meta behavior: `packages/core/src/fields/types/decimal/index.ts`
- Starter just stores `precision`/`scale` in `fieldMeta`: `src/features/cms/fields/index.ts:74-77,90-93`
- Official file/image `transformName` and storage are typed and enforced per field implementation:
  - file: `packages/core/src/fields/types/file/index.ts:36-37,87,132,147`
  - image: `packages/core/src/fields/types/image/index.ts:39-40,155,209,232`
- Starter uses one generic `transformName?: (originalFilename: string) => ...` for both file and image: `src/features/cms/fields/index.ts:24-25`
- Runtime upload path reads `transformName` from `field.fieldMeta`: `src/features/cms/runtime.ts:350-357`

**Mismatch:** official image `transformName` includes extension semantics; starter does not.

### e) Missing official field types
- Official exports `calendarDay` and `bytes`: `packages/core/src/fields/index.ts:1-30`
- Starter does not export them from `src/features/cms/keystone/fields.ts:1-18`

---

## 5) Model-file portability

### Official Keystone
- Model files are built from actual field-type functions that produce `views`, GraphQL, Prisma, and admin metadata.
- Admin meta validates view module paths for portability:
  - backslash rejection: `packages/core/src/lib/admin-meta.ts:338-343`
  - absolute path rejection: `packages/core/src/lib/admin-meta.ts:345-349`

### Starter
- The starter’s Keystone-like API is import-compatible only at the surface:
  - `src/features/cms/keystone/core.ts:1-20`
  - `src/features/cms/keystone/fields.ts:1-18`
- But starter fields are plain config objects, not official field implementation functions.
- No equivalent `ui.views` path validation exists.
- `CmsField` does carry `viewsIndex?: string | number` and `customViewsIndex?: number | null`: `src/features/cms/types.ts:162-165`
- Yet factories never create official `views` module paths.

### Exact differences
- Official custom/admin views portability rules are absent.
- Official Keystone model files with custom field implementations or custom `ui.views` would not port faithfully.
- The starter dashboard uses its own generic registry instead of actual field view modules: `src/components/dashboard/views/registry.tsx:251-258`

### Impact
“Copy a Keystone model file into this runtime” only works for a narrow scalar subset.

---

## 6) View-order generation parity

### Official Keystone
- Admin meta builds an authoritative `views` array from actual field view module paths and assigns numeric indexes with `getViewId()`: `packages/core/src/lib/admin-meta.ts:194-203,230-235`
- This is tied to real `field.views` and optional custom `field.ui.views`.
- Portability validation happens before indexing: `packages/core/src/lib/admin-meta.ts:215-218,234-235,338-349`

### Starter
- View order is generated by scanning field kinds/strings in list order: `src/features/cms/view-order.ts:48-57`
- Mapping is from hardcoded Keystone view path strings to kind labels: `src/features/cms/view-order.ts:22-39`
- Admin meta uses `fieldKindToViewsIndex` fallback instead of real field view modules: `src/features/cms/admin-meta.ts:6-24,63`
- Generator emits `.cms/view-order.ts`: `scripts/cms-generate.ts:80-81`

### Exact differences
- No authoritative `views` array on adminMeta root
- No custom `ui.views` path validation
- No official custom view indexing semantics
- Generated `.cms/view-order.ts` already includes `"id"` first: `.cms/view-order.ts:3-17`
- But dashboard fallback helper prepends `"id"` again: `src/components/dashboard/views/getFieldTypeFromViewsIndex.ts:32-37`

### Impact
The fallback `viewsIndex -> kind` mapping is off by one whenever it relies on generated view order, unlike Keystone’s authoritative `adminMeta.views` model.

---

## 7) `adminMeta` production parity

### Official Keystone
- Produces rich admin meta source:
  - `lists`, `listsByKey`, `views`, `isAccessAllowed`: `packages/core/src/lib/admin-meta.ts:97-114`
  - actions included: `packages/core/src/lib/admin-meta.ts:272-296`
  - fields/groups/graphql/page size/initial filters/hide flags: `packages/core/src/lib/admin-meta.ts:154-191,210-307`
- GraphQL exposes:
  - `keystone.adminMeta.lists`
  - `keystone.adminMeta.list(key, itemId)`
  - dynamic field/item/action metadata
- Implementation: `packages/core/src/lib/admin-meta-graphql.ts:11-391`
- Root admin-meta access is gated by `ui.isAccessAllowed`: `packages/core/src/lib/admin-meta-graphql.ts:375-388`

### Starter
- Static adminMeta only contains `{ lists }`: `src/features/cms/admin-meta.ts:131-140`
- `AdminMeta` GraphQL exposes `lists` and `list(key)` only, no `itemId`: `src/features/cms/runtime.ts:143-146`
- `ListMeta` lacks actions and root views registry: `src/features/cms/runtime.ts:148-170`
- `getAdminMetaForContext()` only overrides `hideCreate/hideDelete` and field modes: `src/features/cms/admin-meta.ts:143-153`
- Root resolver does **not** enforce `ui.isAccessAllowed`: `src/features/cms/runtime.ts:998-1000,1058-1060`

### Exact differences
1. **No root admin-meta access gate**
   - Official: `packages/core/src/lib/admin-meta-graphql.ts:380-387`
   - Starter: `src/features/cms/runtime.ts:998-1000,1058-1060`

2. **No admin-meta actions**
   - Official actions exist in source and GraphQL: `packages/core/src/lib/admin-meta.ts:272-296`, `packages/core/src/lib/admin-meta-graphql.ts:128-229,321-324`
   - Starter `AdminMetaList` has no actions field: `src/features/cms/types.ts:280-289`

3. **No root `views` registry**
   - Official: `packages/core/src/lib/admin-meta.ts:100,194-203`
   - Starter: none in `src/features/cms/admin-meta.ts`

4. **No `list(key, itemId)` shape**
   - Official GraphQL: `packages/core/src/lib/admin-meta-graphql.ts:345-370`
   - Starter only supports field-level `itemView(id:)`: `src/features/cms/runtime.ts:194-195,1011-1013,1071-1073`

5. **`hideCreate/hideDelete` defaults are wrong**
   - Official defaults these to hidden when list GraphQL create/delete are disabled: `packages/core/src/lib/admin-meta.ts:180-186`
   - Starter defaults to `false` unless explicit boolean/function: `src/features/cms/admin-meta.ts:117-119`

6. **Page size is not clamped to maxTake**
   - Official: `packages/core/src/lib/admin-meta.ts:149-152,172`
   - Starter passes `pageSize` through: `src/features/cms/config.ts:206`, `src/features/cms/admin-meta.ts:114`

7. **Initial filter is not session-dynamic**
   - Official normalizes `initialFilter` as a maybe-session function: `packages/core/src/lib/admin-meta.ts:177`
   - Starter only accepts object/null and serializes it directly: `src/features/cms/config.ts:155-157,205`, `src/features/cms/admin-meta.ts:113`

### Impact
Starter adminMeta is materially less expressive and can advertise UI actions that official Keystone would hide or remove.

---

## 8) Dynamic `fieldMode` evaluation parity

### Official Keystone
- Field modes support:
  - conditional filter objects
  - maybe-session functions
  - maybe-item functions
  - list/group default field modes
- Types:
  - list/group conditional types: `packages/core/src/types/config/lists.ts:224-347`
  - field conditional types: `packages/core/src/types/config/fields.ts:32-72`
- Initialization applies group/list/field defaults: `packages/core/src/lib/core/initialise-lists.ts:703-736`
- GraphQL returns JSON field-mode conditions for create/item/list views: `packages/core/src/lib/admin-meta-graphql.ts:37-45,52-101,110-118`

### Starter
- Field mode type is only concrete string or function returning concrete string: `src/features/cms/types.ts:3-12`
- `FieldViewConfig` does not type `isRequired` or dynamic `fieldPosition`: `src/features/cms/types.ts:14-17`
- Evaluation just calls function and expects `'edit' | 'read' | 'hidden'`: `src/features/cms/admin-meta.ts:84-96`
- No list/group default field mode layer exists in starter list/group config.

### Exact differences
- No support for official conditional filter object DSL
- No support for group/list `defaultFieldMode`
- No support for dynamic `fieldPosition`
- No support for official `isRequired` conditional DSL
- Starter evaluates to immediate strings only

### Impact
Official Keystone field-mode configs cannot be ported faithfully, especially list/group defaults and conditional rules.

---

## 9) `createAuth()` / `withAuth()` parity

### Official Keystone auth
- `createAuth()`/`withAuth()` do much more than attach config:
  - validate identity/secret/init fields: `packages/auth/src/index.ts:94-117`
  - wrap session strategy and fetch `sessionData`: `packages/auth/src/index.ts:119-154`
  - add signin/init admin files: `packages/auth/src/index.ts:50-92`
  - install public pages and page middleware redirects: `packages/auth/src/index.ts:169-243`
  - compose GraphQL schema extension: `packages/auth/src/index.ts:247-285`
- `sessionData` is parsed and schema-validated: `packages/auth/src/schema.ts:51-69`
- `identityField` is checked against unique-where GraphQL type: `packages/auth/src/schema.ts:25-40`

### Starter auth
- `createAuth().withAuth()` only:
  - validates list/field existence and session presence
  - returns `{ ...config, auth }`
- Implementation: `src/features/cms/keystone/auth.ts:6-23`
- Runtime auth GraphQL is added elsewhere: `src/features/cms/auth/graphql.ts:74-229`

### Exact differences
- No `withAuth()` UI/public-page/page-middleware behavior
- No session-strategy wrapping at config time
- No schema-level `sessionData` validation
- No unique-where identity-field validation
- No generated auth admin files

### Impact
The starter auth runtime works for the included app, but it is not Keystone-compatible in config semantics.

---

## 10) Unsupported option handling summary

### Official Keystone rejects invalid/nonsensical config
Examples:
- reserved `fields.id`: `packages/core/src/schema.ts:20-25`
- nested groups: `packages/core/src/schema.ts:195-198`
- invalid custom views paths: `packages/core/src/lib/admin-meta.ts:338-349`
- duplicate select options: `packages/core/src/fields/types/select/index.ts:74-77`
- multiselect unique index unsupported: `packages/core/src/fields/types/multiselect/index.ts:75-77`
- relationship invalid table/count usage: `packages/core/src/fields/types/relationship/index.ts:198-223`
- `sessionData` syntax/validation errors: `packages/auth/src/schema.ts:56-69`

### Starter generally accepts and carries unknown config
- Generic field options allow `[key: string]: unknown`: `src/features/cms/fields/index.ts:32`
- `CmsListUiConfig` is loose: `src/features/cms/types.ts:198-206`
- `CmsConfig.ui` is `unknown`: `src/features/cms/config.ts:58-61`
- `config()` performs no validation: `src/features/cms/config.ts:81-83`

### Impact
The starter currently prefers “accept and ignore/store” over “validate or reject,” which is the opposite of safe Keystone parity.

---

# Staged compatibility plan

## Stage 0 — Add parity guardrails first
Create focused tests before refactors.

1. Add config default/validation tests for:
   - invalid `db.provider`
   - reserved `fields.id`
   - singleton `db.idField` conflict
   - `ui.searchFields` containing `id`
2. Add adminMeta parity tests for:
   - `hideCreate/hideDelete` defaulting from omitted GraphQL ops
   - `pageSize` clamping to `maxTake`
   - adminMeta root access gating
   - presence of `views`, `actions`, `list(key,itemId)`
3. Add unsupported-option rejection tests for:
   - duplicate select/multiselect options
   - invalid decimal precision/scale
   - invalid relationship displayMode combinations
   - invalid custom view paths
4. Add auth parity tests for:
   - invalid `sessionData` syntax/schema
   - non-unique `identityField` mismatch

## Stage 1 — Rebuild `config()` / list normalization around official semantics
1. Port `config()` defaulting/validation behavior from `packages/core/src/schema.ts:86-161`
2. Enforce reserved `fields.id` and singleton id rules
3. Add list-level UI config support for:
   - `searchFields`
   - `createView.defaultFieldMode`
   - `itemView.defaultFieldMode`
   - `listView.defaultFieldMode`
   - `listView.initialFilter` as maybe-session function
   - `hideNavigation` as maybe-session function
4. Align initial column/search defaults with official logic

## Stage 2 — Replace generic field factory with per-field normalizers
1. Keep the exported API names, but route each field type through dedicated validators/normalizers.
2. Implement real parity for:
   - `text`
   - `select`
   - `multiselect`
   - `relationship`
   - `decimal`
   - `file`
   - `image`
   - `document`
3. Explicitly reject unsupported Keystone options rather than silently storing them.
4. Add missing official field types or explicitly document them as unsupported (`calendarDay`, `bytes`).

## Stage 3 — Rebuild adminMeta around official source model
1. Introduce admin meta source with:
   - `lists`
   - `listsByKey`
   - `views`
   - `isAccessAllowed`
2. Add `actions` support to list config and adminMeta.
3. Build `viewsIndex/customViewsIndex` from real view identifiers, not kind fallbacks.
4. Validate custom view paths for portability.
5. Expose official-style GraphQL:
   - `keystone.adminMeta.lists`
   - `keystone.adminMeta.list(key, itemId)`
6. Enforce root admin-meta access via `ui.isAccessAllowed`.

## Stage 4 — Implement official dynamic field-mode semantics
1. Expand type system to support:
   - conditional filter objects
   - maybe-session functions with filters
   - maybe-item field functions with filters
2. Add group/list `defaultFieldMode` inheritance.
3. Support dynamic `fieldPosition` and `isRequired`.
4. Update dashboard/client code to resolve conditional field-mode JSON like Keystone admin UI.

## Stage 5 — Align auth config semantics with official `createAuth()/withAuth()`
1. Make `withAuth()` wrap session strategy rather than only attaching `auth`.
2. Validate `identityField` against unique-where capabilities.
3. Parse and validate `sessionData` against schema.
4. Add auth UI/page middleware parity if desired:
   - signin page
   - init flow page
   - publicPages
   - access redirects

## Stage 6 — Finish model-file portability story
1. Decide the target:
   - true drop-in portability for a practical subset of Keystone model files, or
   - “Keystone-inspired DSL” with explicit incompatibility docs
2. If true portability is required:
   - support official field implementation metadata patterns
   - support custom views/custom field modules
   - support actions and relationship display modes
3. If not:
   - add hard rejections for unsupported official options so copied models fail loudly

If you want this as ready-to-save file content for `reports/parity-dissertation/06-runtime-config-dsl-adminmeta.md`, the above is the full draft; I left the repo unchanged because of the explicit read-only constraint.