# Deep Field Controller + Storage Parity Audit

## Scope
Compared `/Users/junaid/code/tanstack-keystone-starter` against official Keystone field types in `/Users/junaid/code/keystone/packages/core/src/fields/types` and field views in `/Users/junaid/code/keystone/packages/core/src/fields/types/*/views`.

Audited end-to-end parity for: DSL config, Prisma shape, GraphQL in/out/filter/order, AdminMeta fieldMeta, dashboard edit/display/filter controllers, migration/runtime behavior.

---

## Executive Summary

`tanstack-keystone-starter` currently implements a **simplified, metadata-first CMS layer**, not Keystone’s full field-type contract.

- **Strongest parity**: basic scalar fields (`text`, `checkbox`, partial `integer/float/select`) for simple CRUD.
- **Largest gaps**: `image`, `file`, `document`, `relationship`, `virtual`, `password`, `json`, `multiselect`, `timestamp`, `decimal/bigInt` semantics, plus Admin UI controllers/filters.
- **Core architectural divergence**: starter treats several rich field types as generic `Json` + textareas and lacks Keystone’s typed GraphQL inputs/resolvers and field-controller behavior.

---

## Key Evidence (files inspected)

1. `src/features/cms/fields/index.ts` - starter DSL field factories are thin metadata wrappers; no per-field resolver semantics.
2. `src/features/cms/types.ts` - starter field model is generic (`kind`, `fieldMeta`, optional flags), not typed per field.
3. `src/features/cms/prisma-schema.ts` - Prisma generation now maps `image`/`file` to Keystone-like multi-column defaults; `document`/`multiselect` remain JSON-backed approximations.
4. `src/features/cms/admin-meta.ts` - AdminMeta synthesized generically; limited field-specific meta.
5. `src/features/cms/graphql-client.ts` - dashboard query/filter behavior uses simplified heuristics by `field.kind`.
6. `src/components/dashboard/field-value-editor.tsx` + `src/components/dashboard/file-field-editor.tsx` - image/file now have baseline upload/remove/preview controllers; json/document remain raw JSON textareas.
7. `src/components/dashboard/relationship-field-editor.tsx` - relationship editor is custom ID-selector, not Keystone relationship controller semantics.
8. `prisma/schema.prisma` - generated schema confirms image/file multi-column fields plus remaining approximations such as decimal/bigInt as `String`.
9. Official Keystone: `packages/core/src/fields/types/*/index.ts` + `views/*` (notably image/file/relationship/password/select/multiselect/timestamp/json/virtual).

---

## Field-by-field gap table

| Field | DSL config parity | Prisma shape parity | GraphQL input/output/filter/order parity | AdminMeta fieldMeta parity | Dashboard controller parity | Runtime/migration parity | Gap Severity |
|---|---|---|---|---|---|---|---|
| `text` | Partial | Partial | Partial | Partial | Partial | Partial | Medium |
| `checkbox` | Partial | Good | Partial | Partial | Partial | Partial | Medium |
| `integer` | Partial | Partial | Partial | Partial (no min/max defaults) | Partial | Partial | Medium |
| `float` | Partial | Partial | Partial | Low | Partial | Partial | Medium |
| `decimal` | Low (metadata only) | Low (String) | Low (string-like handling) | Low | Low | Low | High |
| `bigInt` | Low (metadata only) | Low (String) | Low (string-like handling) | Low | Low | Low | High |
| `timestamp` | Partial | Partial | Partial | Low vs Keystone (`updatedAt/defaultValue`) | Low (no date controller) | Partial | High |
| `json` | Partial | Partial | Low (no JSON filters/order) | Low | Low (textarea parse) | Partial | High |
| `select` | Partial | Partial | Partial | Partial | Partial | Partial | Medium |
| `multiselect` | Partial | Low (`Json`) | Low (ad-hoc has filter) | Partial | Partial (comma/checkbox hybrid) | Low | High |
| `password` | Low | Partial (`String`) | Low (missing KDF/filter contracts) | Low | Low | Low | High |
| `relationship` | Partial | Partial | Low vs Keystone nested relateTo contract | Partial | Partial custom selector | Partial | High |
| `document` | Low (alias behavior) | Low (`Json`) | Low | Low | Low (textarea JSON) | Low | High |
| `image` | Partial | Partial (multi-column default) | Partial (Upload + output shape/url) | Partial | Partial (upload controller) | Partial (local lifecycle hooks) | High |
| `file` | Partial | Partial (multi-column default) | Partial (Upload + filename/filesize/url output) | Partial | Partial (upload controller) | Partial (local lifecycle hooks) | High |
| `virtual` | Partial surface | N/A | Low (string returnType metadata only) | Low | Low | Low | High |

---

## Detailed findings by concern

### 1) DSL Config parity
- Starter DSL (`src/features/cms/fields/index.ts`) builds fields via generic `field(kind, options)` and stores extras in `fieldMeta`.
- Keystone field configs enforce **field-specific typed contracts** and runtime validation (e.g., `password.validation`, `relationship.ui.displayMode`, `timestamp.db.updatedAt`, `select.type`, `multiselect.type`, `image/file.storage`).
- Missing in starter: strong typed constraints and field-level config validation.

### 2) Prisma shape parity
- Starter scalar mapping (`src/features/cms/prisma-schema.ts`):
  - `decimal`, `bigInt` -> `String`
  - `document`, `json`, `multiselect` -> `Json`
  - `image` now defaults to Keystone-like multi-column fields (`id`, `extension`, `filesize`, `width`, `height`)
  - `file` now defaults to Keystone-like multi-column fields (`filename`, `filesize`)
- Keystone:
  - `image` is multi-column (`id`, `extension`, `filesize`, `width`, `height`) in field type definition.
  - `file` is multi-column (`filename`, `filesize`).
  - `multiselect` is JSON-backed but with stronger typed GraphQL and validation contract.
  - `timestamp`/numeric/select include richer default/index behavior.

### 3) GraphQL in/out/filter/order parity
- Starter GraphQL client filters (`src/features/cms/graphql-client.ts`) support a limited subset and include ad-hoc assumptions (`multiselect.has`, only text/select searchable in many places).
- Official Keystone field types define per-field GraphQL args/resolvers, including:
  - `file/image` upload input objects using `Upload`
  - relationship relateTo one/many create/update/where graph
  - password `isSet` filter semantics
  - field-specific order/filter availability
- Starter now has typed baseline file/image Upload inputs and output objects (`url`, metadata), but still lacks Keystone’s full field-specific contract surface and edge-case error parity.

### 4) AdminMeta fieldMeta parity
- Starter AdminMeta (`src/features/cms/admin-meta.ts`) merges generic info into `fieldMeta` and infers defaults.
- Keystone field types export rich `getAdminMeta` payloads tailored to each view/controller:
  - password validation payload
  - relationship display config/search/label/sort/filter
  - timestamp default/updatedAt
  - select/multiselect option/type/display mode
- Starter missing most structured fieldMeta contracts expected by Keystone views.

### 5) Dashboard field controller parity
- Starter editor (`field-value-editor.tsx`):
  - `json/document` are still edited as raw JSON text
  - `image/file` now use an upload controller with preview/remove metadata handling
  - `relationship` edited through custom ID chips/search list
  - `timestamp` edited as text/number-like input, no date-time UX contract
- Keystone views (`packages/core/src/fields/types/*/views`) provide dedicated controllers and components per field with parse/serialize/filter behaviors and rich UX (image/file widgets, relationship combobox/table/count modes, timestamp utils, password handling).

### 6) Runtime behavior + storage lifecycle parity
- Keystone `image/file` field types include upload stream handling, transformName, storage put/delete, and `afterOperation` cleanup on update/delete.
- Starter now has local storage upload/write support, GraphQL upload normalization, Prisma/memory adapter mapping, and local file cleanup for replaced/deleted image/file values. Remaining gaps include S3 writer/cleanup parity, `transformName` parity, and exact Keystone storage strategy hook semantics.
- Password in Keystone includes KDF hashing + compare extension wiring; starter lacks equivalent field-type-level security contract.

### 7) Migrations parity
- Legacy starter shape diverged (`image/file` single JSON column); current generated shape is Keystone-like multi-field. Existing databases created before the multi-column change still require JSON-to-column migration tooling.
- Decimal/bigInt currently stored as strings; moving to true decimal/bigint semantics will require data normalization and API surface changes.

---

## Implementation plan (phased)

### Phase 0 - Foundation (required first)
1. Introduce field-type capability matrix in core schema/runtime:
   - typed field contracts for GraphQL input/output/filter/order
   - typed AdminMeta per field kind
   - per-field parser/serializer hooks for dashboard controllers
2. Add compatibility tests comparing generated schema/AdminMeta against Keystone fixtures for each target field.

### Phase 1 - Critical storage fields (`image`, `file`)
1. [x] Redesign Prisma representation to Keystone-like multi-column shape:
   - Image: `{id, extension, filesize, width, height}`
   - File: `{filename, filesize}`
2. [x] Implement Upload-based GraphQL inputs.
3. [x] Implement local storage lifecycle hooks on create/update/delete (put/delete + cleanup).
4. [x] Add baseline dedicated dashboard controllers (upload/remove/preview) instead of JSON textarea.
5. [ ] Implement S3-compatible writer/cleanup and exact Keystone storage strategy semantics.
6. [ ] Migration script: legacy JSON column -> expanded columns.

### Phase 2 - Relationship parity
1. Implement full relateTo one/many GraphQL contracts (`connect`, `disconnect`, `set`, `create`, `update` as applicable).
2. Support relationship UI display modes (`select`, `count`, `table`) and corresponding AdminMeta.
3. Strengthen filtering/order support and nested relation query behavior.

### Phase 3 - Security + structured fields
1. Password:
   - KDF hashing abstraction + compare retrieval in GraphQL extensions
   - `isSet` filtering semantics
   - validation metadata parity
2. Document/JSON:
   - document-specific structure and safer editor integration
   - JSON controller with validation/errors and optional pretty mode

### Phase 4 - Scalar fidelity
1. Timestamp: date-time controller, defaults (`now`), `updatedAt` semantics.
2. Select/multiselect: enum/integer/string types parity, option validation, displayMode parity.
3. Integer/float/decimal/bigInt:
   - proper numeric parsing/filter/order contracts
   - move decimal/bigInt away from plain String emulation where intended

### Phase 5 - Virtual fields
1. Enforce virtual output contracts and `ui.query` requirements for non-leaf/arg-requiring fields.
2. Align read-only admin behavior and query wiring.

### Phase 6 - Regression suite + migration hardening
1. Add per-field E2E tests (DSL -> Prisma -> GraphQL -> AdminMeta -> dashboard edit/filter).
2. Add schema diff tooling against Keystone for target lists.
3. Ship migrations with data backfills and rollback notes.

---

## Highest-risk constraints

1. **Schema incompatibility risk**: file/image and some numeric types require breaking Prisma/GraphQL changes.
2. **Dashboard coupling risk**: current generic editor paths assume string/JSON; moving to typed controllers changes form state, validation, and mutation payload generation.
3. **Data migration risk**: existing records in JSON/string emulations need deterministic conversion.
4. **Auth/security risk**: password parity requires careful KDF and filter semantics rollout.

---

## Start here (for implementation)

1. `src/features/cms/prisma-schema.ts` - central place where structural divergence starts.
2. `src/features/cms/types.ts` + `src/features/cms/fields/index.ts` - define typed field contracts and DSL validation.
3. `src/features/cms/admin-meta.ts` + `src/features/cms/graphql-client.ts` + `src/components/dashboard/field-value-editor.tsx` - align AdminMeta/controller/filter behavior with typed field semantics.
4. Then implement field-by-field using Keystone references in `packages/core/src/fields/types/<field>/index.ts` and `views/index.tsx`.
