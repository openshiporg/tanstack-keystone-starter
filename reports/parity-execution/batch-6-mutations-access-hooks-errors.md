# Batch 6 mutation/access/hooks/error semantics

Date: 2026-05-20

## What changed

Implemented a focused Batch 6 parity pass guided primarily by:
- `reports/parity-dissertation/08-runtime-mutations-access-hooks-errors.md`
- `reports/parity-dissertation/10-validation-acceptance-matrix.md`
- `reports/parity-dissertation/07-runtime-graphql-context-auth.md` (interaction points only)

### 1) Many-mutation behavior now fails per item instead of failing the whole field
- Reworked GraphQL many-mutation resolvers in `runtime.ts` so `createMany`, `updateMany`, and `deleteMany` no longer short-circuit on a single top-level `assertOperationAccess(...)` call before mapping inputs.
- Operation access is now checked inside each item promise, which lets GraphQL return ordered `null` elements plus per-item errors instead of collapsing the whole field.
- This materially improves parity with Keystone-style partial-many behavior without attempting a giant all-settled executor rewrite.

### 2) Runtime filter access enforcement was tightened where practical
- Added `assertFilterAccess(...)` in `access.ts`.
- List query/count resolvers now validate incoming `where` filters before adapter execution.
- Update/delete resolvers also validate the supplied `where` input before dispatching to adapters.
- Added a `KS_FILTER_DENIED`-style error path for explicitly denied dynamic filterability.
- This is an incremental improvement: the target still does not have full official field-order access traversal parity, but runtime `where` checking is now materially better than schema-time-only omission.

### 3) Access return/error envelopes are more Keystone-shaped
- Added new structured error families in `errors.ts`:
  - `KS_ACCESS_RETURN_ERROR`
  - `KS_RELATIONSHIP_ERROR`
  - `KS_EXTENSION_ERROR`
  - `KS_FILTER_DENIED`
- Access function execution in `access.ts` now:
  - wraps thrown access-function errors as `KS_EXTENSION_ERROR`
  - treats invalid access return types as `KS_ACCESS_RETURN_ERROR`
- This closes a concrete audit gap where bad access implementations previously surfaced as generic validation failures.

### 4) Create/update access ordering improved materially in both adapters
- Memory and Prisma create/update paths now check list item access and raw input field write access **before** hook/input resolution for explicitly provided user input fields.
- This moves the runtime closer to the audited Keystone ordering target where denied user writes do not get as far into mutation/hook execution.
- Existing post-resolution behavior was kept where useful, but the major “hooks run before obvious denied raw input” drift is materially reduced.

### 5) Hook lifecycle was tightened in a focused, safe way
- `beforeOperation` and `afterOperation` field hooks now only run for fields present in raw `inputData` during create/update.
- `validateInput` field hooks were similarly narrowed to input-present fields for create/update.
- `resolveInput` remains broader so existing defaulting behavior (for example the Todo `assignedTo` default hook) still works.
- This is a practical middle ground: it reduces the biggest hook-scope drift without breaking current defaults or attempting a full nested after-operation queue redesign in one slice.

### 6) Relationship input validation is stricter and now returns relationship-specific errors
- Added focused relationship input-shape validation in both memory and Prisma adapters.
- The batch now rejects several previously-permissive invalid combinations with `KS_RELATIONSHIP_ERROR`, including:
  - to-one relationship inputs specifying more than one of `connect` / `create` / `disconnect`
  - to-one `disconnect` during create
  - to-many update inputs mixing `set` and `disconnect`
- This does not yet implement full official aggregated nested relationship error collection, but it closes an important concrete semantics gap from the audit.

### 7) Memory/Prisma behavior remains aligned on missing-target semantics
- Batch 1 already changed single update/delete missing-target behavior from silent `null` to access-denied errors.
- Batch 6 keeps that behavior intact while improving the surrounding many-mutation and access-ordering semantics.

### 8) Validation coverage was extended for the new semantics
- `scripts/validate-cms-crud.ts` now additionally checks:
  - denied `createMany` returns ordered `null` items with per-item access errors instead of failing the whole field
  - invalid to-one nested relationship combinations produce `KS_RELATIONSHIP_ERROR`
- Existing CRUD/auth/runtime coverage remained green.

## Exact files changed

- `src/features/cms/runtime.ts`
- `src/features/cms/access.ts`
- `src/features/cms/hooks.ts`
- `src/features/cms/errors.ts`
- `src/features/cms/adapters/memory.ts`
- `src/features/cms/adapters/prisma.ts`
- `src/features/cms/types.ts`
- `src/features/cms/admin-meta.ts`
- `scripts/validate-cms-crud.ts`

## Validations run and results

### Required validations
- `npm run lint` ✅ passed
- `npm run test:cms` ✅ passed
- `npm run build` ✅ passed

### Additional targeted validation
- `npm run test:cms:auth` ✅ passed

## Remaining blockers / follow-up notes

This batch intentionally stayed incremental and did **not** attempt a full mutation-engine rewrite.

### Improved materially in this batch
- per-item many-mutation failure behavior
- runtime filter-access enforcement
- access return/error envelopes
- create/update raw-input access ordering
- field-hook scope for create/update input
- relationship input shape validation

### Still not fully done
- No official Keystone-style all-settled error-order helper equivalent yet; behavior is materially better because per-item promises now fail independently, but exact multi-error ordering semantics are still not guaranteed to match Keystone’s dedicated ordering shim.
- No nested `afterOperation` queue / deferred child-after-parent lifecycle yet.
- No full `addValidationError(...)` aggregation contract for hooks yet.
- No deep runtime `orderBy` access traversal parity yet.
- Relationship errors are now typed better, but not yet aggregated into full official multi-error relationship envelopes.
- Access checking still does not perfectly mirror every official distinction between raw input, resolved input, and hook-added fields.

### Practical note
This batch is a meaningful semantics improvement, but it should be described as **material parity progress**, not as full official mutation-engine parity. The remaining work is mostly in the deeper lifecycle/error-ordering layer rather than the obvious top-level behavior now.
