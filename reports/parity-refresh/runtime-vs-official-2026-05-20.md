# Runtime/CMS parity refresh vs official Keystone

Date: 2026-05-20  
Target repo: `/Users/junaid/code/tanstack-keystone-starter`  
Official reference: `/Users/junaid/code/keystone`

## Scope and method

This refresh started from the earlier parity dissertation reports, especially:

- `reports/parity-dissertation/06-runtime-config-dsl-adminmeta.md`
- `reports/parity-dissertation/07-runtime-graphql-context-auth.md`
- `reports/parity-dissertation/08-runtime-mutations-access-hooks-errors.md`
- `reports/parity-dissertation/09-runtime-prisma-storage-upload.md`
- `reports/parity-dissertation/10-validation-acceptance-matrix.md`

But findings below are based on direct re-inspection of the **current target code** and **current official Keystone source**, not on trusting those reports as-is.

---

## Executive summary

**Honest parity status:** the starter is now a **credible Keystone-inspired runtime with meaningful surface compatibility**, but it is **not yet at real runtime/CMS parity** with official Keystone.

The repo has improved materially since the earlier audits:

- `createAuth()` now wraps the session strategy and validates more config than before (`src/features/cms/keystone/auth.ts:20-49`, `52-84`).
- `context.internal()` no longer bypasses access; only `sudo()` does (`src/features/cms/access.ts:34-35`, `src/features/cms/runtime.ts:708-709`), and this is now explicitly asserted in tests (`scripts/validate-cms-auth.ts:114-121`).
- `graphql.raw()` now uses `graphql()` validation/execution semantics rather than direct `execute()` shortcuts (`src/features/cms/runtime.ts:720-726`).
- HTTP multipart upload coverage now exists, not just in-process GraphQL execution (`package.json:25`, `scripts/validate-cms-graphql-upload-http.ts:31-71`).
- There is now at least some dashboard route-guard test coverage under `tests/` (`tests/dashboard-route-guards.test.ts`).

However, the remaining gaps are still substantial in the places that define true Keystone parity:

1. **`config()` / `list()` / `group()` semantics are still much looser than official Keystone.**
2. **Admin metadata is still much thinner than Keystone’s `adminMeta` model.**
3. **Mutation semantics, nested relationship behavior, and hook lifecycle still diverge from official Keystone.**
4. **Field implementations remain generic config objects, not Keystone field implementations with per-field validators and admin/runtime metadata.**
5. **Storage/provider/document parity is still incomplete, especially S3 and document field behavior.**

So the repo is **well past “toy stub” territory**, but **not yet parity-safe for claiming “official Keystone runtime/CMS parity.”**

---

## 1) Current honest parity status

### What is now genuinely close enough

#### Context/auth runtime surface: partial-good
The target now exposes a much more Keystone-like auth/context contract:

- `createAuth()` validates list/field presence, unique-ish identity field, required identity field, password secret field, and wraps `session.get()` to hydrate `session.data` via `context.sudo().query[...]` (`src/features/cms/keystone/auth.ts:20-49`, `52-84`).
- This is directionally aligned with official auth session wrapping in `@keystone-6/auth` (`/Users/junaid/code/keystone/packages/auth/src/index.ts:119-154`, `211-285`).
- `sessionData` validation now exists at GraphQL schema extension build time (`src/features/cms/auth/graphql.ts:84-96`), matching official validation intent (`/Users/junaid/code/keystone/packages/auth/src/schema.ts:54-69`).
- `context.internal()` and `context.sudo()` are now distinct in the right direction (`src/features/cms/runtime.ts:708-709`; access bypass only checks sudo in `src/features/cms/access.ts:34-35`).
- `graphql.raw()` now runs through `graphql()` (`src/features/cms/runtime.ts:720-726`), matching official behavior more closely than the prior direct-execute shortcut.

#### Upload transport: improved and now evidence-backed
Earlier audits were stale on HTTP upload acceptance.

Current evidence:

- `test:cms:upload` now runs both in-process and HTTP upload validations (`package.json:25`).
- `scripts/validate-cms-graphql-upload-http.ts:31-71` performs a real multipart GraphQL request against Yoga and verifies stored bytes on disk.

This closes an important earlier uncertainty: **multipart upload transport is now at least minimally proven in the target runtime.**

#### Route-guard/browser baseline: better than before
The repo now has some repo-owned dashboard route-guard tests:

- `tests/dashboard-route-guards.test.ts`

And the latest smoke notes show the prior `list.graphql.names` runtime error is gone:

- `dashboard-browser-smoke.md:10-15`

This is still not full dashboard parity, but it is meaningfully better than “manual smoke only.”

---

### What is still clearly non-parity

#### Config/list/group DSL
Official Keystone still performs significant defaulting/validation in `config()` and `listsWithDefaults()`:

- reserved `fields.id` rejection (`/Users/junaid/code/keystone/packages/core/src/schema.ts:20-25`)
- singleton/id-field constraints (`:27-29`, `47-55`)
- provider validation and default db/url/graphql/server/ui behavior (`:86-161`)
- group sentinel semantics and nested-group rejection (`:189-208`)

The target still does not:

- `config()` is still a passthrough (`src/features/cms/config.ts:81-83`)
- `list()` is still a passthrough (`src/features/cms/config.ts:85-87`)
- `group()` still stamps metadata rather than creating official `__groupN` semantics (`src/features/cms/config.ts:89-107`)
- `normaliseList()` silently injects `id` instead of treating user `fields.id` as reserved (`src/features/cms/config.ts:187-223`)

#### Admin metadata
Official Keystone’s admin meta model includes:

- root `views` registry
- `listsByKey`
- root access gating by `ui.isAccessAllowed`
- actions
- `list(key, itemId)`
- richer field-mode JSON and conditional semantics

Evidence:

- admin-meta source model: `/Users/junaid/code/keystone/packages/core/src/lib/admin-meta.ts:97-203`, `205-329`
- GraphQL exposure and root gate: `/Users/junaid/code/keystone/packages/core/src/lib/admin-meta-graphql.ts:339-388`

The target still exposes a thinner shape:

- `AdminMeta` only has `lists` and `list(key)` (`src/features/cms/runtime.ts:143-145`)
- no root `views` array in schema or returned object
- no actions in `ListMeta` (`src/features/cms/runtime.ts:148-170`; `src/features/cms/types.ts:280-289`)
- `getAdminMetaForContext()` only dynamically overrides hide flags and fieldMode strings (`src/features/cms/admin-meta.ts:143-153`)

#### Mutations / access / hooks
Official Keystone mutation semantics remain materially richer and stricter:

- filtered missing update/delete should throw access denied, not return `null` (`/Users/junaid/code/keystone/packages/core/src/lib/core/mutations/index.ts:48-73`, `142-184`, `186-235`)
- many mutations intentionally preserve per-index settled ordering (`:284-307`, `323-373`, `663-677`, `703-804`)
- relationship resolvers use structured nested mutation state and deferred `afterOperation` (`:111-133`, `420-617`)

The target still differs:

- createMany/updateMany/deleteMany still return arrays of async functions directly from GraphQL resolvers, without the Keystone ordered-settled shim (`src/features/cms/runtime.ts:921-929`, `940-949`, `959-967`)
- nested relationship creation still recursively calls `context.adapter.create(...)` immediately in both adapters (`src/features/cms/adapters/prisma.ts:201-211`, `214-245`; `src/features/cms/adapters/memory.ts:502-560`)
- the target has only a simplified hook model/types compared with Keystone’s per-phase resolver/validation/hook lifecycle (`src/features/cms/types.ts:84-155` vs official `mutations/index.ts:420-617`)

#### Field implementation parity
The starter still uses a generic field factory that accepts arbitrary options and stores them into metadata:

- `src/features/cms/fields/index.ts:15-32`, `70-115`

Official Keystone still uses per-field implementations with validation, GraphQL input/output, Prisma lowering, views, and admin-meta semantics:

- examples: text/select/relationship in `/Users/junaid/code/keystone/packages/core/src/fields/types/*`

This remains a foundational parity gap.

#### Document/storage/provider parity
- `document()` is still just the generic field factory export, not an official-style document field runtime (`src/features/cms/fields/index.ts:142-144`)
- runtime still treats document as raw `JSON` (`src/features/cms/runtime.ts:295-296`, `318-320`)
- storage config supports `s3` shape, but byte persistence/delete remain local-only (`src/features/cms/storage.ts:65-69`, `96-101`)

---

## 2) Stale findings from earlier audits that are now closed

These earlier concerns are now stale or materially improved.

### Closed A — `context.internal()` bypassed access
Earlier audits flagged this as a critical semantic/security mismatch.

**Current status: closed.**

Evidence now:

- sudo bypass check only uses `__internal.sudo` (`src/features/cms/access.ts:34-35`)
- `internal()` and `sudo()` are distinct (`src/features/cms/runtime.ts:708-709`)
- test now asserts anonymous `internal()` still gets access denied (`scripts/validate-cms-auth.ts:114-121`)

### Closed B — `graphql.raw()` skipped GraphQL validation path
Earlier audits noted use of `execute()` directly.

**Current status: closed.**

Evidence now:

- `graphqlApi.raw` uses `graphql({ schema, source, contextValue, variableValues })` (`src/features/cms/runtime.ts:720-726`)

### Closed C — `sessionData` lacked schema validation
Earlier audits noted missing startup/query validation for `sessionData`.

**Current status: closed enough for this slice.**

Evidence now:

- auth schema extension validates parsed/validated `sessionData` against the built schema (`src/features/cms/auth/graphql.ts:84-96`)

This is not architecturally identical to official Keystone’s implementation location, but the practical validation gap is now closed.

### Closed D — HTTP multipart GraphQL upload parity was unproven
Earlier reports correctly called this unproven.

**Current status: materially improved / closed as a testing gap.**

Evidence now:

- HTTP multipart upload test exists and is wired into package scripts (`package.json:25`, `scripts/validate-cms-graphql-upload-http.ts:31-71`)

### Closed E — no repo-owned dashboard tests at all
Earlier reports said there was no automated dashboard regression suite.

**Current status: partially closed.**

Evidence now:

- route-guard tests exist in `tests/dashboard-route-guards.test.ts`

This does **not** mean dashboard parity is solved; it means the “zero repo-owned tests” claim is stale.

---

## 3) Remaining gaps by severity

## High-severity gaps

### H1. `config()` / `list()` / `group()` remain far looser than official Keystone

**Why high:** this affects whether copied Keystone configs fail loudly or silently diverge.

**Target evidence**
- passthrough `config()`/`list()` (`src/features/cms/config.ts:81-87`)
- metadata-style `group()` rather than sentinel-group DSL (`src/features/cms/config.ts:89-107`)
- `normaliseList()` silently injects `id` and applies starter-specific defaults (`src/features/cms/config.ts:187-223`)

**Official evidence**
- config defaults/validation (`/Users/junaid/code/keystone/packages/core/src/schema.ts:18-74`, `86-161`)
- nested-group rejection and group sentinel behavior (`:189-208`)

**Practical effect**
- copied Keystone list configs can appear accepted while behaving differently at runtime.

### H2. AdminMeta is still structurally thinner than Keystone

**Why high:** the dashboard/CMS contract depends on this more than surface CRUD does.

**Missing/partial in target**
- no root `views` registry
- no actions
- no `list(key, itemId)` GraphQL shape
- no root `ui.isAccessAllowed` gate on `adminMeta`
- weaker field-mode/requiredness semantics

**Target evidence**
- schema only exposes `lists` + `list(key)` (`src/features/cms/runtime.ts:143-145`)
- `ListMeta` shape lacks actions/views (`src/features/cms/runtime.ts:148-170`)
- runtime admin-meta object only contains `lists` (`src/features/cms/admin-meta.ts:133-153`)

**Official evidence**
- admin meta root model includes `views`, `listsByKey`, `isAccessAllowed` (`/Users/junaid/code/keystone/packages/core/src/lib/admin-meta.ts:97-114`)
- actions and view indexing (`:194-203`, `272-296`)
- `list(key, itemId)` and root access gate (`/Users/junaid/code/keystone/packages/core/src/lib/admin-meta-graphql.ts:339-388`)

### H3. Mutation semantics still diverge from Keystone’s many-op and nested relationship behavior

**Why high:** this changes API behavior, error ordering, and hook side effects.

**Target evidence**
- many mutations still map directly to arrays of async operations (`src/features/cms/runtime.ts:921-929`, `940-949`, `959-967`)
- nested relationship creation recursively calls adapter create immediately (`src/features/cms/adapters/prisma.ts:201-211`, `214-245`; `src/features/cms/adapters/memory.ts:502-560`)

**Official evidence**
- many mutation per-item settled semantics (`/Users/junaid/code/keystone/packages/core/src/lib/core/mutations/index.ts:284-307`, `323-373`, `663-677`, `703-804`)
- deferred nested `afterOperation` via `NestedMutationState` (`:111-133`, `574-617`)

### H4. Field implementations are still generic configs, not official field implementations

**Why high:** true parity depends on per-field validators, Prisma lowering, views, and admin metadata.

**Target evidence**
- one generic factory allows arbitrary options and stores them into metadata (`src/features/cms/fields/index.ts:15-32`, `70-115`)

**Official evidence**
- per-field implementations across core fields packages

### H5. Document field remains a stub compared with official Keystone

**Why high:** it is not just a small mismatch; it is a different runtime model.

**Target evidence**
- `document()` is generic field export (`src/features/cms/fields/index.ts:142-144`)
- GraphQL input/output is raw JSON (`src/features/cms/runtime.ts:295-296`, `318-320`)

**Official evidence**
- official document field package provides a richer field/runtime/admin-meta contract, not plain JSON (`/Users/junaid/code/keystone/packages/fields-document/src/index.ts` referenced indirectly by earlier audit; current target still clearly lacks this architecture)

## Medium-severity gaps

### M1. Hide/create/delete and list defaults still differ from official admin-meta semantics

**Target**
- `hideCreate`/`hideDelete` default false unless explicit or dynamic override (`src/features/cms/admin-meta.ts:117-119`)
- `pageSize` not clamped against list `graphql.maxTake` in adminMeta (`src/features/cms/admin-meta.ts:114`)
- starter initial columns default to first 4 non-id fields (`src/features/cms/config.ts:202`)

**Official**
- hide defaults reflect enabled GraphQL operations (`/Users/junaid/code/keystone/packages/core/src/lib/admin-meta.ts:180-186`)
- page size clamps to `take` default/max (`:149-152`, `172`)
- initial columns start from label field and cap to 3 (`:127-142`)

### M2. File/image GraphQL inputs are still broader than Keystone

**Target**
- `FileFieldInput` and `ImageFieldInput` still accept metadata fields beyond `upload` (`src/features/cms/runtime.ts:44-64`)
- mutation normalization only special-cases `upload`; other metadata is still accepted (`src/features/cms/runtime.ts:350-358`)

**Official**
- file/image inputs are upload-centric field inputs, not client-supplied metadata bags

### M3. S3/provider parity is still missing

**Target**
- storage config supports `kind: 's3'` in type space (`src/features/cms/storage-config.ts:3-17`)
- actual persistence/delete reject non-local storage (`src/features/cms/storage.ts:65-69`, `96-101`)

### M4. Auth/UI parity is still only partial

**Target**
- auth now wraps session strategy, but does not implement official generated admin files / publicPages / pageMiddleware composition in the same way (`src/features/cms/keystone/auth.ts:52-84`)

**Official**
- `withAuth()` composes generated files, public pages, page middleware, and `ui.isAccessAllowed` interactions (`/Users/junaid/code/keystone/packages/auth/src/index.ts:58-92`, `169-243`, `211-285`)

### M5. Password reset remains custom product surface, not official current-source parity

**Target**
- custom reset link + redeem flow in auth GraphQL (`src/features/cms/auth/graphql.ts:154-200`)

**Official current source**
- inspected `@keystone-6/auth` source emphasizes password auth + init-first-item; password reset is not the core current-source parity target in the inspected package files.

This is medium because it is **extra surface area to maintain**, not necessarily a parity bug.

## Low-severity gaps

### L1. Prisma lifecycle still allows stale generate/check bypass on some commands

**Target**
- `migrate`, `db:generate`, `db:push` do not force `cms:generate`/`cms:check` first (`package.json:11-15`, `34-38`)

### L2. Dashboard browser still has known Base UI console issues

**Evidence**
- smoke notes still report Base UI non-button/nativeButton warnings (`dashboard-browser-smoke.md:12-15`)

### L3. Some route/dashboard parity is still under-tested
There are now tests, but not a full CRUD/dashboard/browser acceptance suite.

---

## 4) Easiest copy/adapt opportunities from official Keystone semantics

These are the highest-value places where official Keystone provides relatively direct implementation guidance.

### Opportunity 1 — Port `config()` defaulting/validation from `packages/core/src/schema.ts`
Best source:
- `/Users/junaid/code/keystone/packages/core/src/schema.ts:18-74`, `86-161`, `189-208`

Why easy/high-value:
- centralized logic
- many parity gains at once
- mostly deterministic normalization/validation work

### Opportunity 2 — Port admin-meta source model concepts from `createAdminMeta()`
Best source:
- `/Users/junaid/code/keystone/packages/core/src/lib/admin-meta.ts:97-203`, `205-329`, `338-349`
- `/Users/junaid/code/keystone/packages/core/src/lib/admin-meta-graphql.ts:339-388`

Why easy/high-value:
- target already has an `admin-meta.ts`; this is a direct conceptual replacement target
- can add `views`, `actions`, `listsByKey`, `list(key,itemId)`, hide defaults, pageSize clamp, and access gate in one slice

### Opportunity 3 — Port ordered many-mutation behavior
Best source:
- `/Users/junaid/code/keystone/packages/core/src/lib/core/mutations/index.ts:663-677`, `703-804`

Why easy/high-value:
- self-contained helper + resolver pattern
- improves API behavior without requiring a full architecture rewrite first

### Opportunity 4 — Port nested mutation state / deferred after-operation model
Best source:
- `/Users/junaid/code/keystone/packages/core/src/lib/core/mutations/index.ts:111-133`, `574-617`

Why useful:
- directly addresses a major semantic mismatch in nested create/update behavior

### Opportunity 5 — Port auth UI/public-page/page-middleware composition ideas
Best source:
- `/Users/junaid/code/keystone/packages/auth/src/index.ts:58-92`, `169-243`, `211-285`

Why useful:
- target auth already wraps sessions; adding the rest would make `withAuth()` semantics far closer

### Opportunity 6 — Port identity/sessionData validation semantics
Best source:
- `/Users/junaid/code/keystone/packages/auth/src/schema.ts:25-69`

Target already implemented part of this, so this is more of a cleanup/alignment pass than a net-new system.

---

## 5) Exact target files likely to change

### Highest-likelihood files

- `src/features/cms/config.ts`
  - `config()`, `list()`, `group()`, defaulting/validation, singleton/id semantics
- `src/features/cms/admin-meta.ts`
  - richer admin meta source model, views registry, actions, hide defaults, pageSize clamping
- `src/features/cms/runtime.ts`
  - GraphQL `AdminMeta` schema shape, `list(key,itemId)`, root access gate, many mutation ordering, upload input narrowing
- `src/features/cms/types.ts`
  - admin-meta types, field-mode types, action metadata types, list UI config expansion
- `src/features/cms/fields/index.ts`
  - split generic field handling or add per-field validators/normalizers
- `src/features/cms/keystone/auth.ts`
  - auth UI/public page/page middleware parity, final cleanup of official semantics
- `src/features/cms/auth/graphql.ts`
  - keep current auth mutations aligned, decide product-vs-parity status of reset flows
- `src/features/cms/adapters/prisma.ts`
  - nested mutation semantics, hook/order parity, relationship validation behavior
- `src/features/cms/adapters/memory.ts`
  - same as Prisma adapter; behavior should stay aligned across adapters
- `src/features/cms/storage.ts`
  - S3/provider implementation, stricter file/image input expectations, transformName parity
- `src/features/cms/storage-config.ts`
  - provider config expansion if S3 parity is pursued
- `src/features/cms/storage-url.ts`
  - provider URL/signed URL behavior if S3 parity is pursued

### Likely validation/test files to extend

- `scripts/validate-cms-auth.ts`
- `scripts/validate-cms-crud.ts`
- `scripts/validate-cms-prisma.ts`
- `scripts/validate-cms-graphql-upload.ts`
- `scripts/validate-cms-graphql-upload-http.ts`
- `tests/dashboard-route-guards.test.ts`
- likely new dashboard CRUD/browser tests under `tests/`

---

## 6) Top 10 implementation actions required to reach real parity

Ordered by leverage, not by ease alone.

### 1. Rebuild `config()` normalization around official Keystone semantics
Implement official-style defaulting and validation in `src/features/cms/config.ts`:

- validate `db.provider`
- default db/url/graphql/server/ui settings
- reject reserved `fields.id`
- enforce singleton id-field constraints
- align default id injection behavior
- align `group()` semantics or fail loudly on unsupported cases

### 2. Replace current AdminMeta model with a Keystone-like source model
In `src/features/cms/admin-meta.ts` and `src/features/cms/runtime.ts`:

- add root `views`
- add `listsByKey`
- add actions
- add `list(key, itemId)`
- add root `ui.isAccessAllowed` gate
- clamp page size to `maxTake`
- default hideCreate/hideDelete from enabled GraphQL operations

### 3. Port official many-mutation ordered-settled semantics
In `src/features/cms/runtime.ts`:

- stop exposing raw arrays of async item operations without the Keystone ordering shim
- adopt an equivalent to `promisesButSettledWhenAllSettledAndInOrder()`

### 4. Introduce nested mutation state so child `afterOperation` runs after parent success
In both adapters, likely with shared helper extraction:

- stop recursive immediate child writes as the semantic model
- queue nested child after-hooks and flush after parent commit/write

### 5. Strengthen relationship mutation validation to match Keystone more closely
In `src/features/cms/adapters/prisma.ts` and `memory.ts`:

- enforce exact one-of rules for to-one inputs
- enforce `set`/`disconnect` incompatibility for to-many update
- aggregate nested relationship errors in a more Keystone-like way

### 6. Evolve field implementations from generic metadata storage to per-field normalizers/validators
Start with the highest-impact fields:

- `text`
- `select`
- `multiselect`
- `relationship`
- `file`
- `image`
- `document`

Goal: reject unsupported/invalid configs instead of silently storing them.

### 7. Bring `withAuth()` closer to official UI/auth composition
In `src/features/cms/keystone/auth.ts`:

- compose public auth pages semantics
- compose init-first-item redirect/public access behavior
- move closer to official `withAuth()` behavior, not just session wrapping

### 8. Decide and implement strict file/image input parity
In `src/features/cms/runtime.ts` and storage modules:

- narrow public GraphQL inputs toward official upload-centric semantics
- stop accepting metadata bags unless explicitly part of non-parity product behavior

### 9. Implement real S3/provider storage or fail loudly on non-local parity claims
In storage modules:

- add provider abstraction for put/delete/url
- or explicitly reject/mark S3 as unsupported in parity docs and validation

### 10. Replace document JSON stub with an official-style document field runtime, or explicitly mark it unsupported
This is required for any honest “runtime/CMS parity” claim if `document()` remains part of the supported DSL.

---

## Suggested severity-ranked backlog

### High priority first
1. `config.ts` parity pass
2. `admin-meta.ts` + `runtime.ts` adminMeta parity pass
3. many-mutation ordering + nested mutation semantics
4. field implementation validation split
5. document field decision

### Medium next
6. auth UI/public-page/page-middleware parity
7. stricter file/image input semantics
8. S3/provider implementation or explicit non-support

### Low polish
9. Prisma lifecycle preflight hardening in package scripts
10. dashboard/browser parity and console-cleanliness polish

---

## Bottom-line verdict

**Current honest status:**

- **Surface/runtime compatibility:** moderate and improving
- **Auth/context parity:** partial-good
- **CRUD/query parity:** decent for many happy paths
- **AdminMeta/dashboard parity:** still substantially incomplete
- **Mutation/hook/access parity:** still materially divergent in important edge semantics
- **Storage/provider parity:** good for local image slice, incomplete overall
- **Document parity:** not close enough

### Recommended claim level today
Reasonable claim:
> “Keystone-inspired TanStack CMS runtime with meaningful auth/CRUD/admin compatibility and growing validation coverage.”

Not yet honest claim:
> “Official Keystone runtime/CMS parity.”

That claim still overstates the current state, mainly because of **config DSL**, **adminMeta**, **mutation lifecycle**, **field implementation semantics**, and **document/provider support**.
