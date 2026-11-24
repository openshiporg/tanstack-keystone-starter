# Backend Parity Audit: tanstack-keystone-starter vs next-keystone-starter + Keystone Core

## Scope
Compared target:
- `src/features/cms/**`
- `cms.config.ts`
- `prisma/**`
- `scripts/**`
- package scripts
- `.cms/*` artifacts

Against reference:
- `next-keystone-starter/features/keystone/**`
- Keystone canonical internals in `keystone/packages/core/src/**`, `keystone/packages/auth/src/**`, and field types.

---

## Executive Summary
The target has a substantial custom Keystone-like runtime, but it is **not yet backend-semantic parity** with Keystone/next-keystone-starter for several critical areas:

- **GraphQL semantics diverge** (omit flags, non-null semantics, maxTake enforcement, where/not shape)
- **Auth/session behavior diverges** (sessionData hydration, identity-field validation, reset-token model assumptions)
- **Field runtime parity is incomplete** for `image`/`file`/`virtual` and upload semantics
- **Access+hooks integration has gaps** around canonical Keystone operation pipeline semantics
- **Prisma model generation diverges** (multi-field image/file storage, relation ownership/constraints, uniqueWhere exposure)
- **Generated artifacts are custom and drift from expected Keystone contract details**

These gaps include multiple **Critical/High** blockers for runtime correctness and migration safety.

---

## Findings by Severity

## Critical

### 1) Image/File field runtime is not Keystone-compatible (upload/storage semantics missing)
**Files:**
- `src/features/cms/fields/index.ts`
- `src/features/cms/storage.ts`
- `src/features/cms/runtime.ts`
- `src/features/cms/prisma-schema.ts`
- Keystone ref: `packages/core/src/fields/types/image/index.ts` (+ analogous file field implementation)

**Problem:**
- Target treats `image`/`file` as JSON-ish metadata (`fieldOutputType` returns `JSON`, `scalarPrismaType` maps image/file to `Json`), not Keystone’s structured multi-column field with upload pipeline.
- No GraphQL `Upload` input handling or stream ingestion. No `ImageFieldInput.upload`, no metadata extraction, no file deletion hook parity.
- Storage config exists (`storage.ts`) but is not integrated into create/update mutation input resolution the way Keystone does.

**Impact:**
- Breaks correctness for real uploads, file lifecycle, URL generation, cleanup on update/delete, and schema parity.

**Fix:**
- Implement Keystone-style field adapters for `image` and `file`:
  - GraphQL input object with `upload`.
  - Stream-based resolver, metadata extraction, storage put/delete.
  - Multi-column Prisma representation (id/extension/filesize/etc for image).
  - Field output type object (not JSON scalar).
- Wire into hooks lifecycle for delete/update cleanup.

---

### 2) GraphQL filtering semantics diverge from Keystone core (`NOT` shape wrong)
**Files:**
- `src/features/cms/runtime.ts` (`generateListTypeDefs`)
- Keystone ref: `packages/core/src/lib/core/initialise-lists.ts` (`where` input construction)

**Problem:**
- Target defines: `NOT: <WhereInput>`
- Keystone defines: `NOT: [<WhereInput>!]`

**Impact:**
- Runtime/API mismatch for clients/tools expecting Keystone schema behavior; breaks parity tests and migration assumptions.

**Fix:**
- Change generated `where` input to Keystone shape (`NOT` as list).
- Re-run `.cms/schema.graphql` generation and dependent query clients.

---

### 3) Prisma schema generation for image/file and complex field kinds is non-parity
**Files:**
- `src/features/cms/prisma-schema.ts`
- `.cms/schema.prisma`
- Keystone ref: `packages/core/src/lib/core/initialise-lists.ts` + field type implementations

**Problem:**
- `image`, `file`, `document`, `json`, `multiselect` all flattened to `Json` scalar in target generator.
- Keystone uses field-defined db shapes (including multi-field `kind: 'multi'` for image/file and richer field-level prisma behavior).

**Impact:**
- Data model mismatch, impossible direct parity with Keystone runtime semantics, migration drift, broken portability of Keystone models.

**Fix:**
- Move prisma generation from kind-based shortcuts to field-type db contract-driven generation:
  - Respect field-specific `dbField`/multi field expansion.
  - Mirror Keystone relation and scalar mapping rules per field type.

---

## High

### 4) `graphql.omit`, list/field isEnabled gates, and maxTake behavior missing/incomplete
**Files:**
- `src/features/cms/config.ts`
- `src/features/cms/runtime.ts`
- Keystone ref: `packages/core/src/lib/core/initialise-lists.ts` (`getIsEnabled`, `getIsEnabledField`, maxTake wiring)

**Problem:**
- Target runtime does not fully implement Keystone omit/isEnabled matrix for type/query/create/update/delete/filter/orderBy per list+field.
- `graphql.maxTake` not represented/enforced in generated list query args/resolvers.

**Impact:**
- Exposes operations/fields Keystone would hide; pagination guardrails differ.

**Fix:**
- Add full isEnabled computation during list initialization.
- Gate schema generation and resolver accessibility by those flags.
- Add maxTake defaulted non-null arg behavior and enforce cap in query resolver path.

---

### 5) Session strategy wrapping lacks Keystone auth `sessionData` hydration contract
**Files:**
- `src/features/cms/auth/graphql.ts`
- `src/features/cms/runtime.ts` (`sessionForUser`)
- Keystone ref: `packages/auth/src/index.ts` (`authSessionStrategy`)
- Keystone ref: `packages/auth/src/schema.ts` (sessionData validation)

**Problem:**
- Keystone wraps session strategy `.get()` and hydrates `session.data` from configured `sessionData` GraphQL query.
- Target hardcodes `sessionForUser` shape (name/role subset), not `sessionData`-driven output.
- No schema-validated `sessionData` query compilation.

**Impact:**
- Access rules and UI logic depending on custom sessionData fields can silently break.

**Fix:**
- Implement auth session wrapper equivalent:
  - On get, resolve user by `itemId` and run configured `sessionData` selection.
  - Validate `sessionData` query against schema during startup.

---

### 6) Identity field validation missing in auth config
**Files:**
- `src/features/cms/keystone/auth.ts` (exists partial checks)
- `src/features/cms/auth/graphql.ts`
- Keystone ref: `packages/auth/src/schema.ts`

**Problem:**
- Keystone enforces that identity field is uniquely queryable with String/ID in `whereUnique`.
- Target checks list/field existence but does not enforce equivalence.

**Impact:**
- Misconfigured auth may work unpredictably or fail at runtime.

**Fix:**
- During auth schema extension, introspect `WhereUniqueInput` for identity field type and reject invalid config.

---

### 7) Access/hook pipeline parity is partial and likely diverges on edge cases
**Files:**
- `src/features/cms/hooks.ts`
- `src/features/cms/runtime.ts`
- `src/features/cms/access.ts`
- Keystone ref: core list initialization + hooks/access internals

**Problem:**
- Hook functions exist, but canonical Keystone sequence/shape (especially combined field+list validate/before/after semantics and per-op data contracts) is only partially mirrored.
- Need strict verification for many/updateMany/deleteMany transaction + hook ordering parity.

**Impact:**
- Behavior differences under validation failures, nested mutations, and delete hooks.

**Fix:**
- Align hook invocation to Keystone operation pipeline (including error bubbling and operation boundaries).
- Add snapshot parity tests for create/update/delete and many-mutations with hooks.

---

### 8) AdminMeta field metadata parity gaps (filterability defaults, nullability, view metadata)
**Files:**
- `src/features/cms/admin-meta.ts`
- `src/features/cms/view-order.ts`
- `.cms/admin-meta.json`, `.cms/view-order.json`
- Keystone ref: `packages/core/src/lib/core/initialise-lists.ts` + admin metadata generation path

**Problem:**
- Target computes `isFilterable` default without excluding `json` (runtime excludes json in `fieldFilterType`), causing metadata/schema inconsistency.
- `isNonNull` emitted as tuple array, not clearly mapped to Keystone read/create/update flags.
- View-order generation uses encountered order; Keystone-derived reference uses initialization view paths and stable mappings.

**Impact:**
- Dashboard form/list behavior drift and incorrect feature gating.

**Fix:**
- Derive AdminMeta from resolved field graphql/ui contracts rather than ad-hoc kind heuristics.
- Ensure `isFilterable/isOrderable/isNonNull` exactly match schema-enable logic.

---

### 9) Missing/partial support for virtual field GraphQL typing semantics
**Files:**
- `src/features/cms/fields/index.ts`
- `src/features/cms/runtime.ts` (`fieldOutputType`)
- Keystone ref: `packages/core/src/fields/types/virtual/index.ts`

**Problem:**
- Target allows `graphQLReturnType` string, but lacks richer Keystone typed output and schema integration semantics.

**Impact:**
- Complex virtual outputs/interfaces may not be representable.

**Fix:**
- Add typed virtual field output contract aligned to Keystone’s GraphQL field composition.

---

## Medium

### 10) `createMany/updateMany/deleteMany` return/error semantics may diverge
**Files:**
- `src/features/cms/runtime.ts` (mutation resolvers and context APIs)

**Problem:**
- Resolver implementations map arrays with per-item transactions and return arrays of promises/items; parity of partial failure and ordering needs strict match with Keystone behavior.

**Fix:**
- Normalize many-mutation execution strategy and failure semantics to Keystone core (atomicity expectations per op).

---

### 11) Seed/fresh/init flow differs from Keystone-first initialization semantics
**Files:**
- `prisma/seed.ts`
- `cms.config.ts` (initFirstItem configured)
- scripts in `package.json`

**Problem:**
- Demo seed deletes/recreates full dataset; Keystone bootstrap behavior is init-first-user flow.
- Target comments acknowledge this, but scripts still default `db:seed` to demo data.

**Fix:**
- Separate parity-critical flows:
  - `fresh` path with zero users -> `createInitialUser`
  - optional demo seed as distinct non-parity task
- Ensure docs/scripts don’t conflate.

---

### 12) `.cms` artifact contract is custom and not Keystone-equivalent
**Files:**
- `scripts/cms-generate.ts`
- `.cms/manifest.json`, `.cms/types.ts`, `.cms/runtime.ts`

**Problem:**
- Generated artifacts intentionally custom (`__generated` envelope, custom types/runtime helper).
- Good for internal tooling, but not parity with Keystone’s generated admin/runtime contracts.

**Fix:**
- Keep artifacts internal if no external dependency; otherwise document non-parity boundary and avoid claiming compatibility.

---

## Low

### 13) Auth reset token fields are hardcoded conventions on User model
**Files:**
- `src/features/cms/auth/graphql.ts`
- `src/features/cms/models/User.ts`

**Problem:**
- Password reset implementation assumes `passwordResetToken/passwordResetIssuedAt/passwordResetRedeemedAt` exist and are writable via sudo.
- Unlike Keystone auth token extension patterns, this is app-convention coupled.

**Fix:**
- Either formalize as required auth extension contract or abstract token storage strategy.

---

## Priority Fix Plan
1. **Field/storage runtime parity (Critical)**: implement true `image`/`file` Upload pipeline + Prisma representation.
2. **GraphQL schema parity (Critical/High)**: `NOT` list semantics, omit/isEnabled, maxTake.
3. **Auth/session parity (High)**: sessionData hydration wrapper + identity validation.
4. **AdminMeta/view-order correctness (High)**: derive from resolved contracts, remove heuristic mismatches.
5. **Hook/access pipeline hardening (High)**: align sequence + many-op behavior; add parity tests.
6. **Prisma generation fidelity (Critical)**: migrate to field db contracts.

---

## Exact File Hotspots to Change
- `src/features/cms/runtime.ts` (GraphQL typegen/resolvers, many ops, context session handling)
- `src/features/cms/prisma-schema.ts` (model generation contract)
- `src/features/cms/fields/index.ts` (+ add dedicated field runtime modules for image/file/virtual)
- `src/features/cms/storage.ts` (integrate with resolver pipeline, not just metadata helper)
- `src/features/cms/auth/graphql.ts` + `src/features/cms/keystone/auth.ts` (sessionData and auth validation parity)
- `src/features/cms/admin-meta.ts` + `src/features/cms/view-order.ts` (metadata parity)
- `scripts/cms-generate.ts` (artifact fidelity and schema/adminmeta generation from resolved contracts)
- `package.json` scripts + `prisma/seed.ts` (fresh/init parity workflow clarity)

---

## References Used
- Target:
  - `cms.config.ts`
  - `package.json`
  - `src/features/cms/runtime.ts`
  - `src/features/cms/config.ts`
  - `src/features/cms/auth/graphql.ts`
  - `src/features/cms/auth/session.ts`
  - `src/features/cms/hooks.ts`
  - `src/features/cms/admin-meta.ts`
  - `src/features/cms/storage.ts`
  - `src/features/cms/fields/index.ts`
  - `src/features/cms/prisma-schema.ts`
  - `src/features/cms/models/User.ts`
  - `src/features/cms/models/TodoImage.ts`
  - `src/features/cms/view-order.ts`
  - `scripts/cms-generate.ts`
  - `prisma/seed.ts`
  - `.cms/*`
- next-keystone-starter:
  - `features/keystone/index.ts`
  - `features/keystone/context.ts`
  - `features/keystone/access.ts`
  - `features/keystone/view-order/*`
- official Keystone:
  - `packages/auth/src/index.ts`
  - `packages/auth/src/schema.ts`
  - `packages/core/src/lib/core/initialise-lists.ts`
  - `packages/core/src/fields/types/image/index.ts`
