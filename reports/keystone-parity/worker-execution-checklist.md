# Worker Execution Checklist: Keystone complete-parity push

Date: 2026-05-25
Repo: `tanstack-keystone-starter`
Primary source of truth: `reports/keystone-parity/complete-parity-dissertation.md`
Supporting audits:
- `reports/keystone-parity/dashboard-audit.md`
- `reports/keystone-parity/runtime-audit.md`

This document converts the dissertation into a strict execution order for a single implementation worker.

## Non-negotiable rules

1. **Do not claim complete parity early.** The allowed honest labels are:
   - before final gate: **advanced partial parity**
   - after final gate passes: **complete parity**
2. **Use the dissertation as canonical.** Older local reports that say many mutations, auth routes, or context APIs are missing are stale unless re-verified.
3. **One writer at a time.** If multiple agents are used, only one agent edits source files in the main worktree.
4. **After every phase:** run the listed verification commands before moving on.
5. **No scope drift.** This checklist is about parity with official Keystone semantics and the current starter dashboard contract, not new product features.
6. **If a task reveals a structural mismatch, stop and write it down** in the checklist PR/notes before continuing.

## Baseline validation before changing anything

Run and record these before the first code change:
- `npm run lint`
- `npm run test:cms`
- `npm run test:cms:auth`
- `npm run test:cms:upload`
- `npm run test:dashboard:http`
- `npm run build`

If any baseline command already fails, fix that first and do not continue down the checklist until green.

---

## Phase 1 — Proof gaps first

These are the fastest high-signal tasks and they reduce false parity claims.

### Task 01 — Lock down `extendGraphqlSchema` behavior
**Dissertation refs:** items 16, 36

**Goal**
Prove that `extendGraphqlSchema` works in the runtime exactly where the repo claims it does.

**Files likely touched**
- `src/features/cms/config.ts`
- `src/features/cms/runtime.ts`
- `cms.config.ts`
- `scripts/validate-cms-crud.ts`
- new focused validation script under `scripts/`

**Done when**
- A focused test or validation script proves extension fields are present.
- The extension executes successfully in the running schema.
- Behavior is verified against both the intended public path and any internal path the runtime exposes.

**Verification**
- `npm run test:cms`
- any new focused script added for schema extension

**Dependencies**
- None

---

### Task 02 — Prove public vs internal schema and `sudo()/internal()` behavior
**Dissertation refs:** items 14, 17, 20, 22, 36

**Goal**
Prove that public schema restrictions differ intentionally from internal access and that `sudo()` / `internal()` behave as expected.

**Files likely touched**
- `src/features/cms/runtime.ts`
- `src/features/cms/access.ts`
- `src/features/cms/adapters/types.ts`
- new validation script under `scripts/`

**Done when**
- A test shows a public restriction that is absent or bypassed in the internal/sudo path where intended.
- A test shows that unrestricted internal access does not accidentally leak through the public API.
- `adminMeta` access gating is covered in at least one restricted-user scenario.

**Verification**
- `npm run test:cms`
- new internal/public schema validation script

**Dependencies**
- Task 01 not required, but do Task 01 first anyway.

---

### Task 03 — Prove many-mutation ordering and partial-failure semantics
**Dissertation refs:** items 18, 21, 36

**Goal**
Close the biggest “looks done but not proven” runtime gap around bulk mutations.

**Files likely touched**
- `src/features/cms/runtime.ts`
- `src/features/cms/adapters/memory.ts`
- `src/features/cms/adapters/prisma.ts`
- `scripts/validate-cms-crud.ts`
- possibly a new dedicated bulk-mutation validation script

**Done when**
- Tests cover mixed-success createMany/updateMany/deleteMany flows.
- Result ordering is asserted.
- Error-array or failure-surface behavior is asserted and documented.
- Hook timing for many mutations is at least sampled in one validation path.

**Verification**
- `npm run test:cms`
- any new bulk-mutation script

**Dependencies**
- Task 02 preferred first

---

### Task 04 — Prove auth GraphQL and session behavior end to end
**Dissertation refs:** items 28, 29, 30, 36

**Goal**
Move auth/session from “appears implemented” to “proven”.

**Files likely touched**
- `src/features/cms/auth/graphql.ts`
- `src/features/cms/auth/session.ts`
- `src/features/cms/runtime.ts`
- `scripts/validate-cms-auth.ts`
- `scripts/validate-dashboard-http.ts`

**Done when**
- Tests cover `authenticatedItem`, `authenticateUserWithPassword`, `endSession`, password reset, and `createInitialUser`.
- Session issuance and invalidation are asserted for the configured strategy.
- Dashboard auth gate behavior is covered for anonymous and authenticated sessions.

**Verification**
- `npm run test:cms:auth`
- `npm run test:dashboard:http`

**Dependencies**
- Task 02 preferred first

---

## Checkpoint A — Runtime proof checkpoint
Do not continue until all are true:
- [ ] `npm run lint`
- [ ] `npm run test:cms`
- [ ] `npm run test:cms:auth`
- [ ] `npm run build`
- [ ] New proof scripts for Tasks 01-04 are green

---

## Phase 2 — Dashboard contract parity

Now close the visible UI gaps that still diverge even though routes already exist.

### Task 05 — Lock down route and redirect behavior
**Dissertation refs:** items 1, 2, 3, 30

**Goal**
Verify real route behavior, not just route existence.

**Files likely touched**
- `src/routes/dashboard.tsx`
- `src/routes/dashboard/signin.tsx`
- `src/routes/dashboard/signup.tsx`
- `src/routes/dashboard/reset.tsx`
- `src/routes/dashboard/init.tsx`
- `src/routes/dashboard/no-access.tsx`
- `src/features/cms/dashboard-route-guards.ts`
- `scripts/validate-dashboard-http.ts`

**Done when**
- Anonymous redirect behavior is deterministic.
- `from` redirect after sign-in works.
- init-only and no-access flows behave correctly.
- The HTTP/browser test surface covers these routes.

**Verification**
- `npm run test:dashboard:http`
- browser/manual smoke if available

**Dependencies**
- Checkpoint A complete

---

### Task 06 — Align list search/filter/sort/display behavior
**Dissertation refs:** items 6, 10

**Goal**
Close the biggest list-page interaction differences.

**Files likely touched**
- `src/routes/dashboard/$listKey.tsx`
- `src/components/dashboard/filter-bar.tsx`
- `src/components/dashboard/keystone-list-table.tsx`
- `src/features/cms/graphql-client.ts`

**Done when**
- URL params round-trip cleanly for search, sort, field selection, and filters.
- GraphQL variables emitted by the client match the selected UI state.
- Reset-filter behavior is deterministic.
- Empty-state distinctions are preserved for empty list vs filtered-no-results.
- LocalStorage list-state restore/persist and snapped page-size semantics are covered.

**Verification**
- `npm run test:dashboard:http`
- focused client/unit tests if added

**Dependencies**
- Task 05

---

### Task 07 — Align list-table cells, selection, and bulk actions
**Dissertation refs:** items 7, 9

**Goal**
Make list rendering and row actions behave like a polished admin table instead of a partial clone.

**Files likely touched**
- `src/components/dashboard/keystone-list-table.tsx`
- `src/components/dashboard/list-preview-table.tsx`
- `src/components/dashboard/views/*`

**Done when**
- Relationship cells show the right labels/links.
- Multiselect/select values render as intended.
- Selection state survives expected list interactions.
- Bulk delete UX and feedback match the intended contract, including partial-success detail retention.

**Verification**
- `npm run test:dashboard:http`
- snapshot or component tests if added

**Dependencies**
- Task 06

---

### Task 08 — Finish create/item form behavior and cache invalidation
**Dissertation refs:** items 8, 9, 27

**Goal**
Ensure create/edit/reset/delete flows are behaviorally solid across starter models.

**Files likely touched**
- `src/routes/dashboard/$listKey.create.tsx`
- `src/routes/dashboard/$listKey.$id.tsx`
- `src/components/dashboard/field-value-editor.tsx`
- `src/components/dashboard/field-form-layout.tsx`
- `src/components/dashboard/relationship-field-editor.tsx`
- `src/features/cms/graphql-client.ts`

**Done when**
- Create redirects to the expected item page.
- Edit/save/reset/delete/copy-ID flows work.
- Cache invalidation/refetch behavior is deterministic.
- Error messages are consistent between GraphQL failures and client-side validation failures.
- Raw GraphQL mutation summaries/details are preserved through the route UX.

**Verification**
- `npm run test:dashboard:http`
- browser/manual smoke for User and Todo flows

**Dependencies**
- Tasks 06-07

---

## Checkpoint B — Dashboard checkpoint
Do not continue until all are true:
- [ ] `npm run lint`
- [ ] `npm run test:dashboard:http`
- [ ] `npm run build`
- [ ] Manual/browser smoke for sign-in, list page, create page, item page, delete flow

---

## Phase 3 — Field and controller semantics

This is where “UI exists” becomes “Keystone behavior is really there.”

### Task 09 — Inventory controller contract by field kind
**Dissertation refs:** items 10, 23, 24, 26, 27

**Goal**
Create a precise matrix of which starter field kinds already satisfy controller expectations and which do not.

**Files likely touched**
- `src/components/dashboard/views/registry.tsx`
- `src/components/dashboard/field-controllers.tsx`
- `src/features/cms/runtime.ts`
- `src/features/cms/fields/index.ts`
- test files or markdown matrix if needed

**Done when**
- There is an explicit checked list for text, checkbox, select, multiselect, relationship, password, image/file/document-related starter usage.
- For each kind, create/list/item serialization expectations are known.

**Verification**
- Keep this in code/tests or a small parity matrix doc, not just in chat.

**Dependencies**
- Checkpoint B complete

---

### Task 10 — Fix text/select/multiselect parity gaps
**Dissertation refs:** items 24, 27

**Goal**
Align the common field kinds first because they affect most tables and forms.

**Files likely touched**
- `src/features/cms/fields/index.ts`
- `src/components/dashboard/views/text.tsx`
- `src/components/dashboard/views/select.tsx`
- `src/components/dashboard/field-value-editor.tsx`
- adapters if serialization/coercion is wrong

**Done when**
- Validation behavior is correct.
- Display labels are correct.
- Search/filter/controller semantics for these fields behave consistently in list/create/item contexts.

**Verification**
- `npm run test:cms`
- UI tests or snapshots for field rendering

**Dependencies**
- Task 09

---

### Task 11 — Fix relationship controller and mutation parity gaps
**Dissertation refs:** items 19, 26, 27

**Goal**
Close the biggest field-level parity risk after common scalars.

**Files likely touched**
- `src/components/dashboard/relationship-field-editor.tsx`
- `src/components/dashboard/views/relationship.tsx`
- `src/components/dashboard/views/relationship-filter-input.tsx`
- `src/features/cms/adapters/memory.ts`
- `src/features/cms/adapters/prisma.ts`
- `src/features/cms/runtime.ts`

**Done when**
- Relationship pickers behave correctly.
- create/update/connect/disconnect/set behavior is tested in memory and Prisma modes.
- Linked display behavior is correct in list and item contexts.

**Verification**
- `npm run test:cms`
- `npm run test:cms:prisma`
- browser/manual smoke for related Role/Todo flows

**Dependencies**
- Task 10

---

### Task 12 — Finish password field/runtime coupling cleanup
**Dissertation refs:** items 25, 28, 29

**Goal**
Remove any remaining mismatch between password field behavior and auth/runtime behavior.

**Files likely touched**
- `src/features/cms/auth/password.ts`
- `src/features/cms/auth/graphql.ts`
- `src/features/cms/runtime.ts`
- `src/features/cms/fields/index.ts`
- `scripts/validate-cms-auth.ts`

**Done when**
- Passwords are always hashed where required.
- Password state is never leaked.
- Update/reset/sign-in behavior is all covered in tests.

**Verification**
- `npm run test:cms:auth`
- `npm run test:cms`

**Dependencies**
- Task 10

---

## Checkpoint C — Field semantics checkpoint
Do not continue until all are true:
- [ ] `npm run lint`
- [ ] `npm run test:cms`
- [ ] `npm run test:cms:auth`
- [ ] `npm run test:cms:prisma`
- [ ] `npm run build`

---

## Phase 4 — Storage and upload parity

### Task 13 — Prove upload transport and local persistence
**Dissertation refs:** items 31, 32

**Goal**
Ensure upload parity is real beyond happy-path claims.

**Files likely touched**
- `src/routes/api/cms/upload`
- `src/features/cms/storage.ts`
- `src/features/cms/storage-config.ts`
- `src/features/cms/storage-url.ts`
- `scripts/validate-cms-graphql-upload.ts`
- `scripts/validate-cms-graphql-upload-http.ts`
- `scripts/validate-cms-storage.ts`

**Done when**
- Uploads work through the intended transport path.
- Persisted files have expected metadata and URLs.
- HTTP-level upload validation is green.

**Verification**
- `npm run test:cms:upload`
- `npm run test:cms:storage`

**Dependencies**
- Checkpoint C complete

---

### Task 14 — Finish replace/delete cleanup semantics for image/file fields
**Dissertation refs:** items 32, 34

**Goal**
Close lifecycle parity, not just creation parity.

**Files likely touched**
- `src/features/cms/storage.ts`
- `src/features/cms/file-lifecycle.ts`
- `src/features/cms/runtime.ts`
- adapters and validation scripts as needed

**Done when**
- Replacing an upload cleans up or preserves the right files according to intended semantics.
- Deleting an item cleans up associated assets where intended.
- GraphQL output remains correct after replacement or delete.

**Verification**
- `npm run test:cms:upload`
- `npm run test:cms:storage`

**Dependencies**
- Task 13

---

### Task 15 — Decide and implement/document non-local storage scope
**Dissertation refs:** item 33

**Goal**
Remove ambiguity around unsupported storage strategies.

**Files likely touched**
- `src/features/cms/storage.ts`
- `src/features/cms/storage-config.ts`
- `README.md` or `docs/` if scope is intentionally limited

**Done when**
- Either non-local storage support exists with tests, or the repo clearly documents it as out of parity scope.
- No silent partial support remains.

**Verification**
- relevant storage tests or documented invariant tests

**Dependencies**
- Task 14

---

## Checkpoint D — Storage checkpoint
Do not continue until all are true:
- [ ] `npm run test:cms:upload`
- [ ] `npm run test:cms:storage`
- [ ] `npm run build`

---

## Phase 5 — Runtime architecture and artifacts

### Task 16 — Tighten config defaulting and id-field policy
**Dissertation refs:** items 11, 12, 13

**Goal**
Match more of Keystone’s configuration behavior exactly.

**Files likely touched**
- `src/features/cms/config.ts`
- `src/features/cms/keystone/core.ts`
- config validation tests/scripts

**Done when**
- Reserved `fields.id`, singleton/id-field, and defaulting behavior are covered.
- Minimal and full config fixtures normalize predictably.

**Verification**
- `npm run test:cms`
- config-focused tests/scripts

**Dependencies**
- Checkpoint D complete

---

### Task 17 — Move more behavior ownership into field-level runtime definitions
**Dissertation refs:** item 23

**Goal**
Reduce the biggest architectural gap: centralized kind-switch behavior instead of field-owned fragments.

**Files likely touched**
- `src/features/cms/fields/index.ts`
- `src/features/cms/runtime.ts`
- field helpers under `src/features/cms/keystone/*`

**Done when**
- At minimum, text, password, relationship, and image/file-related behavior is more field-owned than runtime-switched.
- Adding a new field kind does not require widening unrelated runtime branches more than necessary.

**Verification**
- `npm run test:cms`
- `npm run test:cms:auth`
- `npm run test:cms:upload`

**Dependencies**
- Task 16

---

### Task 18 — Tighten hook-order and relationship-semantics proof
**Dissertation refs:** items 19, 21

**Goal**
Turn hook/relationship parity from “implemented” into “proven”.

**Files likely touched**
- `src/features/cms/hooks.ts`
- `src/features/cms/runtime.ts`
- `src/features/cms/adapters/memory.ts`
- `src/features/cms/adapters/prisma.ts`
- validation scripts

**Done when**
- Hook ordering is asserted for create/update/delete and at least one bulk path.
- Nested relationship writes are covered in both adapters where applicable.

**Verification**
- `npm run test:cms`
- `npm run test:cms:prisma`

**Dependencies**
- Task 17

---

### Task 19 — Harden Prisma/schema/artifact drift checks
**Dissertation refs:** items 35, 36

**Goal**
Make parity claims durable by proving generated artifacts stay in sync.

**Files likely touched**
- `src/features/cms/prisma-schema.ts`
- `prisma/schema.prisma`
- `scripts/compare-cms-prisma-schema.ts`
- `scripts/check-cms-prisma-delegates.ts`
- possibly new schema snapshot artifacts

**Done when**
- Schema generation is deterministic.
- Drift checks are automatic.
- GraphQL SDL and Prisma schema snapshots are current if the repo uses them.

**Verification**
- `npm run cms:check`
- `npm run test:cms:prisma`

**Dependencies**
- Task 18

---

## Checkpoint E — Architecture checkpoint
Do not continue until all are true:
- [ ] `npm run lint`
- [ ] `npm run cms:check`
- [ ] `npm run test:cms`
- [ ] `npm run test:cms:auth`
- [ ] `npm run test:cms:prisma`
- [ ] `npm run test:cms:upload`
- [ ] `npm run build`

---

## Phase 6 — Completion audit and truthfulness gate

### Task 20 — Supersede stale parity docs
**Goal**
Stop future agents from following outdated reports.

**Files likely touched**
- `official-keystone-parity-gap-report.md`
- `dashboard-feature-gap-report.md`
- `dashboard-visual-comparison.md`
- `feature-completeness-verdict.md`
- `progress.md`
- `reports/keystone-parity/complete-parity-dissertation.md`
- `reports/keystone-parity/worker-execution-checklist.md`

**Done when**
- Stale reports are either updated, archived, or clearly marked as superseded.
- One canonical parity report is obvious to the next agent.

**Verification**
- Manual review of report headers and references

**Dependencies**
- Checkpoint E complete

---

### Task 21 — Run the final parity suite
**Goal**
Prove the repo is actually ready for a “complete parity” claim.

**Required command set**
- `npm run lint`
- `npm run cms:check`
- `npm run test:cms`
- `npm run test:cms:auth`
- `npm run test:cms:upload`
- `npm run test:cms:prisma`
- `npm run test:dashboard:http`
- `npm run build`

**Done when**
- All commands pass.
- Manual/browser smoke covers sign-in, list page, create page, item page, relationship edits, delete flow, and upload flow.
- No unresolved parity blockers remain in the dissertation/checklist.

**Dependencies**
- Task 20

---

### Task 22 — Completion audit before any “complete parity” claim
**Goal**
Force an evidence-based yes/no decision instead of optimism.

**Completion gate**
The worker may claim **complete parity** only if all are true:
- [ ] Dashboard auth, list, create, item, delete, relationship, and upload flows work end to end.
- [ ] Public/internal schema behavior is tested and intentional.
- [ ] Many-mutation ordering and failure semantics are covered.
- [ ] Password/session/reset/init flows are covered.
- [ ] Storage replacement/delete lifecycle is covered.
- [ ] Prisma/schema drift checks are green.
- [ ] Stale reports are superseded.
- [ ] No remaining checklist item is open.

If any box is unchecked, the worker must report:
- current state: **advanced partial parity**
- exact unchecked blockers
- next highest-value unfinished task

---

## Suggested execution summary

If the worker wants the shortest honest route:
1. Finish proof tasks first.
2. Then fix visible dashboard contract gaps.
3. Then finish field semantics.
4. Then finish storage lifecycle behavior.
5. Then tighten architecture/artifact proof.
6. Then run the completion audit.

## Canonical handoff line for the next worker

> Use `reports/keystone-parity/complete-parity-dissertation.md` as the evidence source and `reports/keystone-parity/worker-execution-checklist.md` as the implementation order. Do not claim complete parity until Task 22 passes in full.