# Deep Backend Keystone Parity Ledger (TanStack runtime)

Scope audited:
- Target: `/Users/junaid/code/tanstack-keystone-starter`
- Reference app: `/Users/junaid/code/next-keystone-starter`
- Reference upstream: `/Users/junaid/code/keystone`
- Date: 2026-05-13

Legend:
- [x] parity achieved
- [~] partial parity
- [ ] gap

---

## 1) Config + list DSL parity

### 1.1 `config/list/group` API shape
- [~] `config()` and `list()` wrappers exist and are Keystone-like.
  - Target: `src/features/cms/config.ts`, `src/features/cms/keystone/core.ts`
  - Notes: good compatibility for core authoring ergonomics.
- [~] `group()` supports both Keystone-like grouped field object and explicit group arrays.
  - Target: `src/features/cms/config.ts`
  - Gap: behavior is metadata projection, not Keystone compile-time field grouping semantics.

**Priority:** P2

### 1.2 Full Keystone config surface
- [ ] Missing large portions of Keystone config contract (`server`, full `graphql` options, full `db` extensions).
  - Target: `src/features/cms/config.ts`
  - Upstream reference: `packages/core/src/types/config/index.ts`
  - Repro: compare exported `CmsConfig` vs `KeystoneConfigPre`.
  - Command: `grep -n "export type CmsConfig\|KeystoneConfigPre" src/features/cms/config.ts /Users/junaid/code/keystone/packages/core/src/types/config/index.ts`
  - Fix: expand `CmsConfig` to include Keystone-equivalent options (even if runtime ignores some) and explicitly map unsupported keys with deterministic warnings.

**Priority:** P1

---

## 2) Model-file portability

- [~] Local Keystone facade imports exist (`src/features/cms/keystone/*`) and models are authored Keystone-style.
  - Target: `cms.config.ts`, `src/features/cms/keystone/index.ts`, `src/features/cms/models/*.ts`
- [ ] Portability not full: many Keystone config/list-field options are accepted as loose metadata but not semantically executed.
  - Target: `src/features/cms/fields/index.ts`, `src/features/cms/types.ts`
  - Repro: add advanced Keystone field options (graphql.omit/db.map/ui.itemView.fieldMode fn etc.) and observe no runtime effect.
  - Command: `npm run test:cms && npm run test:cms:prisma`
  - Fix: either implement or reject unsupported Keystone options explicitly at normalization time.

**Priority:** P1

---

## 3) Field factories/options parity

- [~] Core factories exist (`text/password/checkbox/select/multiselect/relationship/document/timestamp/integer/float/decimal/bigInt/json/image/file/virtual`).
  - Target: `src/features/cms/fields/index.ts`
- [ ] Factories are permissive and store unsupported options in `fieldMeta`; many Keystone behaviors not implemented.
  - Missing semantic handling examples: storage enforcement, document editor schema enforcement, enum/select backend normalization differences, richer relationship config.
  - Repro: define options in model, inspect generated GraphQL/Prisma/runtime behavior.
  - Command: `npm run cms:generate && npm run cms:check`
  - Fix: per-field option validators + execution paths aligned with Keystone field implementations.

**Priority:** P1

---

## 4) View-order generation parity

- [~] Dynamic view order generation exists and maps Keystone view module paths.
  - Target: `src/features/cms/view-order.ts`
- [~] AdminMeta uses computed indices.
  - Target: `src/features/cms/admin-meta.ts`
- [ ] Divergence risk: fallback/default ordering can differ from Keystone’s build-time resolved ordering for custom view modules.
  - Repro: custom `views` field meta path and compare adminMeta order output.
  - Command: `npm run test:cms`
  - Fix: mirror Keystone’s view path resolution and registry ordering rules.

**Priority:** P2

---

## 5) AdminMeta schema parity

- [~] AdminMeta query exists (`keystone { adminMeta { lists ... } }`) and includes many expected fields.
  - Target: `src/features/cms/runtime.ts`, `src/features/cms/graphql.ts`, `src/features/cms/admin-meta.ts`
- [ ] Semantics differ for dynamic fieldMode functions: GraphQL schema exposes `String`-typed fieldMode values but runtime returns static defaults only.
  - Repro: set function-based fieldMode in config, query adminMeta.
  - Command: `npm run test:cms`
  - Fix: evaluate fieldMode per session/context (Keystone-style) before resolving admin meta.

**Priority:** P1

---

## 6) GraphQL CRUD/filters/order/many mutations/errors

### 6.1 CRUD surface
- [x] CRUD queries/mutations generated per list.
  - Target: `src/features/cms/runtime.ts`

### 6.2 Filters/order
- [~] Scalar + relation filtering implemented.
  - Target: `src/features/cms/runtime.ts`, `src/features/cms/adapters/prisma.ts`
- [~] OrderBy supported, with kind-based exclusions.

### 6.3 Many mutations
- [ ] `createMany/updateMany/deleteMany` resolver implementations return arrays of Promises without `await Promise.all`.
  - Target: `src/features/cms/runtime.ts` (mutation resolvers building arrays via `.map(...)` returning promises)
  - Repro: execute `createManyUsers` and inspect resolver behavior/error timing.
  - Command: `npm run test:cms`
  - Fix: `return Promise.all(...)` for deterministic execution and error semantics.

### 6.4 Error semantics
- [ ] Error codes/messages differ from Keystone’s structured mutation/access/validation errors.
  - Target: `src/features/cms/runtime.ts`, `src/features/cms/access.ts`, `src/features/cms/where-unique.ts`, `src/features/cms/auth/graphql.ts`
  - Repro: invalid whereUnique, denied access, nested relation connect failures.
  - Command: `npm run test:cms && npm run test:cms:auth`
  - Fix: normalize to Keystone-like `extensions.code`/error grouping patterns.

**Priority:** P1

---

## 7) Auth/sessionData/init/password reset parity

- [~] auth extension includes authenticate/endSession/authenticatedItem/initFirstItem/reset link + redeem.
  - Target: `src/features/cms/auth/graphql.ts`
- [ ] `sessionData` config is accepted but not actually used for session materialization.
  - Target: `src/features/cms/config.ts` (`auth.sessionData`), `src/features/cms/runtime.ts` (`sessionForUser` hardcoded role projection)
  - Repro: change `sessionData` in `cms.config.ts`; runtime session payload unchanged.
  - Command: `npm run test:cms:auth`
  - Fix: parse/execute `sessionData` selection against auth list and use it when building session.
- [ ] Password reset token persistence assumes fields exist (`passwordResetToken/passwordResetIssuedAt/passwordResetRedeemedAt`) rather than Keystone’s internal mechanism.
  - Target: `src/features/cms/auth/graphql.ts`, models
  - Repro: remove these fields and request reset.
  - Fix: internal reset-token store abstraction or enforce required hidden fields in auth-enabled list.
- [ ] Development auth fallback (`x-cms-user-id`, `CMS_DEV_AUTH_FALLBACK`) is non-Keystone behavior.
  - Target: `src/features/cms/runtime.ts`
  - Fix: keep as optional TanStack hosting shim, but disabled-by-default + documented non-parity.

**Priority:** P1

---

## 8) Access + hook lifecycle parity

- [~] operation/filter/item/field access APIs exist.
  - Target: `src/features/cms/access.ts`
- [~] hook phases exist and deterministic field ordering applied.
  - Target: `src/features/cms/hooks.ts`, `src/features/cms/adapters/prisma.ts`
- [ ] Not fully Keystone-equivalent around multi-error accumulation and message structure.
  - Repro: throw in multiple field hooks; compare error envelopes.
  - Command: `npm run test:cms`
  - Fix: implement Keystone-like error collection + grouped GraphQL errors.

**Priority:** P1

---

## 9) Context API parity

- [~] `context.db`, `context.query`, `context.graphql.raw/run`, `sudo()`, `withSession()`, `withRequest()`, transactions exist.
  - Target: `src/features/cms/runtime.ts`, `src/features/cms/adapters/types.ts`
- [x] Baseline public/internal schema split exists (Keystone has both via `createSystem` and internal schema bypass rules).
  - Target: `src/features/cms/runtime.ts`
  - Upstream: `packages/core/src/lib/system.ts` creates `{ public, internal }`
  - Notes: target now exposes public/internal schemas and wires `context.internal()` / `context.sudo()` to internal privileged behavior. Remaining work is exact edge-case conformance and Keystone error-envelope parity.

**Priority:** P0

---

## 10) Prisma schema/migrations/artifacts/seeds parity

- [~] Prisma schema generation from CMS lists exists.
  - Target: `src/features/cms/prisma-schema.ts`, `scripts/cms-generate.ts`
- [~] Preflight delegate checks exist.
  - Target: `src/features/cms/adapters/prisma-preflight.ts`
- [ ] Generator simplifications diverge from Keystone on nuanced relation ownership, defaults, field db mapping, and provider-specific behavior.
  - Repro: complex bidirectional relationships + custom db settings.
  - Command: `npm run cms:generate && npm run cms:check:prisma`
  - Fix: align generator logic with Keystone’s list/field DB layer semantics (or import closer compatibility layer).
- [ ] Migration/artifact lifecycle not equivalent to Keystone artifact pipeline checks.
  - Target: package scripts + local generator; no Keystone-style artifact validation breadth.

**Priority:** P1

---

## 11) Relationship semantics parity

- [~] connect/create/disconnect/set shapes supported for to-one/to-many.
  - Target: `src/features/cms/runtime.ts`, `src/features/cms/adapters/prisma.ts`
- [ ] Edge semantics may diverge for ownership, nested mutation transaction behavior, and conflict handling.
  - Repro: chained nested creates/sets across multiple relationship fields.
  - Command: `npm run test:cms:prisma`
  - Fix: add parity tests against Keystone fixtures and adjust relation write mapper.

**Priority:** P1

---

## 12) Virtual fields parity

- [~] virtual field kind + resolver + GraphQL return type support exists.
  - Target: `src/features/cms/fields/index.ts`, `src/features/cms/runtime.ts`
- [ ] Keystone’s richer virtual typing/integration behaviors are not fully mirrored.
  - Repro: custom complex return types and relation-dependent virtuals.
  - Fix: stricter schema typing and resolver contract parity.

**Priority:** P2

---

## 13) Image/file/upload/storage parity

- [x] Local upload endpoint persists file bytes and returns stored metadata.
  - Target: `src/routes/api/cms/upload.ts`, `src/features/cms/storage.ts`
  - Validation: `npm run test:cms:storage`, `npm run test:cms:upload`
  - Notes: local storage now writes bytes under `public/files`, extracts real PNG/GIF/JPEG/WebP image dimensions, rejects invalid image bytes, derives image extension from detected bytes, and cleans up replaced/deleted local files.
- [~] Storage config modeling exists but is partial.
  - Target: `src/features/cms/storage.ts`, `src/features/cms/storage-config.ts`, `src/features/cms/storage-url.ts`
  - Notes: local storage is implemented; S3-compatible put/delete remains outstanding.

**Priority:** P0

---

## 14) Public/internal schema split parity

- [x] Baseline dual schema architecture exists.
  - Target: `src/features/cms/runtime.ts`
  - Upstream reference: `/Users/junaid/code/keystone/packages/core/src/lib/system.ts`
  - Notes: `getCmsGraphQLSchema('public' | 'internal')`, `getCmsGraphQLSchemas()`, `context.internal()`, and `context.sudo()` exist; public schema respects baseline `graphql.omit`, internal schema restores omitted fields/lists/operations and is privileged.
  - Remaining: exact Keystone internal/public schema error-envelope and edge-case parity still needs broader conformance tests.

**Priority:** P0

---

## 15) Test parity coverage

- [~] Scripted validations exist (`test:cms`, `test:cms:auth`, `test:cms:prisma`, etc.).
  - Target: `package.json`, `scripts/validate-cms-*.ts`
- [ ] No evidence of broad Keystone-level backend conformance matrix (especially edge-case GraphQL error semantics and internal schema behavior).
  - Repro: inspect `src` for unit/integration tests (`find` found none under src test patterns).
  - Command: `find src -name "*test*.ts" -o -name "*.spec.ts"`
  - Fix: add parity test suite mapped 1:1 to Keystone behaviors listed in this ledger.

**Priority:** P1

---

## Consolidated critical gaps (must-fix for backend parity claim)

1. [x] **P0** Public/internal GraphQL schema split missing.
   - Files: `src/features/cms/runtime.ts`
   - Baseline implemented; exact conformance tests remain.
2. [x] **P0** Upload/storage not persisting bytes (metadata-only stub).
   - Files: `src/routes/api/cms/upload.ts`, `src/features/cms/storage.ts`
   - Local storage implemented; S3 remains outstanding.
3. [x] **P1** `sessionData` not honored; session shape hardcoded.
   - Files: `src/features/cms/runtime.ts`, `src/features/cms/auth/graphql.ts`, `cms.config.ts`
   - Configured selection-like session data is materialized for selected scalar/nested role fields.
4. [x] **P1** many-mutation resolver async semantics (`Promise[]` return patterns).
   - Files: `src/features/cms/runtime.ts`
   - Preserved GraphQL item-level partial error behavior.
5. [ ] **P1** Error and hook/access semantics not fully Keystone-structured.
   - Files: `src/features/cms/access.ts`, `src/features/cms/hooks.ts`, `src/features/cms/runtime.ts`
6. [ ] **P1** Prisma generation/relationship ownership semantics simplified vs Keystone.
   - Files: `src/features/cms/prisma-schema.ts`, `src/features/cms/adapters/prisma.ts`

---

## Suggested execution plan (ordered)

- [ ] Phase A (P0): implement dual schema + storage writes and add regression tests.
- [ ] Phase B (P1): sessionData execution, many mutation resolver fix, error envelope parity.
- [ ] Phase C (P1/P2): deeper field option semantics, view-order edge parity, virtual typing hardening.

---

## Reproduction command set (quick runbook)

```bash
cd /Users/junaid/code/tanstack-keystone-starter
npm run cms:generate
npm run cms:check
npm run test:cms
npm run test:cms:auth
npm run test:cms:prisma
npm run test:cms:dynamic
```

For live API checks:
```bash
npm run dev
# GraphQL endpoint: /api/graphql
# Upload endpoint: /api/cms/upload
```

---

## Verdict

Current state is **substantial partial parity**, not deep backend parity with Keystone runtime semantics. The TanStack project has a strong compatibility scaffold, but P0/P1 gaps above prevent claiming “internalized Keystone behavior” beyond hosting/runtime shell differences.