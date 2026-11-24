# Master Parity Dissertation and Execution Roadmap

Date: 2026-05-18

Scope:
- Target runtime/dashboard: `/Users/junaid/code/tanstack-keystone-starter`
- Dashboard reference: `/Users/junaid/code/next-keystone-starter`
- Official Keystone reference: `/Users/junaid/code/keystone`

Source audits synthesized here:
- `reports/parity-dissertation/01-dashboard-shell-auth-ai.md`
- `reports/parity-dissertation/02-dashboard-list-filters-sort.md`
- `reports/parity-dissertation/03-dashboard-create-item-controllers.md`
- `reports/parity-dissertation/04-dashboard-table-pagination-sidebar.md`
- `reports/parity-dissertation/05-dashboard-relationships-singletons-navigation.md`
- `reports/parity-dissertation/06-runtime-config-dsl-adminmeta.md`
- `reports/parity-dissertation/07-runtime-graphql-context-auth.md`
- `reports/parity-dissertation/08-runtime-mutations-access-hooks-errors.md`
- `reports/parity-dissertation/09-runtime-prisma-storage-upload.md`
- `reports/parity-dissertation/10-validation-acceptance-matrix.md`

Combined audit corpus size at time of synthesis: ~4,049 lines.

---

## Executive summary

We are not at full parity with either:
1. `next-keystone-starter` dashboard behavior, or
2. official Keystone backend/runtime semantics.

We are, however, much further along than the oldest reports implied.

### Current honest state

#### Dashboard vs `next-keystone-starter`
- **Close on route breadth and core CRUD UX**
- **Not yet full parity**
- Reasonable current estimate:
  - **~80–85%** for core dashboard UX excluding AI
  - **~70–75%** including AI sidebar/backend parity

#### Runtime vs official Keystone
- **Strong for the current starter’s practical use-case**
- **Still partial as a generalized official-Keystone-compatible runtime**
- Reasonable current estimate:
  - **~75–80%** for this repo’s practical runtime use-case
  - **~55–65%** for generalized official parity

### Why previous “done” claims drifted
The codebase improved rapidly in many previously-audited areas, but “full parity” was repeatedly overstated because:
- some reports became stale after many fixes landed,
- parity was measured against moving scopes,
- browser/dashboard acceptance coverage never caught up,
- official Keystone semantic edge cases still differ,
- AI sidebar parity remained visibly incomplete.

### The practical truth
The target is already a serious clean-room Keystone-like system. It is not a toy. It is not a facade. But it still has real and important gaps in:
- AI dashboard behavior,
- list-control contracts,
- create/item controller architecture,
- relationship edge behavior,
- official auth/context semantics,
- mutation/hook/access/error semantics,
- S3/multipart/document parity,
- and acceptance automation.

---

## Part I — What parity actually means

We must stop using one overloaded word.

### 1. Dashboard parity
This means the TanStack dashboard behaves like `next-keystone-starter` in:
- route structure,
- auth UX,
- list filters/search/sort/field selection,
- create/item editing semantics,
- relationship UX,
- singleton behavior,
- sidebar/profile UX,
- AI sidebar behavior,
- empty/error/no-access/not-found flows.

### 2. Official runtime parity
This means the clean-room CMS behaves like official Keystone core/auth in:
- config/list/field DSL behavior,
- adminMeta behavior,
- public/internal schema behavior,
- context API,
- auth/session semantics,
- CRUD/many mutation behavior,
- access/hook lifecycle,
- nested relationship semantics,
- error envelopes,
- Prisma/artifact behavior,
- storage/upload/file/image/document behavior.

### 3. Acceptance parity
This means we can claim parity with evidence, not belief. It requires:
- passing scripted backend validation,
- real HTTP transport tests,
- dashboard/browser tests,
- and locked-down regression coverage for the remaining semantic edge cases.

We do **not** have acceptance parity yet.

---

## Part II — What is already solid

### Dashboard areas already close or effectively good
- dashboard route breadth exists
- auth screens exist and are usable
- no-access page is close
- shell/right-sidebar/floating-button infrastructure exists
- pagination and bulk delete dialog exist
- singleton canonical `/1` flows mostly exist
- relationship label hydration and option pagination exist
- adminMeta-driven list metadata is strong
- request-aware `hideCreate` / `hideDelete` / `hideNavigation` work is landed
- view-scoped `isRequired` is now present upstream and preserved in enhancement
- many prior filter/operator gaps have already been fixed

### Runtime areas already close or strong
- public/internal schema split exists
- `context.db`, `context.query`, `context.graphql.run/schema`, `withRequest`, `withSession`, transactions exist
- `extendGraphqlSchema` exists
- `sessionData` is materially used
- many mutations exist
- auth/init/reset surfaces exist
- local upload/storage/image persistence exists
- Prisma adapter and generated artifact checks exist
- memory and Prisma validation suites are substantial

These foundations are real and should not be thrown away.

---

## Part III — The actual open gaps

This section names the real remaining differences in priority order.

## A. Dashboard parity gaps

### A1. AI sidebar is still a local stub, not real parity
**Severity:** Critical for dashboard parity claim

Current target state:
- `src/components/dashboard/dashboard-providers.tsx` exposes only placeholder AI config
- `sendMessage()` appends a canned assistant response
- target has no `/api/completion` route
- target does not have Next’s AI/MCP/OpenRouter dependency stack installed

Reference baseline:
- `next-keystone-starter/app/api/completion/route.ts`
- real AI transport
- richer AI config
- query invalidation and live chat behavior

Conclusion:
This is the most visible remaining dashboard gap.

### A2. List/filter/sort/field-selection contracts still differ materially
**Severity:** Critical

Remaining audited gaps include:
- search semantics differ from Next
- filter empty-state logic differs
- filter-pill edit semantics differ
- checkbox filter operators differ (`is/not` vs `equals/not`)
- integer/float filters miss `empty/not_empty`
- multiselect semantics differ
- document filters absent in TanStack
- `empty/not_empty` URL payloads differ
- id filter input semantics differ
- select filter UI is simpler
- `initialSort` / fallback sort UI semantics differ
- field-selection default URL semantics differ

Primary files:
- `src/components/dashboard/filter-bar.tsx`
- `src/features/cms/graphql-client.ts`
- `src/components/dashboard/views/registry.tsx`

Conclusion:
List-control parity is still one of the largest remaining user-facing gap clusters.

### A3. Create/item pages are not on the same controller architecture as the reference
**Severity:** Critical

The audit conclusion is blunt:
- the target still uses a parallel generic form system,
- not the same full controller/view substrate used by the reference,
- so field semantics are flattened and drift remains.

Remaining problems include:
- generic field editor pipeline instead of true field controllers
- missing invalid-fields semantics
- static read/edit/hidden behavior instead of conditional evaluation
- partial requiredness propagation
- hardcoded GraphQL field selection instead of controller-driven selection
- per-kind field rendering still flattened

Primary files:
- `src/routes/dashboard/$listKey.create.tsx`
- `src/routes/dashboard/$listKey.$id.tsx`
- `src/components/dashboard/enhance-fields.tsx`
- `src/components/dashboard/field-value-editor.tsx`
- `src/components/dashboard/field-controllers.tsx`
- `src/components/dashboard/views/registry.tsx`
- `src/features/cms/graphql-client.ts`

Conclusion:
If we want true dashboard parity, create/item must be rebuilt on the enhanced-field controller stack.

### A4. Singleton/relationship correctness gaps still exist
**Severity:** High

Audited concrete gaps:
- missing item / missing singleton render path is broken by undefined `MissingSingletonItem`
- relationship option search ignores `refSearchFields`
- relationship label resolution ignores `refLabelField`
- editing many-relationship filters can corrupt selected IDs into one comma-string
- relationship editor lacks some richer inline-create/navigation flows from Next

Primary files:
- `src/routes/dashboard/$listKey.$id.tsx`
- `src/components/dashboard/relationship-field-editor.tsx`
- `src/components/dashboard/views/relationship-filter-input.tsx`
- `src/features/cms/graphql-client.ts`

Conclusion:
There is still a correctness problem here, not just polish.

### A5. Table/sidebar/profile parity is close but not exact
**Severity:** Medium

Remaining differences:
- field-view list cells are not yet fully parity-complete
- sidebar account menu lacks some affordances
- sidebar models section is not collapsible like Next baseline
- home cards still have some UX/detail drift
- success/toast-level feedback is thinner

Primary files:
- `src/components/dashboard/keystone-list-table.tsx`
- `src/components/dashboard/user-profile.tsx`
- `src/components/dashboard/dashboard-sidebar.tsx`
- `src/routes/dashboard/index.tsx`

Conclusion:
This is real work, but below AI/list/controller correctness in priority.

---

## B. Official Keystone runtime parity gaps

### B1. `config()` / `list()` / field factory behavior is still only partial
**Severity:** Critical for official parity claim

Current target:
- good Keystone-like authoring ergonomics
- many options accepted
- many unsupported options silently preserved in `fieldMeta`

Official difference:
- official Keystone validates/rejects much more,
- field factories own far more semantics,
- model-file portability is not yet complete.

Primary files:
- `src/features/cms/config.ts`
- `src/features/cms/fields/index.ts`
- `src/features/cms/admin-meta.ts`
- `src/features/cms/keystone/auth.ts`

Conclusion:
The public DSL looks closer than its executed semantics.

### B2. `internal()` and `sudo()` semantics are not official parity
**Severity:** Critical correctness/security blocker

Audit finding:
- `internal()` currently behaves too much like sudo/bypass behavior
- only `sudo()` should bypass access
- `internal()` should switch schema/context internals, not authorization semantics

Primary files:
- `src/features/cms/runtime.ts`
- `src/features/cms/access.ts`

Conclusion:
This is one of the most concrete official runtime blockers.

### B3. Auth/session semantics still differ from official Keystone
**Severity:** High

Remaining gaps:
- `sessionData` not startup-validated like official behavior
- `sessionData` projected from adapter data, not official query resolution semantics
- session typing is still too hardcoded to current `User` shape
- `authenticatedItem` and `createInitialUser` use raw adapter-ish paths instead of parity routes through `context.db/query`
- `CreateInitialUserInput` is manually reconstructed instead of being derived from real create input semantics
- session format differs from official auth payload conventions
- no official `storedSessions()` equivalent
- request/response semantics are Fetch-based, not official Node-style

Primary files:
- `src/features/cms/runtime.ts`
- `src/features/cms/auth/graphql.ts`
- `src/features/cms/keystone/auth.ts`
- `src/features/cms/config.ts`

Conclusion:
Auth is real and usable, but still not official-conformance complete.

### B4. Mutation/access/hooks/error semantics still diverge
**Severity:** High

Audited differences:
- update/delete missing target should error, not return `null`
- many mutations should align with official ordered per-item settled behavior
- access ordering differs
- hooks can run too broadly / at wrong phases
- no nested deferred after-operation queue
- relationship input validation is too permissive
- error envelopes are only partially parity-shaped
- memory scalar create field access still has gaps

Primary files:
- `src/features/cms/runtime.ts`
- `src/features/cms/access.ts`
- `src/features/cms/hooks.ts`
- `src/features/cms/adapters/memory.ts`
- `src/features/cms/adapters/prisma.ts`
- `src/features/cms/errors.ts`

Conclusion:
This is one of the largest official parity clusters still open.

### B5. Prisma/storage/upload/document parity is still partial
**Severity:** High

Good current state:
- local upload/storage exists
- local image persistence works
- cleanup helpers exist
- Prisma generation/check workflow exists

Remaining gaps:
- S3 provider missing
- explicit multipart HTTP parity not proven
- file field scaffolded but not strongly proven with fixture/test coverage
- document field still stubby relative to official semantics
- some provider-specific schema/type fidelity remains simplified

Primary files:
- `src/features/cms/storage.ts`
- `src/features/cms/storage-config.ts`
- `src/features/cms/storage-url.ts`
- `src/features/cms/prisma-schema.ts`
- `src/routes/api/graphql.ts`
- `src/routes/api/cms/upload.ts`

Conclusion:
Local slice is decent; provider and transport parity are not done.

---

## Part IV — The ordered program to get to parity

This is the dependency-aware roadmap. The order matters.

## Phase 0 — Stop lying to ourselves

### Rule changes
We do not use “parity” as a blanket claim anymore.

We use only:
- **dashboard parity status**
- **official runtime parity status**
- **acceptance parity status**

And we do not call any of them “complete” until their gates pass.

### Deliverables
- this master dissertation
- the 10 supporting audit files
- future progress measured against milestone gates below

---

## Phase 1 — Fix the correctness blockers first

These are not optional because they invalidate downstream parity claims.

### Task 1.1 — Fix `internal()` vs `sudo()` semantics
**Files**
- `src/features/cms/runtime.ts`
- `src/features/cms/access.ts`
- `scripts/validate-cms-auth.ts`

**Acceptance**
- `internal()` switches to internal schema/context semantics only
- only `sudo()` bypasses access
- backend auth/context tests cover this explicitly

### Task 1.2 — Fix missing singleton/missing item render path
**Files**
- `src/routes/dashboard/$listKey.$id.tsx`

**Acceptance**
- missing singleton create UI is actually reachable
- normal missing item behavior no longer references undefined component

### Task 1.3 — Fix relationship metadata correctness
**Files**
- `src/components/dashboard/relationship-field-editor.tsx`
- `src/components/dashboard/views/relationship-filter-input.tsx`
- `src/features/cms/graphql-client.ts`

**Acceptance**
- `refSearchFields` honored
- `refLabelField` honored
- many-relationship filter editing preserves ID arrays correctly

### Task 1.4 — Fix top-level mutation semantics
**Files**
- `src/features/cms/runtime.ts`
- `src/features/cms/adapters/memory.ts`
- `src/features/cms/adapters/prisma.ts`
- `src/features/cms/errors.ts`

**Acceptance**
- update/delete on missing/filtered targets error with official-style envelope direction
- many ops behave deterministically in input order

---

## Phase 2 — Make the dashboard honest parity-ready

### Task 2.1 — Normalize dashboard composition
**Files**
- `src/components/dashboard/dashboard-shell.tsx`
- `src/components/dashboard/dashboard-providers.tsx`
- optional new layout composition wrapper

**Work**
- align provider composition more closely with Next’s `DashboardLayout`
- stabilize shell boundary before AI port
- decide whether to add admin-meta provider/theme/toast parity layer

### Task 2.2 — Build real AI parity instead of placeholder AI
**Files**
- `src/components/dashboard/dashboard-providers.tsx`
- `src/components/dashboard/ai-chat-sidebar.tsx`
- new target `/api/completion` route
- any supporting AI config/helper modules

**Prereqs**
- install missing AI deps or TanStack-native alternatives
- port/adapt Next completion behavior
- wire real async chat transport

**Acceptance**
- target has real `/api/completion`
- AI sidebar submits live messages
- loading/error states behave like real chat, not placeholder
- query invalidation or relevant refresh hooks after AI-driven operations

### Task 2.3 — Fix list-control contract parity
**Files**
- `src/components/dashboard/filter-bar.tsx`
- `src/components/dashboard/views/registry.tsx`
- `src/features/cms/graphql-client.ts`

**Priority order**
1. checkbox `is/not`
2. integer/float `empty/not_empty`
3. multiselect `matches/not_matches`
4. document filters
5. filter-pill edit semantics
6. empty-state behavior decision
7. sort visibility/initialSort semantics
8. field-selection URL semantics

**Acceptance**
- operator/URL matrix matches planned parity target
- list controls are deterministic and documented

---

## Phase 3 — Rebuild create/item on the right architecture

This is the largest dashboard workstream.

### Task 3.1 — Move create/item to enhanced-field/controller stack
**Files**
- `src/routes/dashboard/$listKey.create.tsx`
- `src/routes/dashboard/$listKey.$id.tsx`
- `src/components/dashboard/enhance-fields.tsx`
- new shared field renderer/hook files

### Task 3.2 — Expand controller contract to real form controllers
**Files**
- `src/components/dashboard/views/registry.tsx`
- `src/components/dashboard/views/*`
- `src/components/dashboard/enhance-fields.tsx`

### Task 3.3 — Make GraphQL selection controller-driven
**Files**
- `src/features/cms/graphql-client.ts`

### Task 3.4 — Port invalid-fields / conditional fieldMode / conditional requiredness
**Files**
- new invalid-fields and has-changes helpers
- create/item routes
- shared field renderer

### Task 3.5 — Port per-kind field behavior in priority order
1. text / select / checkbox
2. password
3. integer / float / decimal / bigInt / timestamp
4. relationship
5. image / file
6. document / json / virtual

**Acceptance**
- create/item are no longer powered by the generic fallback form engine
- form behavior becomes controller/view driven like the reference

---

## Phase 4 — Finish the official auth/context/runtime semantics

### Task 4.1 — Move `sessionData` into official-style auth machinery
**Files**
- `src/features/cms/keystone/auth.ts`
- `src/features/cms/runtime.ts`
- `src/features/cms/config.ts`

### Task 4.2 — Validate auth config like official Keystone
**Files**
- `src/features/cms/keystone/auth.ts`

### Task 4.3 — Route `authenticatedItem` and `createInitialUser` through `context.db/query`
**Files**
- `src/features/cms/auth/graphql.ts`

### Task 4.4 — Derive initial-user input from real create input semantics
**Files**
- `src/features/cms/auth/graphql.ts`

### Task 4.5 — Make `graphql.raw()` use validated execution semantics
**Files**
- `src/features/cms/runtime.ts`

### Task 4.6 — Decide password-reset scope explicitly
Decision:
- either keep it as product compatibility scope,
- or remove it from “official parity” claims.

**Acceptance**
- auth behavior is no longer “close enough”; it is deliberately aligned or deliberately scoped.

---

## Phase 5 — Finish the official mutation/access/hook/error semantics

### Task 5.1 — Port official-style many-mutation behavior
### Task 5.2 — Enforce correct access ordering
### Task 5.3 — Rework hook lifecycle into official phases
### Task 5.4 — Add nested after-operation queue semantics
### Task 5.5 — Tighten relationship input validation
### Task 5.6 — Expand official-style error helper families

**Files**
- `src/features/cms/runtime.ts`
- `src/features/cms/access.ts`
- `src/features/cms/hooks.ts`
- `src/features/cms/adapters/memory.ts`
- `src/features/cms/adapters/prisma.ts`
- `src/features/cms/errors.ts`

**Acceptance**
- update/delete missing-target semantics fixed
- ordered all-settled behavior aligned enough
- access/hook ordering deterministic and parity-tested
- relationship validation stops being permissive

---

## Phase 6 — Finish storage/upload/Prisma/document parity

### Task 6.1 — Harden Prisma lifecycle preflights
### Task 6.2 — Narrow file/image GraphQL inputs to official-ish Upload semantics
### Task 6.3 — Add real multipart HTTP transport parity tests
### Task 6.4 — Introduce storage provider abstraction
### Task 6.5 — Implement S3 provider
### Task 6.6 — Prove file field parity with real fixture/test coverage
### Task 6.7 — Replace document stub with real document runtime behavior
### Task 6.8 — Improve image `transformName` and streaming behavior

**Files**
- `src/features/cms/storage.ts`
- `src/features/cms/storage-config.ts`
- `src/features/cms/storage-url.ts`
- `src/features/cms/prisma-schema.ts`
- `src/routes/api/graphql.ts`
- `src/routes/api/cms/upload.ts`
- document runtime files

**Acceptance**
- local + S3 story is real
- multipart GraphQL upload path is real over HTTP
- file/image/document no longer sit in partial/scaffolded status

---

## Phase 7 — Prove it with acceptance automation

This is mandatory before any “parity” claim.

### Gate A — Static + artifact integrity
Run:
```bash
npm run check
npm run cms:check
npm run lint
npm run build
```

### Gate B — Memory runtime parity
Run:
```bash
npm run test:cms
npm run test:cms:auth
npm run test:cms:storage
npm run test:cms:upload
npm run test:cms:dynamic
```

### Gate C — Prisma runtime parity
Run:
```bash
DATABASE_URL=... npm run db:generate
DATABASE_URL=... npm run db:push
DATABASE_URL=... npm run db:seed
DATABASE_URL=... CMS_ADAPTER=prisma npm run test:cms:prisma
DATABASE_URL=... CMS_ADAPTER=prisma npm run test:cms:prisma:auth
```

### Gate D — Add missing HTTP transport tests
Needed:
- GraphQL multipart upload over real HTTP
- cookie write/read over real HTTP
- auth mutation + subsequent authenticated request
- error envelope assertions over HTTP transport

### Gate E — Add missing dashboard/browser tests
Needed coverage:
- redirect matrix
- signin/signup/reset/init
- list search/sort/filter/field selection
- create submit
- item save/delete/reset
- no console errors on primary routes

### Gate F — Add official semantic edge-case regressions
Needed assertions:
- update/delete missing target errors
- nested relationship invalid combination behavior
- ordered many-mutation multi-error behavior
- memory scalar-create field access denial
- official-style error code envelopes

**Final rule:** no full parity claim before Gates A–F pass.

---

## Part V — Milestones and deliverables

## Milestone M0 — Audit complete
**Status:** done

Deliverables:
- 10 supporting audit reports
- this master synthesis

## Milestone M1 — Correctness blockers closed
Includes:
- `internal()` vs `sudo()` fixed
- singleton missing-item bug fixed
- relationship metadata/filter-edit bugs fixed
- mutation missing-target semantics fixed

## Milestone M2 — AI/dashboard surface made real
Includes:
- real `/api/completion`
- real AI sidebar behavior
- dashboard shell/provider composition normalized

## Milestone M3 — List-control parity closed
Includes:
- filter operator matrix aligned
- sort/field-selection semantics aligned
- filter pill/edit semantics aligned

## Milestone M4 — Create/item controller parity closed
Includes:
- create/item on enhanced controller stack
- invalid-field/conditional fieldMode semantics aligned
- controller-driven GraphQL selections aligned

## Milestone M5 — Official auth/context parity hardened
Includes:
- `sessionData` validated and aligned
- `authenticatedItem`/`createInitialUser` parity paths aligned
- `graphql.raw()` semantics aligned enough

## Milestone M6 — Official mutation/access/hook/error parity hardened
Includes:
- many-mutation semantics aligned
- hook/access ordering aligned
- error envelopes expanded

## Milestone M7 — Storage/upload/document/provider parity hardened
Includes:
- multipart HTTP proof
- S3 implementation
- document/file proof

## Milestone M8 — Acceptance parity
Includes:
- browser tests
- HTTP transport tests
- edge-case semantic tests
- gates all green

Only after M8 can we say “full parity” with a straight face.

---

## Part VI — What not to do

1. **Do not keep calling generic form tweaks parity work**
   - create/item must move to the right controller substrate.

2. **Do not keep saying the AI sidebar is done because the shell exists**
   - it is not done until `/api/completion` and real transport exist.

3. **Do not blur runtime parity and acceptance parity**
   - even if behavior looks close, we still need transport/browser coverage.

4. **Do not silently accept unsupported config options forever**
   - either implement or reject them deterministically.

5. **Do not claim official parity while `internal()` behaves like sudo**
   - that is a correctness blocker.

6. **Do not claim dashboard parity while list controls and create/item semantics still drift**
   - those are user-visible.

---

## Part VII — The first concrete execution batch

If we start immediately, the best first batch is:

### Batch 1 — correctness blockers
1. fix `internal()` vs `sudo()`
2. fix missing singleton render path bug
3. fix relationship `refSearchFields` / `refLabelField`
4. fix many-relationship filter edit state corruption
5. fix update/delete missing-target error semantics

### Batch 2 — dashboard realism
6. normalize shell/provider composition
7. port AI config foundation
8. add real target `/api/completion`
9. replace AI placeholder behavior with real transport

### Batch 3 — list-control contract closure
10. filter operator matrix alignment
11. URL payload normalization
12. sort/field-selection semantics
13. filtered-empty-state decision and lock-in

### Batch 4 — form architecture rebuild
14. move create/item to enhanced-field stack
15. expand field controllers to real form controllers
16. make GraphQL selections controller-driven
17. port invalid-fields / conditional fieldMode / requiredness

This is the first serious program. It is also the point where parity work becomes visibly real instead of endless local fixes.

---

## Final verdict

### Can we claim full parity today?
No.

### Are we close in many important areas?
Yes.

### Is the codebase already substantially more real than the oldest reports implied?
Absolutely.

### What are the biggest remaining blockers?
1. AI sidebar/backend parity
2. list-control contract parity
3. create/item controller architecture parity
4. singleton/relationship correctness gaps
5. `internal()` vs `sudo()` semantics
6. official auth/session/context differences
7. mutation/access/hook/error semantics
8. S3/multipart/document/provider parity
9. missing browser/HTTP acceptance automation

### What is the honest one-sentence conclusion?
The target is already a serious clean-room Keystone-like system with a mostly-real dashboard, but it is still **not yet entitled to a full parity claim** until the remaining behavioral gaps and acceptance gates above are closed.
