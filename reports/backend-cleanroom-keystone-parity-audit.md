# Backend Clean-room Keystone Parity Audit (TanStack target vs Next starter vs official Keystone)

Date: 2026-05-12

## Executive verdict

**Status: not yet complete parity.** The target has substantial clean-room runtime foundations (custom GraphQL schema/resolvers, auth/session, access/hook layers, memory+prisma adapters, generated artifacts) but still diverges from official Keystone semantics in several **high-risk** backend/CMS contracts.

Top blockers are around:
1. **GraphQL/runtime error semantics and transactionality across many-mutations/nested writes**
2. **Auth/session parity details (sessionData shape, reset token semantics, bearer/cookie edge behavior)**
3. **Access-control and hook error wrapping/ordering differences vs Keystone core behavior**
4. **File/image storage + upload pipeline parity is metadata-only, not full Keystone file API parity**
5. **Generated artifacts vs handwritten runtime drift risks remain**

---

## Scope reviewed

### Target (tanstack-keystone-starter)
- `cms.config.ts`
- `src/features/cms/**` (runtime/auth/access/hooks/adapters/storage/schema)
- `prisma/schema.prisma`, `prisma/seed.ts`
- `scripts/**`
- `.cms/**` generated artifacts
- `package.json` scripts

### Reference product (next-keystone-starter)
- `features/keystone/index.ts`, `access.ts`, `models/**`, `context.ts`, `keystone.ts`

### Official Keystone
- `packages/core/src/**` (selected runtime/access context code)
- `packages/auth/src/schema.ts`

---

## Prioritized findings

## P0 – Critical parity gaps

### P0.1 Many-mutation semantics/atomicity differ from Keystone expectations
**Evidence**
- Target GraphQL runtime returns arrays for `createMany/updateMany/deleteMany`, but resolver implementation builds arrays of per-item operations rather than unified batched semantics:
  - `src/features/cms/runtime.ts` (mutation resolvers: `createMany/updateMany/deleteMany`)
- In Prisma adapter, each mutation item can run in its own transaction unit:
  - `src/features/cms/adapters/prisma.ts` (`create`, `update`, `delete`, and transaction wrapper)
- In memory adapter, transaction is snapshot rollback at adapter scope but nested operations can still experience partial side effects before rollback boundaries:
  - `src/features/cms/adapters/memory.ts`

**Risk**
- Divergence in partial success/failure behavior, especially for nested relationship create/connect across many-mutations.
- Clients expecting Keystone-like failure surface/ordering may observe inconsistent state or mismatch across adapters.

**How to prove**
1. Run Prisma mode: `CMS_ADAPTER=prisma npm run dev`
2. Execute `updateManyTodos` with mixed valid/invalid entries (e.g., one invalid relation connect).
3. Compare DB post-state and error payload to official Keystone behavior (same mutation against next-keystone-starter).

---

### P0.2 `createInitialUser` / first-run semantics are close but not fully Keystone-equivalent
**Evidence**
- Target config sets `initFirstItem` with nested role create:
  - `cms.config.ts:37-57`
- Resolver enforces count===0 with custom error codes and starts session:
  - `src/features/cms/auth/graphql.ts:193-233`
- Memory adapter can boot in seeded mode by default (`CMS_BOOTSTRAP_MODE`), which can suppress first-run flow:
  - `src/features/cms/adapters/memory.ts` (bootstrap mode logic)
- Prisma seed is demo data and explicitly not first-run flow:
  - `prisma/seed.ts`

**Risk**
- First-run UX/contract differs depending on adapter bootstrap mode, causing false negatives for init route behavior.

**How to prove**
- Fresh DB path: `npm run db:reset:fresh` then start Prisma adapter and query `redirectToInit` + `createInitialUser`.
- Fresh memory path: `CMS_ADAPTER=memory CMS_BOOTSTRAP_MODE=fresh npm run dev`.
- Seeded memory path should intentionally skip init; verify clearly documented behavior.

---

### P0.3 Auth/session parity incomplete vs Keystone auth package
**Evidence**
- Target supports cookie and Bearer token extraction:
  - `src/features/cms/auth/session.ts` (`tokenFromRequest`)
- Stateless HMAC session implemented clean-room.
- Auth GraphQL in target lacks some official Keystone validation behavior around auth schema/sessionData checks seen in official package:
  - official: `packages/auth/src/schema.ts` validates identity field compatibility and sessionData query validity.
- Target `getAuthenticatedItem` returns full item fetch via sudo unique lookup:
  - `src/features/cms/auth/graphql.ts:70-73`

**Risk**
- Unexpected acceptance/rejection of auth config that official Keystone would reject.
- Session payload/identity edge cases may drift.

**How to prove**
- Construct invalid `sessionData` fragment and compare startup/runtime failure behavior between target and official/next.
- Test malformed bearer token, expired token, cookie precedence vs Authorization header precedence.

---

## P1 – High importance gaps

### P1.1 Access control error semantics and extension error wrapping differ
**Evidence**
- Target access functions throw direct `GraphQLError` with plain messages:
  - `src/features/cms/access.ts`
- Official Keystone wraps extension/access errors with tagged metadata (`extensionError`, `accessReturnError`, etc.):
  - `packages/core/src/lib/core/access-control.ts` (error wrapping and coercion behavior)

**Risk**
- API consumers and tests expecting Keystone-like error signatures/codes/paths will fail.

**Proof command**
- Create list/field access function that throws; compare GraphQL error extensions between target and next/official.

---

### P1.2 Hook lifecycle ordering is mostly implemented but not fully Keystone-grade under failure/parallel paths
**Evidence**
- Target implements resolveInput -> validateInput -> beforeOperation -> mutation -> afterOperation and delete hooks:
  - `src/features/cms/hooks.ts`
  - adapters call hook stages (`prisma.ts`, `memory.ts`)
- No equivalent of Keystone’s rich extension error tagging around hook failures.
- Many-item operations execute per item; hook failure handling can differ from Keystone list-level mutation semantics.

**Risk**
- Behavior drift during partial failures, especially for `updateMany` and nested relationship creates.

---

### P1.3 `context` surface is good but still diverges in exact contract
**Evidence**
- Target supports: `context.db`, `context.query`, `context.prisma`, `context.graphql.raw/run`, `context.sudo()`, `context.internal()`, `context.transaction()`, `withRequest()`, `withSession()`:
  - `src/features/cms/runtime.ts`
- Official Keystone context has stricter guarantees and broader integration with internal schema/access machinery.

**Risk**
- Internal app code portability from Keystone snippets may break on subtle contract differences (nullability, errors, permissions in subcontexts).

---

### P1.4 Relationship semantics are strong but not fully Keystone-equivalent in all where-unique and inverse sync corner cases
**Evidence**
- Target supports connect/disconnect/set/create (one/many):
  - `src/features/cms/adapters/prisma.ts` (`mapRelationshipWrite`)
  - `src/features/cms/adapters/memory.ts` (`applyRelationshipInput`, `syncInverseRelationship`)
- Uses custom unique resolver path:
  - `src/features/cms/where-unique.ts` (referenced by adapters)

**Risk**
- Some Keystone edge cases around nullable one-to-one ownership, relation side ownership, and unique coercion may differ across adapters.

---

## P2 – Medium parity gaps / drift risks

### P2.1 Image/file/storage parity is metadata-normalization, not full Keystone upload/storage runtime
**Evidence**
- Storage module only config/URL/metadata normalization:
  - `src/features/cms/storage.ts`
- No equivalent first-class upload mutation pipeline parity with official storage adapters.

**Risk**
- Admin/UI and GraphQL upload workflows won’t match Keystone behavior for signed URLs, local storage write paths, cleanup, etc.

---

### P2.2 Public/internal schema split parity not clearly implemented
**Evidence**
- Runtime builds a single executable schema then extends with auth and optional custom extension:
  - `src/features/cms/runtime.ts` (`getCmsGraphQLSchema`)
- No explicit dual schema split equivalent for public/internal exposure boundaries.

**Risk**
- Harder to preserve Keystone-style internal-only operation guarantees.

---

### P2.3 Generated artifact coupling risk
**Evidence**
- Generated artifacts exist: `.cms/schema.graphql`, `.cms/schema.prisma`, `.cms/runtime.ts`, `.cms/types.ts`, `.cms/admin-meta.json`, `.cms/manifest.json`
- Generation scripts and checks exist in package scripts (`cms:generate`, `cms:check`).

**Risk**
- Runtime may drift from generated artifacts without strict CI gate (especially when handwritten runtime evolves).

---

## What is already strong (parity positives)

1. **Clean-room architecture is real** (not importing official Keystone runtime/admin internals in the target core runtime).
2. **Auth primitives present**: password auth, endSession, send/redeem reset token, createInitial flow.
3. **Session transport parity directionally good**: cookie + Bearer extraction.
4. **Access layers present**: operation/filter/item/field with sudo bypass.
5. **Hook phases present** and wired in adapters.
6. **GraphQL CRUD scaffolding + AdminMeta present**, with generated list metadata.
7. **Dual adapters (memory/prisma)** and transaction hooks for parity testing.

---

## File anchors (high-signal)

- Target config/init/auth:
  - `cms.config.ts:37-57` (initFirstItem nested role create)
  - `cms.config.ts:75-86` (db/session/graphql/lists)
  - `src/features/cms/auth/graphql.ts:134-143` (authenticate)
  - `src/features/cms/auth/graphql.ts:144-168` (send reset)
  - `src/features/cms/auth/graphql.ts:169-191` (redeem reset)
  - `src/features/cms/auth/graphql.ts:195-231` (createInitial)

- Session transport:
  - `src/features/cms/auth/session.ts` (Bearer+cookie extraction/start/get/end)

- Runtime context & GraphQL:
  - `src/features/cms/runtime.ts` (context.db/query/prisma/graphql/sudo/internal/transaction)

- Access/hook engines:
  - `src/features/cms/access.ts`
  - `src/features/cms/hooks.ts`

- Adapters:
  - `src/features/cms/adapters/prisma.ts`
  - `src/features/cms/adapters/memory.ts`

- Schema/artifact generation:
  - `src/features/cms/prisma-schema.ts`
  - `.cms/manifest.json`
  - `scripts/cms-generate.ts` + `scripts/compare-cms-prisma-schema.ts` + `scripts/check-cms-prisma-delegates.ts`

- Reference/official:
  - `next-keystone-starter/features/keystone/index.ts`
  - `next-keystone-starter/features/keystone/access.ts`
  - `keystone/packages/auth/src/schema.ts`
  - `keystone/packages/core/src/lib/core/access-control.ts`

---

## Tests/commands to validate each gap

1. **Generated drift gate**
   - `npm run cms:check`
2. **Core CRUD + many mutation behavior**
   - `npm run test:cms`
   - Add targeted mutation fixtures for mixed success/failure in `createMany/updateMany/deleteMany` and compare with next-keystone runtime.
3. **Auth/session**
   - `npm run test:cms:auth`
   - `npm run test:cms:prisma:auth`
   - Manual HTTP tests: bearer vs cookie precedence; invalid/expired signature; reset token replay after redeem.
4. **Prisma runtime parity**
   - `npm run test:cms:prisma`
   - `npm run test:cms:dynamic`
5. **First-run semantics**
   - Prisma fresh: `npm run db:reset:fresh && CMS_ADAPTER=prisma npm run dev`
   - Memory fresh/seeded compare:
     - `CMS_ADAPTER=memory CMS_BOOTSTRAP_MODE=fresh npm run dev`
     - `CMS_ADAPTER=memory CMS_BOOTSTRAP_MODE=seeded npm run dev`

---

## Implementation order (recommended)

1. **P0 transaction/error semantics for many-mutations + nested relations**
2. **P0/P1 auth/session parity hardening** (schema validation, token semantics, deterministic error envelopes)
3. **P1 access/hook error-shape parity with official Keystone**
4. **P1 relationship edge-case matrix across memory+prisma adapters**
5. **P2 storage/upload runtime parity (beyond metadata normalization)**
6. **P2 public/internal schema boundary formalization**
7. **CI hardening for generated-vs-runtime contract checks**

---

## Bottom line

The target is **architecturally aligned with clean-room goals** and already reproduces large portions of Keystone behavior. However, for a **critical migration with strict backend/CMS parity**, it is **not done**: transaction/error semantics, auth/runtime edge parity, and Keystone-compatible failure contracts still need focused completion before declaring production-equivalent parity outside official Keystone runtime.