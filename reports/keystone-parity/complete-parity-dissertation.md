# 30-piece dissertation on Keystone parity

Date: 2026-05-25
Repo: `tanstack-keystone-starter`
Scope: exhaustive parity handoff across dashboard UI, backend/runtime, field/controller behavior, auth/session, storage/upload, and validation/testing.

Sources synthesized:
- `reports/keystone-parity/dashboard-audit.md`
- `reports/keystone-parity/runtime-audit.md`
- `official-keystone-parity-gap-report.md`
- `dashboard-feature-gap-report.md`
- `dashboard-visual-comparison.md`
- `tanstack-dashboard-delta.md`
- `backend-keystone-parity-live-comparison.md`
- `feature-completeness-verdict.md`
- progress artifact and current repo source under `src/features/cms`, `src/routes/dashboard`, and `src/components/dashboard`

---

## Executive summary

> **Dashboard reconciliation update — 2026-05-28:** the dashboard-specific claims in this dissertation are now superseded by `reports/keystone-parity/dashboard-parity-audit-latest.md` and the 69-item cited ledger in `reports/keystone-parity/dashboard-exhaustive-difference-ledger.md`. The dashboard has working CSS/root shell and seeded HTTP signin, and the recent `ThemeProvider` crash is fixed, but the broader dashboard parity posture is worse than the scorecard below implies: document is still a textarea/JSON shim, the AI/right sidebar is now mounted but chat internals remain simplified, the dashboard shell now has a real class `ErrorBoundary`, signup/reset/signin action semantics still diverge from upstream server actions even though init create-then-sign-in ordering is now matched, and many field controllers remain simplified, though timestamp editing/state parity has been narrowed. Treat the dashboard scorecard entries below as stale historical estimates, not current truth.

This repo is **substantially farther along than the earliest parity reports implied**, but it is still **not at complete Keystone parity**.

The good news:
- The runtime is no longer a fake `adminMeta` façade. It now has a real clean-room CRUD engine with generated public/internal schemas, many mutations, context `db/query/graphql/prisma/transaction/internal/sudo/withRequest/withSession`, access layers, hooks, auth GraphQL, upload-aware field inputs, local storage plumbing, and a Prisma schema printer.
- The dashboard is no longer just an overview prototype. The route tree now includes `/dashboard/$listKey`, `/dashboard/$listKey/create`, `/dashboard/$listKey/$id`, `/dashboard/signin`, `/dashboard/signup`, `/dashboard/reset`, `/dashboard/init`, and `/dashboard/no-access` (`src/routeTree.gen.ts:9-25, 89-104`).
- Several prior local artifacts are now stale on important facts, especially around many mutations, context APIs, auth mutations, and dashboard route existence.

The bad news:
- The architecture still diverges from official Keystone at the most important seams: initialized field/list internals, field factory runtime fragments, mutation lifecycle semantics, storage strategy behavior, and config/system defaulting depth.
- Visible dashboard parity has improved materially, including list-state persistence, snapped page-size semantics, stronger bulk-delete partial-failure handling, reset confirmations, and richer mutation error summaries/details, but the interactive layer still depends on custom controller/runtime behavior rather than official field-controller machinery.
- Password, image/file/document behavior, access/read semantics, relationship mutation semantics, and artifact/codegen completeness remain the main blockers to claiming true parity.

**Bottom line:** this is a strong Keystone-inspired runtime and dashboard port, but **“complete parity” would still be an overclaim** until the remaining 30 concrete gaps below are closed and validated.

---

## Parity scorecard

| Area | Current parity | Notes |
|---|---:|---|
| Dashboard shell and route surface | stale historical estimate: 75% | Superseded by the 2026-05-28 dashboard ledger. Core routes exist and CSS/signin/root-shell are fixed, provider crashes were found/fixed, and the local shell now has a real dashboard `ErrorBoundary` plus mounted right sidebar/floating chat; remaining shell gaps are AI chat internals, navigation grouping/collapse behavior, and live interaction proof. |
| Dashboard list UX | stale historical estimate: 72% | Superseded by the 2026-05-28 dashboard ledger. Read path works, but URL semantics, persistence, placeholder copy, filters, columns, page-size behavior, and cells materially differ from the Next dashboard. |
| Dashboard create/item forms | stale historical estimate: 68% | Superseded by the 2026-05-28 dashboard ledger. Routes render after provider fixes, but field/controller parity is still incomplete, with document/text/timestamp/number/relationship/image/file gaps. |
| Public config/list/group DSL | 70% | Real wrappers and normalization exist, but official defaulting/validation depth is thinner. |
| Runtime CRUD schema generation | 80% | Strong visible parity, including many mutations and internal schema split. |
| Mutation semantics | 65% | Hooks/access/many mutations exist, but official settlement/error/lifecycle parity is not proven. |
| Access control | 75% | Real generic engine exists; edge semantics still differ from official. |
| Context API | 85% | Most of the key surface now exists; transport/private internals still differ. |
| Auth/session GraphQL | 80% | Sign-in, end session, authenticated item, init-first-item, reset flows exist; session sealing differs from official. |
| Storage/upload | 60% | Real local upload processing exists; non-local strategies and official field semantics are incomplete. |
| Field behavior parity | 55% | Metadata and several behaviors exist, but official field runtime architecture is not matched. |
| Prisma/codegen/artifacts | 65% | Local schema printer exists; official artifact pipeline parity does not. |
| Validation/test confidence for exact parity | 55% | Good local validation, insufficient proof of exact official semantics. |

**Overall parity estimate:** **~68% against the custom starter app behavior, ~58-62% against official Keystone runtime semantics.**

---

## Top 10 blockers

1. **Field runtime architecture still diverges from official initialized-list/field-factory design.**
2. **Image/file/document semantics are still custom and not official Keystone field parity.**
3. **Config/system defaulting and validation remain thinner than official `schema.ts` + `createSystem()`.**
4. **Many-mutation and hook ordering semantics are not proven identical to official Keystone.**
5. **Access/read edge cases still depend on local custom resolvers rather than official field wrappers.**
6. **Prisma/codegen/artifact generation is partial, not official artifact-pipeline parity.**
7. **Dashboard field controllers and rendering still lag behind full Keystone/NKS richness.**
8. **Relationship nested writes and ownership semantics are simpler than official.**
9. **Session implementation is compatible in shape but not official Iron/stored-session parity.**
10. **Validation still proves “works locally,” not “official Keystone-equivalent under edge cases.”**

---

## Fastest wins

1. Harden and snapshot `extendGraphqlSchema` behavior with explicit tests.
2. Add parity tests for many-mutation error ordering and hook timing.
3. Normalize multiselect and relationship cell rendering to original dashboard labels/links.
4. Add explicit config validation coverage for reserved `fields.id`, singleton/id-field conflicts, and omitted operations.
5. Close the remaining dashboard list-control mismatches with targeted UI tests.
6. Strengthen file/image tests beyond local storage happy-path.
7. Add proof that `internal()` and `sudo()` correctly bypass the intended restrictions.
8. Snapshot generated SDL/public-internal differences for the current starter models.
9. Refresh stale parity docs after the recent dashboard/runtime/auth slices so implementation evidence and report text match.

---

## Misleading areas that look done but are not

1. **Dashboard routes now exist**, but route existence alone is not full form/controller parity; the 2026-05-28 exhaustive dashboard ledger proves concrete remaining shell/provider/auth/list/field-controller deltas and supersedes the optimistic route-surface implication here.
2. **Upload scalar exists**, but official Keystone file/image behavior is broader than accepting upload-shaped input.
3. **Many mutations exist**, but exact official settlement/error semantics are still a risk.
4. **`context.internal()` and `withRequest()` exist**, but private/internal details still differ from official transport semantics.
5. **Auth flows exist**, but session sealing/storage behavior is not official Keystone parity.
6. **Prisma generation exists**, but it is not the full official artifacts/types/schema workflow.
7. **Admin meta exists**, but it is still driven by local runtime metadata, not official field-controller machinery.
8. **Field views on dashboard pages may work**, but that does not prove backend field semantics match Keystone.

---

## 30 parity items

### Group A — Dashboard UI parity

### 1. Dashboard route surface parity
- **Why it matters:** Without route parity, create/edit/auth flows dead-end even if backend CRUD exists.
- **Official Keystone evidence path(s):** Not in official Keystone core; custom starter reference from `dashboard-feature-gap-report.md` and `dashboard-visual-comparison.md` cites Next starter routes under `/Users/junaid/code/next-keystone-starter/app/dashboard/**`.
- **Local code path(s):** `src/routeTree.gen.ts:9-25, 89-104`; `src/routes/dashboard/$listKey.tsx:1-45`; `src/routes/dashboard/$listKey.create.tsx`; `src/routes/dashboard/$listKey.$id.tsx:25-42`; `src/routes/dashboard/signin.tsx:1-116`; `src/routes/dashboard/signup.tsx`; `src/routes/dashboard/reset.tsx:13-130`.
- **Current status:** **Substantially complete vs prior audits.** Older artifacts saying create/item/signup/reset routes were missing are stale.
- **What remains to reach parity:** Verify that all routes match the original UX and auth guard behavior, not just existence; ensure breadcrumbs, redirects, singleton handling, and auth-only/public distinctions mirror the source app.
- **Recommended implementation order:** 1
- **Concrete validation gate:** Route smoke test for `/dashboard`, `/dashboard/users`, `/dashboard/users/create`, `/dashboard/users/user_admin`, `/dashboard/signin`, `/dashboard/signup`, `/dashboard/reset`, `/dashboard/init`, `/dashboard/no-access` with expected redirect/200 behavior.

### 2. Sign-in screen parity
- **Why it matters:** Sign-in is the first visible parity check and depends on auth mutation correctness plus UI parity.
- **Official Keystone evidence path(s):** Custom starter visual evidence in `dashboard-visual-comparison.md` sign-in section; auth contract reference in official auth package `packages/auth/src/gql/getBaseAuthSchema.ts:1-110` via `runtime-audit.md`.
- **Local code path(s):** `src/routes/dashboard/signin.tsx:31-116`; `src/features/cms/auth/graphql.ts:115-204`.
- **Current status:** **Mostly implemented.** The page now includes logo, sign-up link, reset link, password visibility toggle, and live sign-in mutation.
- **What remains to reach parity:** Match original copy/styling/toast/error behavior exactly; verify redirect safety and failed-auth messaging against source expectations.
- **Recommended implementation order:** 2
- **Concrete validation gate:** Browser test: failed sign-in shows visible error; successful sign-in lands on `from` route; reset and signup links resolve correctly.

### 3. Sign-up and reset flow parity
- **Why it matters:** The original dashboard exposes these public auth entry points; parity requires both routes and backend support.
- **Official Keystone evidence path(s):** Custom starter references in `dashboard-feature-gap-report.md`; official auth reset concepts in `packages/auth/src/gql/getBaseAuthSchema.ts:1-110` and `runtime-audit.md`.
- **Local code path(s):** `src/routes/dashboard/signup.tsx`; `src/routes/dashboard/reset.tsx:13-130`; `src/features/cms/auth/graphql.ts:150-204`; `cms.config.ts` auth config.
- **Current status:** **Partial-to-strong.** Routes now exist and reset GraphQL mutations are wired. Public signup policy still depends on app policy and may not mirror original starter behavior exactly.
- **What remains to reach parity:** Confirm sign-up gating, copy, redirect behavior, reset-token email delivery contract, and final post-reset UX.
- **Recommended implementation order:** 3
- **Concrete validation gate:** End-to-end flow: request reset link, redeem token, sign in with new password; verify signup availability follows configured flag.

### 4. Dashboard shell and navigation parity
- **Why it matters:** The shell defines the admin experience and is one of the most visible parity surfaces.
- **Official Keystone evidence path(s):** Custom starter references from `dashboard-feature-gap-report.md` and `dashboard-visual-comparison.md`; not part of official Keystone core.
- **Local code path(s):** `src/components/dashboard/dashboard-shell.tsx`; `src/routes/dashboard.tsx`; `src/routes/dashboard/index.tsx`.
- **Current status:** **Close partial parity.** Left shell, header, and navigation are present; route guards and user shell are working.
- **What remains to reach parity:** Confirm collapsible behavior, profile menu behavior, right-side ancillary panels, and exact visual layout if NKS parity includes AI sidebar/profile details.
- **Recommended implementation order:** 6
- **Concrete validation gate:** Visual regression snapshots for dashboard home and one list page against current accepted baseline.

### 5. Dashboard home card parity
- **Why it matters:** Model-count cards are the top-level dashboard contract consumers see first.
- **Official Keystone evidence path(s):** Starter visual evidence in `dashboard-visual-comparison.md` home-route section.
- **Local code path(s):** `src/routes/dashboard/index.tsx`; `src/components/dashboard/list-card.tsx`; `src/features/cms/graphql-client.ts` overview queries.
- **Current status:** **Close.** Counts and core cards exist and are GraphQL-backed.
- **What remains to reach parity:** Verify exact create-button behavior, card metadata, and optional assistant/sidebar content.
- **Recommended implementation order:** 7
- **Concrete validation gate:** Visual/home smoke test asserting Users/Roles/Todos/Todo Images counts and working create links.

### 6. List search/filter/sort/display controls parity
- **Why it matters:** Real admin usage depends on list controls, not just raw table rendering.
- **Official Keystone evidence path(s):** Custom starter references in `dashboard-feature-gap-report.md` list controls sections.
- **Local code path(s):** `src/routes/dashboard/$listKey.tsx:1-102`; `src/components/dashboard/filter-bar.tsx`; `src/components/dashboard/keystone-list-table.tsx`; `src/features/cms/graphql-client.ts` list-page query building.
- **Current status:** **Partial.** Controls exist in the current dashboard stack, but parity vs original NKS/Keystone behavior is not fully proven by the audited artifacts.
- **What remains to reach parity:** Confirm URL-backed filters, sort behavior, display-column control, and supported operator set match dashboard expectations and backend filter capabilities.
- **Recommended implementation order:** 4
- **Concrete validation gate:** Integration test that search params round-trip for `search`, `sortBy`, `fields`, and selected filters and that matching GraphQL variables are emitted.

### 7. List table cell rendering parity
- **Why it matters:** Weak cell rendering makes the dashboard feel incomplete even when the backend is correct.
- **Official Keystone evidence path(s):** Original UI behavior documented in `dashboard-visual-comparison.md` and `dashboard-feature-gap-report.md`.
- **Local code path(s):** `src/components/dashboard/list-preview-table.tsx:67-157`; `src/components/dashboard/keystone-list-table.tsx`; field metadata from `src/features/cms/graphql-client.ts`.
- **Current status:** **Partial.** Current rendering handles checkboxes, multiselects, relationships, and password state, but exact label/link/controller parity is still uncertain.
- **What remains to reach parity:** Render multiselect display labels instead of raw values where needed; link relationship cells; use controller-driven cells consistently.
- **Recommended implementation order:** 5
- **Concrete validation gate:** Snapshot test on Users and Todos lists asserting relationship links, multiselect labels, checkbox presentation, and password `isSet` rendering.

### 8. Create-page parity
- **Why it matters:** Create forms are a major divider between a read-only dashboard and a real admin UI.
- **Official Keystone evidence path(s):** Custom starter references in `dashboard-feature-gap-report.md`; original route evidence in `dashboard-visual-comparison.md`.
- **Local code path(s):** `src/routes/dashboard/$listKey.create.tsx`; field metadata from `runtime.ts` `FieldMeta.createView`; GraphQL create mutations in `src/features/cms/runtime.ts:544-548, 930-945`.
- **Current status:** **Partial.** Route exists and backend create mutations exist, but full field/controller/form parity is not proven.
- **What remains to reach parity:** Complete controller-backed field serialization, required-state validation, relationship pickers, error handling, and post-create redirect behavior across all starter lists.
- **Recommended implementation order:** 8
- **Concrete validation gate:** Browser create flow for User and Todo reaching persisted item page and list count increment.

### 9. Item detail/edit parity
- **Why it matters:** Save/reset/delete item behavior is the core admin contract.
- **Official Keystone evidence path(s):** Custom starter item-page evidence in `dashboard-feature-gap-report.md` and `dashboard-visual-comparison.md`.
- **Local code path(s):** `src/routes/dashboard/$listKey.$id.tsx:25-42, 96-213`; field `itemView(id:)` from `src/features/cms/runtime.ts:154-176, 1061-1099`; update/delete mutations in `runtime.ts:547-548, 947-983`.
- **Current status:** **Partial-to-strong.** Route exists, and save/reset/delete affordances are present in source. Full parity still depends on field/controller/runtime behavior.
- **What remains to reach parity:** Confirm changed-field detection, relationship editors, validation, delete confirmations, copy-ID behavior, and unreadable/hidden-field behavior match expectations.
- **Recommended implementation order:** 9
- **Concrete validation gate:** Edit User and Todo items, save changes, reset unsaved changes, delete an item, and verify list/detail cache invalidation.

### 10. Admin meta contract parity for dashboard consumers
- **Why it matters:** The dashboard depends on `adminMeta` shape for route discovery, field modes, labels, groups, and controller selection.
- **Official Keystone evidence path(s):** Official admin meta pipeline referenced in `runtime-audit.md` via `packages/core/src/lib/system.ts` and initialized fields; custom dashboard dependence documented in `dashboard-feature-gap-report.md`.
- **Local code path(s):** `src/features/cms/runtime.ts:1043-1113`; `src/features/cms/admin-meta.ts`; `src/features/cms/graphql-client.ts`; `src/features/cms/runtime.ts:1064-1099` (`FieldMeta` resolvers).
- **Current status:** **Functional partial.** `adminMeta`, `list(key:)`, field views, groups, and actions exist.
- **What remains to reach parity:** Ensure every field kind exposes the same controller-facing metadata and modes expected by NKS-style field registries; prove item-specific `itemView(id:)` semantics under access restrictions.
- **Recommended implementation order:** 10
- **Concrete validation gate:** Schema/introspection test over `keystone.adminMeta` plus item-specific field mode snapshots for admin vs restricted user sessions.

---

### Group B — Backend/runtime parity

### 11. `config()/list()/group()` API parity
- **Why it matters:** Source-compatibility starts at the public modeling DSL.
- **Official Keystone evidence path(s):** `packages/core/src/schema.ts:15-137, 151-191` from `runtime-audit.md`.
- **Local code path(s):** `src/features/cms/config.ts:1-208`; `src/features/cms/keystone/core.ts`; `cms.config.ts`.
- **Current status:** **Strong partial.** DSL wrappers exist; `group()` supports sentinel generation; config normalization exists.
- **What remains to reach parity:** Match more official defaults/validation and ensure source-style configs work without local caveats.
- **Recommended implementation order:** 11
- **Concrete validation gate:** Config-unit tests covering reserved `fields.id`, invalid providers, group nesting rejection, and defaulted db/server/graphql/ui values.

### 12. Reserved `fields.id` and id-field policy parity
- **Why it matters:** Official Keystone treats `id` specially; incorrect behavior causes migration/runtime mismatches.
- **Official Keystone evidence path(s):** `packages/core/src/schema.ts:16-23, 47-55` from `runtime-audit.md`.
- **Local code path(s):** `src/features/cms/config.ts:333-356`; `src/features/cms/config.ts:231-239`.
- **Current status:** **Mostly present.** Local config now explicitly rejects `fields.id` and injects an id field.
- **What remains to reach parity:** Broaden support for official `db.idField` options and singleton nuances exactly as Keystone does.
- **Recommended implementation order:** 12
- **Concrete validation gate:** Unit tests for user-defined `fields.id`, singleton + `db.idField` conflict, and default id kind selection.

### 13. Config defaulting depth parity
- **Why it matters:** Even if CRUD works, incomplete config defaulting means source-compatible configs may behave unexpectedly.
- **Official Keystone evidence path(s):** `packages/core/src/schema.ts:67-137` from `runtime-audit.md`.
- **Local code path(s):** `src/features/cms/config.ts:88-170`.
- **Current status:** **Partial.** Provider/path/server/ui defaults exist, but official breadth is larger.
- **What remains to reach parity:** Add or consciously document missing official defaults such as wider db options, types-path behavior, and server/graphql compatibility semantics.
- **Recommended implementation order:** 13
- **Concrete validation gate:** Snapshot normalized config output against expected fixtures covering minimal and full config variants.

### 14. Public/internal schema split parity
- **Why it matters:** Keystone uses internal schemas to power sudo/internal behavior and bypass omit/access at the right seam.
- **Official Keystone evidence path(s):** `packages/core/src/lib/system.ts:58-97, 147-180`; `packages/core/src/lib/context/createContext.ts:7-133` from `runtime-audit.md`.
- **Local code path(s):** `src/features/cms/runtime.ts:520-549, 723-727, 1150-1175`; `getCmsGraphQLSchema()` in `runtime.ts:1167-1189`.
- **Current status:** **Strong partial.** Local runtime has `public` and `internal` schemas and separate context builders.
- **What remains to reach parity:** Verify internal schema truly bypasses all intended omit/filter/order/access restrictions exactly like official Keystone.
- **Recommended implementation order:** 14
- **Concrete validation gate:** Tests proving fields/lists omitted in public schema remain accessible through `context.internal()` / `context.sudo()` where intended.

### 15. CRUD schema generation parity
- **Why it matters:** Schema shape drives both dashboard behavior and external API compatibility.
- **Official Keystone evidence path(s):** `packages/core/src/lib/system.ts:147-180`; `packages/core/src/lib/core/initialise-lists.ts:360-626`; `packages/core/src/lib/core/mutations/index.ts:607-899` from `runtime-audit.md`.
- **Local code path(s):** `src/features/cms/runtime.ts:520-549`; generated field/type helpers throughout `runtime.ts`.
- **Current status:** **Strong partial.** Queries, single mutations, many mutations, where/order inputs, Upload/JSON, image/file outputs, and admin meta types are generated.
- **What remains to reach parity:** Match official type semantics for field-owned filters/inputs, action fields, omission rules, and edge-case nullability/defaults.
- **Recommended implementation order:** 15
- **Concrete validation gate:** SDL snapshot comparison for starter lists covering Query, Mutation, and all generated input/output types.

### 16. `extendGraphqlSchema` parity
- **Why it matters:** Config-level schema extension is a required Keystone customization seam.
- **Official Keystone evidence path(s):** `packages/core/src/schema.ts:109-115`; central application path referenced in `runtime-audit.md`.
- **Local code path(s):** `src/features/cms/config.ts:41-48, 112-124`; `src/features/cms/runtime.ts:1170-1174`; `cms.config.ts`.
- **Current status:** **Implemented and improved from prior uncertainty.** Current runtime explicitly applies `extendGraphqlSchema` after auth schema merging.
- **What remains to reach parity:** Prove behavior under both public and internal schemas, merged types, and extension ordering constraints.
- **Recommended implementation order:** 16
- **Concrete validation gate:** Test extension query/mutation presence and execution from `cms.config.ts` (for example `redirectToInit`) in both runtime modes.

### 17. Context API parity (`db/query/graphql/prisma/transaction/internal/sudo/withRequest/withSession`)
- **Why it matters:** Keystone-style app code expects this context surface.
- **Official Keystone evidence path(s):** `packages/core/src/lib/context/createContext.ts:7-133` from `runtime-audit.md`.
- **Local code path(s):** `src/features/cms/runtime.ts:616-736`; `src/features/cms/adapters/types.ts`.
- **Current status:** **Much stronger than older audits.** All major methods now exist.
- **What remains to reach parity:** Align transport/private internals with official Node req/res conventions and verify transaction/internal semantics fully.
- **Recommended implementation order:** 17
- **Concrete validation gate:** Runtime test calling `context.db.User.findMany`, `context.query.Todo.findMany`, `context.graphql.run`, `context.transaction`, `context.internal()`, `context.sudo()`, and `context.withRequest()`.

### 18. Many-mutation semantics parity
- **Why it matters:** Admin UIs and bulk workflows depend on consistent createMany/updateMany/deleteMany behavior.
- **Official Keystone evidence path(s):** `packages/core/src/lib/core/mutations/index.ts:741-854`, especially settlement helper at `:815-825`, from `runtime-audit.md`.
- **Local code path(s):** `src/features/cms/runtime.ts:489-491, 546-548, 646-691, 938-983`.
- **Current status:** **Present and materially improved.** Many mutations exist in both GraphQL and context APIs, with all-settled ordering helper.
- **What remains to reach parity:** Prove exact error ordering, transaction semantics, hook timing, and partial-failure behavior against official expectations.
- **Recommended implementation order:** 18
- **Concrete validation gate:** Dedicated tests causing mixed-success bulk operations and asserting result ordering plus GraphQL error array stability.

### 19. Relationship nested-write semantics parity
- **Why it matters:** Relationship create/update flows are central to real Keystone usage.
- **Official Keystone evidence path(s):** `packages/core/src/lib/core/initialise-lists.ts:523-626`; `nested-mutation-one-input-resolvers.ts`; `nested-mutation-many-input-resolvers.ts` from `runtime-audit.md`.
- **Local code path(s):** `src/features/cms/adapters/prisma.ts`; `src/features/cms/adapters/memory.ts`; validation scripts cited in `runtime-audit.md`.
- **Current status:** **Partial-to-strong.** Connect/disconnect/set and nested create support are reported in runtime audit and validation scripts.
- **What remains to reach parity:** Match official nested mutation error aggregation, ordering, and broader relationship topology handling.
- **Recommended implementation order:** 19
- **Concrete validation gate:** Memory and Prisma tests for nested to-one/to-many create/connect/disconnect/set plus failure rollback cases.

### 20. Access-control parity
- **Why it matters:** “Looks right” parity is meaningless if operation/filter/item/field access diverges.
- **Official Keystone evidence path(s):** `packages/core/src/lib/core/access-control.ts` from `runtime-audit.md`.
- **Local code path(s):** `src/features/cms/access.ts:58-224`; access hooks in list/field metadata; `runtime.ts` query/mutation resolver guards.
- **Current status:** **Good partial.** Real generic access engine exists with operation/filter/item/field layers and sudo bypass.
- **What remains to reach parity:** Tighten official-style validation of filter returns and read gating edge cases; prove dynamic filter/order access semantics.
- **Recommended implementation order:** 20
- **Concrete validation gate:** Access matrix tests for admin/editor/anonymous/sudo across query/create/update/delete and field read/write restrictions.

### 21. Hooks lifecycle parity
- **Why it matters:** Keystone’s runtime semantics depend heavily on hook ordering and deferred afterOperation behavior.
- **Official Keystone evidence path(s):** `packages/core/src/lib/core/mutations/index.ts:340-617`; field hook plumbing references in `runtime-audit.md`.
- **Local code path(s):** `src/features/cms/hooks.ts:54-172`; adapter integration in `src/features/cms/adapters/prisma.ts` and `memory.ts` as cited by `runtime-audit.md`.
- **Current status:** **Good partial.** `resolveInput`, `validateInput`, `validateDelete`, `beforeOperation`, `afterOperation`, and deferred flush logic exist.
- **What remains to reach parity:** Prove exact ordering against relationship resolvers, input resolution, and many-mutation batching semantics.
- **Recommended implementation order:** 21
- **Concrete validation gate:** Hook-order integration tests recording each phase during create/update/delete and bulk variants.

### 22. Admin meta access gating parity
- **Why it matters:** `adminMeta` should reflect access and UI restrictions, not leak hidden fields.
- **Official Keystone evidence path(s):** Official admin meta/system pipeline referenced in `runtime-audit.md`.
- **Local code path(s):** `src/features/cms/runtime.ts:1043-1113`; `src/features/cms/admin-meta.ts`; `evaluateFieldMode`/`getAdminMetaForContext` usage in `runtime.ts`.
- **Current status:** **Partial-to-strong.** Context-sensitive `adminMeta` and `itemView(id:)` field mode evaluation are present.
- **What remains to reach parity:** Prove all field kinds, groups, and action metadata obey access/read rules and match dashboard expectations.
- **Recommended implementation order:** 22
- **Concrete validation gate:** Snapshot `adminMeta` for the same list under admin vs restricted user contexts and compare field modes/groups/actions.

---

### Group C — Field/controller behavior parity

### 23. Field factory architecture parity
- **Why it matters:** This is the deepest structural gap; without it, per-field edge behavior remains fragile.
- **Official Keystone evidence path(s):** `packages/core/src/lib/core/initialise-lists.ts:376-706`; field factories under `packages/core/src/fields/types/*`; explicit image example `packages/core/src/fields/types/image/index.ts:166-221`, all from `runtime-audit.md`.
- **Local code path(s):** `src/features/cms/fields/index.ts`; `src/features/cms/runtime.ts`; field behavior spread across adapters/storage/access/hooks.
- **Current status:** **Divergent.** Local field factories are metadata-oriented, not official runtime fragment factories.
- **What remains to reach parity:** Move behavior ownership toward field-level resolvers/DB metadata/hook fragments instead of centralized kind-switch logic.
- **Recommended implementation order:** 23
- **Concrete validation gate:** For at least text/password/relationship/image, prove each field type can define its own input/output/access/hook/runtime fragments without runtime-wide switch expansion.

### 24. Text/select/multiselect field behavior parity
- **Why it matters:** These fields drive most list displays, search UX, validation, and form serialization.
- **Official Keystone evidence path(s):** Official field-type references in `official-keystone-parity-gap-report.md` and `runtime-audit.md` (`packages/core/src/fields/types/text/index.ts`, select/multiselect counterparts).
- **Local code path(s):** `src/features/cms/fields/index.ts`; list rendering in `src/components/dashboard/list-preview-table.tsx:91-157`; adapter coercion/validation in memory/prisma adapters.
- **Current status:** **Partial.** Core fields work, but controller/display-label parity and official validation semantics are not fully aligned.
- **What remains to reach parity:** Match display-label handling, validation rules, unique/search semantics, and controller metadata across create/item/list views.
- **Recommended implementation order:** 24
- **Concrete validation gate:** Field-level tests for required/optional values, search/filter behavior, select-option validation, and display labels in dashboard tables/forms.

### 25. Password field parity
- **Why it matters:** Password behavior touches auth correctness, security, and UI behavior.
- **Official Keystone evidence path(s):** `packages/core/src/fields/types/password/index.ts` and auth package dependencies cited in `runtime-audit.md`.
- **Local code path(s):** `src/features/cms/auth/password.ts`; `src/features/cms/auth/graphql.ts:137-204`; `src/features/cms/runtime.ts:297-299, 1008-1011`.
- **Current status:** **Stronger than old audits but still partial.** Password hashing/verification helpers exist, auth uses them, and GraphQL output stays `PasswordState { isSet }`.
- **What remains to reach parity:** Match official field-factory integration, validations, and exact auth-field/runtime coupling; verify no remaining legacy boolean-style assumptions remain anywhere.
- **Recommended implementation order:** 25
- **Concrete validation gate:** Tests for hash-on-create, rehash-on-update, `authenticateUserWithPassword`, reset-token redemption, and password field unreadability in all queries.

### 26. Relationship field/controller parity
- **Why it matters:** Relationship fields are where dashboard controllers and backend semantics most often drift apart.
- **Official Keystone evidence path(s):** `packages/core/src/fields/types/relationship/index.ts`; `packages/core/src/lib/core/resolve-relationships.ts`; nested mutation references in `runtime-audit.md`.
- **Local code path(s):** `src/features/cms/access.ts:179-224`; adapters relationship resolvers; dashboard list/detail/create routes; `src/components/dashboard/list-preview-table.tsx:113-132`.
- **Current status:** **Partial-to-strong backend, partial UI.** Backend relationship read/write support is real; dashboard picker/controller parity is less certain.
- **What remains to reach parity:** Strengthen option-query UX, linked display behavior, ownership validation, and form controls across create/item views.
- **Recommended implementation order:** 26
- **Concrete validation gate:** End-to-end tests for selecting related Role/Tasks, updating both to-one and to-many relationships, and respecting access constraints.

### 27. Field view/controller contract parity
- **Why it matters:** The original dashboard depends on field-specific controllers, not generic JSON-ish forms.
- **Official Keystone evidence path(s):** This is primarily custom starter/admin UI contract rather than official core; evidence summarized in `dashboard-feature-gap-report.md` and `tanstack-dashboard-delta.md`.
- **Local code path(s):** `src/features/cms/runtime.ts:154-176, 1064-1099`; dashboard field rendering/components under `src/components/dashboard/**` and related route files.
- **Current status:** **Partial.** Backend exposes `viewsIndex`, `createView`, `itemView`, and `listView`; exact controller registry parity is not established in these audits.
- **What remains to reach parity:** Confirm every field kind used by starter models has compatible controller metadata and runtime form behavior.
- **Recommended implementation order:** 27
- **Concrete validation gate:** Controller contract tests asserting each field kind exposes required view metadata and round-trips serialize/deserialize correctly.

---

### Group D — Auth/session parity

### 28. Auth GraphQL contract parity
- **Why it matters:** The dashboard and app auth flows depend on `authenticatedItem`, `authenticate*WithPassword`, `endSession`, reset, and init-first-item contracts.
- **Official Keystone evidence path(s):** `packages/auth/src/gql/getBaseAuthSchema.ts:1-110`; `runtime-audit.md` auth section.
- **Local code path(s):** `src/features/cms/auth/graphql.ts:67-252`; `src/routes/dashboard/signin.tsx:36-61`; reset/init routes and `cms.config.ts` auth config.
- **Current status:** **Strong partial.** Core auth GraphQL surface exists and is wired into dashboard routes.
- **What remains to reach parity:** Match exact naming/typing/behavior edge cases across all auth flows, especially if more than the User list will ever be supported.
- **Recommended implementation order:** 28
- **Concrete validation gate:** GraphQL tests for `authenticatedItem`, `authenticateUserWithPassword`, `endSession`, `sendUserPasswordResetLink`, `redeemUserPasswordResetToken`, `createInitialUser`.

### 29. Session strategy parity
- **Why it matters:** Security and compatibility depend on how sessions are issued, parsed, refreshed, and ended.
- **Official Keystone evidence path(s):** `packages/core/src/session.ts:1-151` from `runtime-audit.md`.
- **Local code path(s):** `src/features/cms/auth/session.ts`; session use in `src/features/cms/runtime.ts:723-736, 865-909`; `cms.config.ts` session config.
- **Current status:** **Good partial.** Stateless sessions with cookie/Bearer concepts exist, but the implementation is custom.
- **What remains to reach parity:** Decide whether exact Iron/stored-session parity is required; if yes, align cryptographic/session semantics and stored-session option support.
- **Recommended implementation order:** 29
- **Concrete validation gate:** Tests covering cookie issuance, bearer token auth, end-session invalidation, and session data hydration across requests.

### 30. Dashboard auth gating parity
- **Why it matters:** Admin pages must enforce access consistently with user role/session data.
- **Official Keystone evidence path(s):** Custom starter/dashboard behavior from `dashboard-feature-gap-report.md`; runtime auth references above.
- **Local code path(s):** `src/routes/dashboard.tsx`; `src/features/cms/dashboard-route-guards.ts`; `src/features/cms/dashboard-auth.functions.ts`; `src/features/cms/runtime.ts:1043-1113` (`adminMeta` gating).
- **Current status:** **Partial-to-strong.** Route gating exists, but parity depends on session semantics and role-based access consistency.
- **What remains to reach parity:** Prove anonymous redirect, no-access routing, init-only flow, and authenticated dashboard access match the intended contract under real session cookies.
- **Recommended implementation order:** 30
- **Concrete validation gate:** Browser flow for anonymous, editor-without-dashboard-access, admin, and first-run/init states.

---

### Group E — Storage/upload parity

### 31. Upload scalar transport parity
- **Why it matters:** File and image parity is impossible without real upload handling from GraphQL input to persisted bytes.
- **Official Keystone evidence path(s):** Official image/file field behavior from `packages/core/src/fields/types/image/index.ts:1-221` via `runtime-audit.md`.
- **Local code path(s):** `src/features/cms/runtime.ts:38-76, 263-271, 360-364`; `src/routes/api/cms/upload`; `src/features/cms/storage.ts:1-123`.
- **Current status:** **Partial-to-strong local implementation.** `Upload` exists, GraphQL upload values are accepted, and bytes can be persisted for local storage.
- **What remains to reach parity:** Confirm multipart transport and GraphQL upload path behave like the intended product contract across browser/server execution paths.
- **Recommended implementation order:** 31
- **Concrete validation gate:** Upload integration test from browser form to stored file and GraphQL-returned metadata.

### 32. Local storage strategy parity
- **Why it matters:** Official image/file fields rely on storage strategies, URLs, and lifecycle cleanup.
- **Official Keystone evidence path(s):** `packages/core/src/fields/types/image/index.ts:75-164` and storage context references from `runtime-audit.md`.
- **Local code path(s):** `src/features/cms/storage.ts:21-123`; `src/features/cms/storage-config.ts`; `src/features/cms/storage-url.ts`.
- **Current status:** **Functional local partial.** Local file persistence, URL generation, and delete logic exist.
- **What remains to reach parity:** Expand lifecycle parity on replace/delete cases and prove full image/file field integration across mutations.
- **Recommended implementation order:** 32
- **Concrete validation gate:** Create/update/delete item with stored image/file and assert file write, URL, and cleanup behavior.

### 33. Non-local storage parity (S3/custom strategies)
- **Why it matters:** Official Keystone storage abstraction is broader than local dev storage.
- **Official Keystone evidence path(s):** Storage strategy behavior referenced in `runtime-audit.md` and official image field source.
- **Local code path(s):** `src/features/cms/storage.ts:58-64, 88-96`.
- **Current status:** **Not complete.** Non-local kinds explicitly throw.
- **What remains to reach parity:** Implement non-local strategy adapters or document parity as intentionally out of scope.
- **Recommended implementation order:** 33
- **Concrete validation gate:** Strategy-level tests for non-local config (or explicit invariant tests that unsupported strategies fail fast with documented errors).

### 34. Image/file field output parity
- **Why it matters:** Dashboard/media consumers expect official Keystone-like output shapes and lifecycle behavior.
- **Official Keystone evidence path(s):** `packages/core/src/fields/types/image/index.ts:1-221` via `runtime-audit.md`.
- **Local code path(s):** `src/features/cms/runtime.ts:66-79, 298-299, 1012-1016`; `src/features/cms/storage.ts:125-201`; `src/features/cms/prisma-schema.ts:64-67`.
- **Current status:** **Partial.** `ImageFieldOutput`/`FileFieldOutput` exist and image metadata extraction is real.
- **What remains to reach parity:** Match official input restrictions, replacement/delete semantics, and URL/storage behavior for all storage types.
- **Recommended implementation order:** 34
- **Concrete validation gate:** GraphQL tests asserting image/file output shape after upload and after update/delete replacement flows.

---

### Group F — Validation/testing and proof of parity

### 35. Prisma/codegen/artifacts parity
- **Why it matters:** Runtime parity is fragile if generated schema/types/artifacts drift from the source config.
- **Official Keystone evidence path(s):** `packages/core/src/lib/core/prisma-schema-printer.ts`; `packages/core/src/artifacts.ts`; `runtime-audit.md` prisma section.
- **Local code path(s):** `src/features/cms/prisma-schema.ts:1-112`; `prisma/schema.prisma`; scripts referenced in `runtime-audit.md`.
- **Current status:** **Partial.** Local schema printer and generated Prisma schema exist.
- **What remains to reach parity:** Add official-style artifacts bundle expectations, schema drift checks, and broader relationship/printer correctness guarantees.
- **Recommended implementation order:** 35
- **Concrete validation gate:** Deterministic schema-generation snapshot plus drift check in CI against `prisma/schema.prisma` and generated GraphQL artifacts.

### 36. Parity-proof test coverage
- **Why it matters:** Without proof, “parity” is a guess.
- **Official Keystone evidence path(s):** Official packages have broad internal coverage; local gaps summarized in `runtime-audit.md` test section.
- **Local code path(s):** `scripts/validate-cms-crud.ts`; `scripts/validate-cms-prisma.ts`; dashboard/browser comparison artifacts; runtime source tests implied by current scripts.
- **Current status:** **Good for current runtime, insufficient for exact parity.** Existing scripts validate CRUD, admin meta, nested writes, access cases, image upload, and Prisma runtime basics.
- **What remains to reach parity:** Add targeted parity tests for many-mutation ordering, internal/public schema differences, auth/session edge cases, field-controller serialization, and storage replacement flows.
- **Recommended implementation order:** 36
- **Concrete validation gate:** A parity suite that must pass in both memory and Prisma modes, plus browser-level smoke tests for dashboard auth/create/edit/list flows.

---

## Recommended implementation order across the full repo

1. Lock down **proof gaps first**: `extendGraphqlSchema`, many-mutation ordering, internal/public schema tests, auth/session tests.
2. Close **dashboard contract gaps** that are now route-complete but behavior-incomplete: list controls, create/item field controller behavior, cell rendering.
3. Harden **field semantics**: password, relationship, text/select/multiselect controller+runtime alignment.
4. Finish **storage parity** for replace/delete flows and explicitly decide whether non-local strategy parity is in scope.
5. Deepen **config/system/prisma artifacts** toward official Keystone-like guarantees.
6. Only then claim “complete parity,” because the remaining gaps are semantic, not just missing screens.

---

## What another agent must implement to claim complete parity

Another agent can only credibly claim complete parity after all of the following are true:

1. **Dashboard parity proof**
   - Create, item, signin, signup, reset, init, and no-access routes all work end-to-end.
   - List search/filter/sort/display and table rendering match the intended NKS/Keystone behavior for starter models.
   - Field controllers serialize and render starter field kinds correctly in create/item/list contexts.

2. **Runtime parity proof**
   - Public/internal schema differences are tested and intentional.
   - `extendGraphqlSchema` is covered by tests.
   - `context.db/query/graphql/prisma/transaction/internal/sudo/withRequest/withSession` is exercised in tests.
   - Many-mutation ordering and error semantics are proven against expected behavior.

3. **Field/auth/storage parity proof**
   - Password auth, reset, and session flows pass end-to-end tests.
   - Image/file upload, replacement, delete cleanup, and output metadata are verified.
   - Relationship create/update/connect/disconnect/set behavior is tested in both memory and Prisma modes.

4. **Artifact and schema proof**
   - Prisma schema generation and drift checks are deterministic.
   - Generated SDL snapshots are current and reviewed.
   - CI includes the parity suite, not just local CRUD scripts.

5. **No stale-report contradictions remain**
   - Update or supersede older local reports that still claim missing many mutations, missing routes, or missing context/auth surfaces.
   - The repo should have a single authoritative parity report that matches the current code.

If those conditions are not all met, the honest claim is still **“advanced partial parity”**, not **“complete parity.”**
