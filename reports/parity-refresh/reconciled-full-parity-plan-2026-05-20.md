# Implementation Plan

## Goal
Close the highest-value remaining runtime and dashboard parity gaps with official Keystone and `next-keystone-starter`, prioritizing real implementation work and proof gates over more report churn.

## Tasks

### A. Direct copy/adapt candidates

1. **A1. Port official `config()` / `list()` / `group()` normalization and validation first**
   - Files:
     - `src/features/cms/config.ts`
     - `src/features/cms/types.ts`
     - `src/features/cms/fields/index.ts`
     - `package.json`
   - Changes:
     - Replace the current passthrough `config()` / `list()` behavior with Keystone-like defaulting and validation from official `packages/core/src/schema.ts`.
     - Reject reserved `fields.id` instead of silently injecting around it.
     - Enforce singleton/id-field constraints, db/provider defaults, graphql/server/ui defaults, and fail-loud behavior for unsupported group shapes.
     - Decide whether `group()` will fully emulate Keystone sentinel semantics or explicitly reject unsupported nested/grouped cases instead of preserving metadata loosely.
     - Tighten field-factory option validation where current generic factories silently preserve unsupported options.
   - Depends on: none.
   - Parallelize: can run in parallel with A5 only; it should finish before A2, B2, and B4.
   - Parent first: **Yes — this should be the parent agent’s first implementation slice.**
   - Acceptance:
     - Existing list configs still load.
     - Unsupported Keystone-shaped configs fail deterministically.
     - `scripts/validate-cms-crud.ts` and `scripts/validate-cms-auth.ts` still pass after normalization changes.

2. **A2. Expand AdminMeta to the official source-model shape before more dashboard polish**
   - Files:
     - `src/features/cms/admin-meta.ts`
     - `src/features/cms/runtime.ts`
     - `src/features/cms/types.ts`
     - `src/features/cms/admin-meta-query.ts`
     - `src/features/cms/graphql-client.ts`
   - Changes:
     - Port the official `createAdminMeta()` concepts: root `views`, `listsByKey`, action metadata, hide defaults derived from enabled GraphQL operations, page-size clamping, and root access gating.
     - Extend the GraphQL schema from `adminMeta { lists, list(key) }` toward Keystone’s richer model, including `list(key, itemId)` behavior where item-specific view metadata is required.
     - Keep dashboard queries and client types aligned with the richer meta payload.
   - Depends on: A1.
   - Parallelize: backend GraphQL/schema work can be parallelized with A5 UI shell work after contracts are agreed, but the dashboard field/controller rewrite in B2 should wait for this shape.
   - Parent first: **Yes — second implementation slice.**
   - Acceptance:
     - `keystone.adminMeta` returns richer list metadata without breaking existing dashboard queries.
     - `adminMeta` defaults for `hideCreate`, `hideDelete`, page size, and views align with official expectations.

3. **A3. Port official ordered many-mutation semantics into the runtime resolver layer**
   - Files:
     - `src/features/cms/runtime.ts`
     - `src/features/cms/errors.ts`
     - `scripts/validate-cms-crud.ts`
     - `scripts/validate-cms-prisma.ts`
   - Changes:
     - Replace raw `createMany` / `updateMany` / `deleteMany` resolver arrays with Keystone-like ordered settled behavior.
     - Preserve input ordering, surface per-item failures deterministically, and align GraphQL error behavior more closely with official core mutations.
   - Depends on: A1.
   - Parallelize: can run in parallel with A2 once A1 lands.
   - Parent first: good early backend slice after A2 begins, especially if another agent takes B-side work later.
   - Acceptance:
     - Missing/invalid entries in many-mutations report in deterministic input order.
     - Memory and Prisma CRUD validations still pass.

4. **A4. Tighten `withAuth()` validation and auth config wiring using official Keystone auth patterns**
   - Files:
     - `src/features/cms/keystone/auth.ts`
     - `src/features/cms/auth/graphql.ts`
     - `src/features/cms/config.ts`
     - `scripts/validate-cms-auth.ts`
     - `scripts/validate-cms-prisma-auth.ts`
   - Changes:
     - Finish porting auth config validation and session-data semantics from official auth source.
     - Keep `createInitialUser` parity centered on real Keystone semantics instead of custom shortcuts.
     - Route auth-facing semantics through the same validated config/runtime pathways used by the rest of the system.
   - Depends on: A1.
   - Parallelize: can run alongside A2/A3, but any `sessionData` schema changes must stay coordinated with B4.
   - Parent first: medium-high priority, but after A1/A2 are underway.
   - Acceptance:
     - Auth config mis-shapes fail at startup.
     - Memory and Prisma auth validation scripts remain green.

5. **A5. Copy/adapt the Next dashboard shell polish that is mostly structural, not semantic**
   - Files:
     - `src/routes/__root.tsx`
     - `src/components/dashboard/dashboard-layout.tsx`
     - `src/components/dashboard/dashboard-providers.tsx`
     - `src/components/dashboard/dashboard-sidebar.tsx`
     - `src/components/dashboard/user-profile.tsx`
     - `package.json`
   - New files likely:
     - `src/components/ui/theme-provider.tsx`
     - `src/components/ui/toaster.tsx`
   - Changes:
     - Add dashboard-level theme and toast plumbing.
     - Make Models navigation truly collapsible.
     - Add the theme row / shell affordances already present in the Next reference.
     - Keep this slice narrowly focused on shell/provider parity, not full field-controller parity.
   - Depends on: none for shell plumbing; minor coordination with B3 for chat UI.
   - Parallelize: safe to do in parallel with A1/A2/A3.
   - Parent first: no; this is a good parallel stream while the parent tackles core runtime parity.
   - Acceptance:
     - Dashboard shell renders with theme/toast providers.
     - User menu and sidebar behavior align more closely with Next without breaking current routes.

6. **A6. Narrow file/image GraphQL input semantics to upload-centric parity**
   - Files:
     - `src/features/cms/runtime.ts`
     - `src/features/cms/storage.ts`
     - `src/features/cms/storage-config.ts`
     - `scripts/validate-cms-graphql-upload.ts`
     - `scripts/validate-cms-graphql-upload-http.ts`
   - Changes:
     - Stop accepting overly broad metadata bags in `FileFieldInput` / `ImageFieldInput` unless explicitly required for a product-only compatibility reason.
     - Align input normalization with official upload-centric expectations.
   - Depends on: A1.
   - Parallelize: can run alongside A3/A4.
   - Parent first: not first, but should happen before B5 storage-provider work.
   - Acceptance:
     - Local upload flows still pass.
     - Invalid client-supplied metadata is rejected consistently.

### B. Semantic rewrites that need careful implementation

7. **B1. Rework nested relationship mutation lifecycle and deferred hook semantics across both adapters**
   - Files:
     - `src/features/cms/adapters/memory.ts`
     - `src/features/cms/adapters/prisma.ts`
     - `src/features/cms/hooks.ts`
     - `src/features/cms/errors.ts`
     - `src/features/cms/runtime.ts`
   - New files likely:
     - `src/features/cms/mutation-state.ts`
   - Changes:
     - Replace immediate recursive nested writes with a shared nested-mutation state/deferred-afterOperation model.
     - Align relationship input validation, nested create/update ordering, and after-operation timing with official Keystone semantics.
     - Ensure memory and Prisma adapters share the same semantic contract instead of drifting independently.
   - Depends on: A3.
   - Parallelize: memory and Prisma adapter implementation can proceed in parallel after shared state/helper design is settled.
   - Parent first: **Yes — this is the first major semantic rewrite after A1/A2/A3.**
   - Acceptance:
     - Existing nested relationship tests still pass.
     - New regression cases for invalid `set`/`disconnect` combos, ordered failures, and deferred hooks pass in both adapters.

8. **B2. Replace the simplified dashboard field registry/editor stack with per-kind field modules and controller-driven selection**
   - Files:
     - `src/components/dashboard/views/registry.tsx`
     - `src/components/dashboard/enhance-fields.tsx`
     - `src/components/dashboard/enhanced-form-fields.tsx`
     - `src/components/dashboard/field-value-editor.tsx`
     - `src/components/dashboard/relationship-field-editor.tsx`
     - `src/routes/dashboard/$listKey.create.tsx`
     - `src/routes/dashboard/$listKey.$id.tsx`
     - `src/components/dashboard/keystone-list-table.tsx`
     - `src/features/cms/graphql-client.ts`
   - New files likely:
     - `src/components/dashboard/views/text.tsx`
     - `src/components/dashboard/views/select.tsx`
     - `src/components/dashboard/views/relationship.tsx`
     - `src/components/dashboard/views/password.tsx`
     - `src/components/dashboard/views/image.tsx`
     - `src/components/dashboard/views/document.tsx`
   - Changes:
     - Move create/item/list rendering away from one generic registry path.
     - Make GraphQL selection requirements controller-driven instead of relying on mostly `field.path` plus a few special cases.
     - Preserve conditional field modes, invalid-field handling, requiredness, and view-position semantics from AdminMeta.
   - Depends on: A2.
   - Parallelize: per-field module extraction can be parallelized by field kind after core registry/controller contracts are settled.
   - Parent first: high priority, but should start after A2 stabilizes the metadata contract.
   - Acceptance:
     - Create/item pages no longer rely primarily on the generic fallback editor.
     - List cells, item fields, and create inputs for core field kinds behave consistently with their controller/view modules.

9. **B3. Replace the simple completion helper with a real streaming/tool-capable dashboard assistant**
   - Files:
     - `src/routes/api/completion.ts`
     - `src/features/cms/dashboard-completion.ts`
     - `src/components/dashboard/chat-mode.tsx`
     - `src/components/dashboard/ai-chat-sidebar.tsx`
     - `src/components/dashboard/ai-config.tsx`
     - `src/components/dashboard/dashboard-providers.tsx`
     - `package.json`
   - Changes:
     - Move from one-shot JSON prompt/response to a streaming transport with tool-aware invalidation behavior.
     - Expand AI config beyond `server` mode if parity with Next’s local/shared modes is still in scope.
     - Render richer message content instead of plain text bubbles.
   - Depends on: A5 for shell/theme/toast groundwork.
   - Parallelize: frontend chat rendering can be parallelized with backend transport work once API shape is chosen.
   - Parent first: no; only start once core runtime parity work is underway, since this is visible polish but not the main runtime blocker.
   - Acceptance:
     - `/api/completion` supports real async streaming behavior.
     - Chat UI can render streamed assistant output and invalidate dashboard queries after CRUD-capable tool usage.
   - Risk note:
     - Current repo has no AI/streaming dependency stack installed; package selection is an explicit implementation decision, not a copy-paste.

10. **B4. Split generic field definitions into real per-field runtime semantics, especially `document()`**
    - Files:
      - `src/features/cms/fields/index.ts`
      - `src/features/cms/runtime.ts`
      - `src/features/cms/types.ts`
      - `src/features/cms/graphql-client.ts`
      - `src/components/dashboard/views/registry.tsx`
    - Changes:
      - Stop treating most field types as arbitrary config blobs.
      - Add field-specific validation/normalization for text/select/multiselect/relationship/file/image/document.
      - Decide whether `document()` gets a real implementation in this repo or becomes explicitly unsupported for parity claims.
    - Depends on: A1 and A2; benefits from B2 in the dashboard layer.
    - Parallelize: backend field semantics and dashboard field-module work can proceed in parallel once contracts are stable.
    - Parent first: high priority after B2 starts, because `document` remains one of the biggest honesty gaps.
    - Acceptance:
      - Invalid field configs fail loudly.
      - `document`, `image`, and `file` are no longer just JSON/generic fallbacks in parity-critical paths.

11. **B5. Finish auth/session and storage-provider semantics that are still product-real but parity-incomplete**
    - Files:
      - `src/features/cms/auth/graphql.ts`
      - `src/features/cms/keystone/auth.ts`
      - `src/features/cms/storage.ts`
      - `src/features/cms/storage-config.ts`
      - `src/features/cms/storage-url.ts`
      - `src/routes/api/graphql.ts`
      - `package.json`
    - Changes:
      - Route `authenticatedItem` / session hydration / initial-user behavior through parity-aligned runtime paths.
      - Introduce real provider abstraction for storage and either implement S3 or fail loudly when configured.
      - Keep HTTP GraphQL header/cookie semantics aligned while broadening storage support.
    - Depends on: A4 and A6.
    - Parallelize: auth/session cleanup and provider/storage work can be split, but both should converge before final parity signoff.
    - Parent first: medium priority after B1/B2.
    - Acceptance:
      - Auth/session flows behave identically across memory, Prisma, and HTTP paths.
      - Non-local storage is either implemented or explicitly rejected at runtime.

### C. Acceptance/browser/http gaps

12. **C1. Add real browser acceptance coverage for dashboard flows instead of relying on code inspection and route-guard unit tests**
    - Files:
      - `tests/dashboard-route-guards.test.ts`
      - `package.json`
    - New files likely:
      - `tests/dashboard-browser-auth.spec.ts`
      - `tests/dashboard-browser-list.spec.ts`
      - `tests/dashboard-browser-item.spec.ts`
      - `tests/dashboard-browser-singleton.spec.ts`
    - Changes:
      - Add browser-driven coverage for signin/signup/reset/init, list filtering/sorting/columns, create, item save/delete/reset, singleton create flow, and no-console-error checks.
      - Keep the existing route-guard unit test, but stop treating it as sufficient parity proof.
    - Depends on: A2, B2, and any route/shell changes those tasks introduce.
    - Parallelize: individual browser specs can be split by route area once a framework is chosen.
    - Parent first: no; do this after the relevant implementation slices stabilize.
    - Acceptance:
      - Primary dashboard routes have automated browser coverage.
      - Console-error and redirect regressions are caught automatically.
    - Risk note:
      - No browser automation framework is currently installed, so the parent agent must choose Playwright or an equivalent before implementation starts.

13. **C2. Expand HTTP-level parity tests for auth, init, cookies, upload, and error envelopes**
    - Files:
      - `scripts/validate-dashboard-http.ts`
      - `scripts/validate-dashboard-completion.ts`
      - `scripts/validate-cms-auth.ts`
      - `scripts/validate-cms-graphql-upload-http.ts`
      - `scripts/validate-cms-crud.ts`
      - `src/routes/api/graphql.ts`
    - Changes:
      - Add HTTP assertions for init-first-item success path, post-auth cookie reuse, update/delete missing-target envelopes, and multipart upload failures/successes.
      - Keep current request-handler script style where it gives useful proof without requiring a full browser.
    - Depends on: A3, A4, A6, B1, and B5.
    - Parallelize: auth/init HTTP cases and upload/error-envelope cases can be split.
    - Parent first: medium-late, after the corresponding runtime semantics are implemented.
    - Acceptance:
      - HTTP tests cover cookie write/read, init-first-item flow, upload transport, and GraphQL error-shape regressions.

14. **C3. Add parity regressions for the exact semantic edge cases still called out by the runtime reports**
    - Files:
      - `scripts/validate-cms-crud.ts`
      - `scripts/validate-cms-auth.ts`
      - `scripts/validate-cms-prisma.ts`
      - `scripts/validate-cms-prisma-auth.ts`
    - Changes:
      - Add explicit regressions for ordered many-mutation failures, nested relationship invalid combinations, deferred after-operation semantics, missing-target update/delete errors, and non-local storage handling.
      - Avoid reopening already-closed issues like `internal()` vs `sudo()`, missing `/api/completion`, or relationship label/search metadata handling unless a new regression appears.
    - Depends on: A3, B1, B4, B5.
    - Parallelize: memory and Prisma parity assertions can be written in parallel.
    - Parent first: after the corresponding implementation slices land.
    - Acceptance:
      - The regression suite proves the specific parity claims being made, not generic CRUD only.

### D. Validation gates

15. **D1. Establish the final signoff gate sequence and do not claim parity before all four layers pass**
    - Files:
      - `package.json`
      - `reports/parity-refresh/reconciled-full-parity-plan-2026-05-20.md`
    - Changes:
      - Keep the implementation order tied to a fixed gate order:
        1. static/artifact integrity,
        2. memory runtime parity,
        3. Prisma/runtime parity,
        4. HTTP/browser/dashboard parity.
      - Wire any missing scripts into `package.json` so the final gate is runnable, not aspirational.
    - Depends on: all implementation tasks.
    - Parallelize: script wiring can happen early, but final execution is sequential.
    - Parent first: define the gate list early, run it late.
    - Acceptance:
      - A single documented command matrix exists for parity signoff.

16. **D2. Run the minimum parity signoff matrix after implementation is complete**
    - Files:
      - `package.json`
      - `scripts/*.ts`
      - `tests/*.test.ts` and browser specs
    - Changes:
      - Final validation should include at least:
        - `npm run check`
        - `npm run cms:check`
        - `npm run lint`
        - `npm run build`
        - `npm run test:cms`
        - `npm run test:cms:auth`
        - `npm run test:cms:storage`
        - `npm run test:cms:upload`
        - `npm run test:cms:dynamic`
        - `npm run test:dashboard:http`
        - `npm run test:dashboard:ai`
        - Prisma auth/runtime validations with `CMS_ADAPTER=prisma`
        - new browser acceptance commands once added
    - Depends on: D1 and all implementation tasks.
    - Parallelize: memory vs Prisma vs browser runs can be parallelized in CI; local signoff should still be read as one gate set.
    - Parent first: final step only.
    - Acceptance:
      - No “full parity” claim is made until this matrix passes.

## Files to Modify
- `package.json` - add/adjust scripts and any new runtime or browser-test dependencies.
- `src/routes/__root.tsx` - root theme/toast shell plumbing.
- `src/routes/api/completion.ts` - streaming/tool-capable completion transport.
- `src/routes/api/graphql.ts` - preserve aligned HTTP header/cookie semantics during runtime changes.
- `src/routes/dashboard/$listKey.create.tsx` - controller-driven create parity.
- `src/routes/dashboard/$listKey.$id.tsx` - controller-driven item parity and richer feedback.
- `src/components/dashboard/dashboard-layout.tsx` - shell/provider composition.
- `src/components/dashboard/dashboard-providers.tsx` - query invalidation, AI config, shell providers.
- `src/components/dashboard/dashboard-sidebar.tsx` - collapsible models parity.
- `src/components/dashboard/user-profile.tsx` - theme action and menu parity.
- `src/components/dashboard/ai-config.tsx` - richer AI config modes/settings.
- `src/components/dashboard/chat-mode.tsx` - streaming/tool-aware chat state.
- `src/components/dashboard/ai-chat-sidebar.tsx` - richer assistant rendering.
- `src/components/dashboard/enhance-fields.tsx` - controller contract expansion.
- `src/components/dashboard/enhanced-form-fields.tsx` - create/item rendering contract.
- `src/components/dashboard/field-value-editor.tsx` - shrink generic fallback behavior.
- `src/components/dashboard/relationship-field-editor.tsx` - align with new controller/view model.
- `src/components/dashboard/keystone-list-table.tsx` - field-module cell rendering.
- `src/components/dashboard/views/registry.tsx` - replace generic registry with per-kind view/controller lookup.
- `src/components/dashboard/views/relationship-filter-input.tsx` - keep relationship filter UX aligned with controller changes.
- `src/features/cms/config.ts` - official-like config/list/group normalization and validation.
- `src/features/cms/types.ts` - richer AdminMeta and field/runtime typing.
- `src/features/cms/fields/index.ts` - field-specific validation and runtime semantics.
- `src/features/cms/admin-meta.ts` - official-like AdminMeta source model.
- `src/features/cms/admin-meta-query.ts` - updated GraphQL query shape for richer admin meta.
- `src/features/cms/graphql-client.ts` - controller-driven selection, filter/sort parity, richer admin-meta consumption.
- `src/features/cms/runtime.ts` - GraphQL schema shape, AdminMeta exposure, many-mutation semantics, upload inputs.
- `src/features/cms/errors.ts` - parity-shaped mutation and relationship error handling.
- `src/features/cms/hooks.ts` - deferred nested hook lifecycle.
- `src/features/cms/keystone/auth.ts` - tighter auth config/session parity.
- `src/features/cms/auth/graphql.ts` - auth mutation/session behavior alignment.
- `src/features/cms/dashboard-completion.ts` - real completion backend semantics.
- `src/features/cms/storage.ts` - upload/provider semantics and non-local handling.
- `src/features/cms/storage-config.ts` - provider config hardening.
- `src/features/cms/storage-url.ts` - provider URL behavior.
- `src/features/cms/adapters/memory.ts` - nested mutation semantics and shared relationship contract.
- `src/features/cms/adapters/prisma.ts` - same semantic contract as memory adapter.
- `scripts/validate-cms-auth.ts` - auth/session/init regressions.
- `scripts/validate-cms-crud.ts` - many-mutation, nested-relationship, and error-envelope regressions.
- `scripts/validate-cms-prisma.ts` - Prisma parity regressions.
- `scripts/validate-cms-prisma-auth.ts` - Prisma auth/session parity.
- `scripts/validate-cms-graphql-upload.ts` - in-process upload parity.
- `scripts/validate-cms-graphql-upload-http.ts` - HTTP upload parity.
- `scripts/validate-dashboard-http.ts` - dashboard HTTP and cookie parity.
- `scripts/validate-dashboard-completion.ts` - AI/dashboard backend parity.
- `tests/dashboard-route-guards.test.ts` - keep and extend unit-level route guard coverage.

## New Files
- `src/features/cms/mutation-state.ts` - shared helper for ordered settled many-mutations and deferred nested mutation state.
- `src/components/ui/theme-provider.tsx` - dashboard theme plumbing comparable to Next shell.
- `src/components/ui/toaster.tsx` - toast host for dashboard save/delete/create/AI feedback.
- `src/components/dashboard/views/text.tsx` - first extracted per-kind field view/controller module.
- `src/components/dashboard/views/select.tsx` - select/multiselect field module.
- `src/components/dashboard/views/relationship.tsx` - relationship field module.
- `src/components/dashboard/views/password.tsx` - password field module.
- `src/components/dashboard/views/image.tsx` - image/file field module.
- `src/components/dashboard/views/document.tsx` - document field module if document parity remains in scope.
- `tests/dashboard-browser-auth.spec.ts` - browser auth-route coverage if Playwright/equivalent is adopted.
- `tests/dashboard-browser-list.spec.ts` - browser list/filter/sort/column coverage.
- `tests/dashboard-browser-item.spec.ts` - browser item save/delete/reset coverage.
- `tests/dashboard-browser-singleton.spec.ts` - browser singleton create/missing-item coverage.

## Dependencies
- A1 is the base dependency for most runtime parity work.
- A2 depends on A1 because admin metadata should reflect normalized list/config semantics.
- A3 depends on A1 but can proceed in parallel with A2 after config contracts stabilize.
- A4 depends on A1 and should stay coordinated with B5.
- A5 is mostly independent and can proceed in parallel with A1/A2/A3.
- A6 depends on A1 and should finish before B5 storage-provider work.
- B1 depends on A3 because ordered mutation semantics should be in place before nested lifecycle work is finalized.
- B2 depends on A2 because richer AdminMeta is the contract the dashboard should consume.
- B3 depends on A5 shell/provider groundwork and an explicit AI dependency choice.
- B4 depends on A1/A2 and should coordinate with B2 so backend field semantics and dashboard modules do not drift.
- B5 depends on A4 and A6.
- C1 depends on A2, B2, and A5/B3 for the routes it exercises.
- C2 depends on A3, A4, A6, B1, and B5.
- C3 depends on A3, B1, B4, and B5.
- D1 can be documented early, but D2 only runs after all implementation and acceptance work is complete.

## Risks
- The highest risk is doing more local polish before fixing the foundational runtime contracts in `config.ts`, `admin-meta.ts`, and `runtime.ts`; that would increase churn without moving the true parity line.
- The reports already show several stale findings are closed (`internal()` vs `sudo()`, `/api/completion` existence, relationship label/search handling, missing singleton component bug, route-guard tests, HTTP upload proof). Re-auditing those areas should be avoided unless a fresh regression appears.
- `document()` is still an honesty problem: either implement a real document runtime or explicitly remove it from parity claims.
- AI parity is not a straight copy because the current repo lacks the reference dependency stack; package/API choice is a real implementation decision.
- Browser acceptance is currently underspecified because no browser framework is installed; choosing Playwright or equivalent is a prerequisite for C1.
- Storage/provider parity is still incomplete; claiming parity while `s3` remains typed-but-unimplemented would be misleading.
- Field-controller/dashboard work should not proceed against unstable AdminMeta contracts, or the team will pay for the migration twice.
- Parent-agent recommended first order:
  1. A1 `config.ts` normalization/validation.
  2. A2 AdminMeta/runtime shape.
  3. A3 many-mutation ordering.
  4. B1 nested mutation/hook lifecycle.
  5. B2 dashboard field/controller rewrite.
  6. Then parallelize A5/B3 shell+AI polish, B4 field semantics, and B5 storage/auth cleanup.
