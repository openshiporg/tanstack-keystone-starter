# Batch 1 correctness blockers

Date: 2026-05-19

## What changed

Implemented the scoped Batch 1 correctness fixes from `reports/parity-dissertation/00-master-parity-dissertation-and-roadmap.md`.

### 1) `internal()` vs `sudo()` semantics fixed
- Changed access bypass logic so only `context.__internal.sudo === true` bypasses access.
- `context.internal()` still switches to the internal schema/context shape, but no longer implicitly bypasses operation/filter/item/field access.
- Updated auth validation coverage to assert that `internal()` preserves access errors for anonymous requests instead of bypassing them.

### 2) Missing singleton / missing item route bug fixed
- Removed the dead/undefined `MissingSingletonItem` render path from `src/routes/dashboard/$listKey.$id.tsx`.
- The existing in-file fallback branches for:
  - missing singleton `/1` -> singleton create / missing singleton message
  - missing non-singleton item -> not-found message
  are now reachable again.

### 3) Relationship `refSearchFields` / `refLabelField` now honored
- Extended dashboard relationship option fetching/hydration to accept per-field relationship option config.
- Relationship option search now uses `field.fieldMeta.refSearchFields` when present.
- Relationship option labels now use `field.fieldMeta.refLabelField` when present.
- Wired both the relationship editor and relationship filter input to pass that metadata through both option lookup and selected-ID hydration.

### 4) Many-relationship filter edit state corruption fixed
- Stopped flattening parsed filter arrays into comma-joined strings when reopening filter pills for editing.
- Relationship filter edit state now preserves array values, and the relationship filter input can also recover gracefully from legacy comma-joined strings.

### 5) Update/delete missing-target semantics fixed
- Memory adapter update/delete now throw `KS_ACCESS_DENIED`-style errors instead of silently returning `null` when the target item is missing.
- Prisma adapter update/delete now do the same when `findForMutation(...)` returns no accessible target.
- Added targeted validation coverage for missing update/delete targets in both memory and Prisma validation scripts.

### 6) Memory adapter field-create access tightened
- Added scalar field create-access enforcement in the memory adapter for explicitly provided scalar inputs.
- Kept default/hidden system fields from being blocked by create-access rules unless they were actually provided in input.

### 7) Validation hardening updates
- Updated `scripts/validate-cms-auth.ts` for the corrected `internal()` semantics.
- Added missing-target update/delete assertions to:
  - `scripts/validate-cms-crud.ts`
  - `scripts/validate-cms-prisma.ts`
- Adjusted one cleanup path in `scripts/validate-cms-crud.ts` to avoid unrelated latent delete-many transaction/rollback interference during partial-failure role cleanup.

## Exact files changed

- `src/features/cms/access.ts`
- `src/routes/dashboard/$listKey.$id.tsx`
- `src/features/cms/graphql-client.ts`
- `src/components/dashboard/views/relationship-filter-input.tsx`
- `src/components/dashboard/relationship-field-editor.tsx`
- `src/components/dashboard/filter-bar.tsx`
- `src/features/cms/adapters/memory.ts`
- `src/features/cms/adapters/prisma.ts`
- `scripts/validate-cms-auth.ts`
- `scripts/validate-cms-crud.ts`
- `scripts/validate-cms-prisma.ts`

## Validations run and results

### Required validations
- `npm run lint` ✅ passed
- `npm run test:cms` ✅ passed
- `npm run test:cms:auth` ✅ passed
- `npm run build` ✅ passed

### Additional targeted validation
- `npm run cms:check` ✅ passed

## Remaining blockers / follow-up notes

These Batch 1 fixes are intentionally narrow. The following major parity items remain open and were not addressed in this slice:

- AI sidebar/backend parity (`/api/completion`, live transport, AI config parity)
- broader list/filter/sort operator-contract parity
- create/item controller architecture parity
- official many-mutation all-settled / ordered multi-error parity
- deeper hook/access lifecycle ordering parity
- stricter nested relationship input validation / aggregated relationship errors
- S3 / multipart HTTP / document-field parity
- browser/dashboard acceptance suite and HTTP transport acceptance suite

### Important note
- `internal()` no longer bypasses access. Any future tests or product assumptions relying on `internal()` behaving like `sudo()` must now use `sudo()` explicitly.
- The partial-failure role cleanup adjustment in `scripts/validate-cms-crud.ts` avoids an unrelated existing delete-many transactional edge case; it does **not** claim that delete-many official parity is complete.
