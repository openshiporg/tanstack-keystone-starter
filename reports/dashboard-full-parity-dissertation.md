# Dashboard Full Parity Dissertation

Date: 2026-05-12  
Scope: Exhaustive parity diff between:
- Source of truth: `/Users/junaid/code/next-keystone-starter`
- Target: `/Users/junaid/code/tanstack-keystone-starter`

---

## Executive Summary

The TanStack dashboard has moved from prototype to partially functional shell, but still falls materially short of Next Keystone Starter parity in critical areas: field-view/controller integration, create/edit item flows, full filter grammar, bulk actions, and auth adjunct flows (reset/signup semantics). Route parity is now substantially present, but behavior parity is incomplete.

### Overall parity score (weighted)
- **Route surface**: 90%
- **Auth gating/middleware semantics**: 75%
- **Dashboard shell/navigation**: 80%
- **List read UX**: 60%
- **Filter/sort/column controls**: 45%
- **Create flow**: 35%
- **Item edit flow**: 25%
- **Field view registry/controller parity**: 20%
- **Reset/signup functional parity**: 30%
- **AI/right-sidebar parity**: 20%

**Aggregate weighted parity: ~48%**

---

## Methodology and Evidence

This report synthesizes direct code inspection and existing audits in repo:
- `next-dashboard-ui-inventory.md`
- `tanstack-dashboard-delta.md`
- `dashboard-visual-comparison.md`
- `src/routeTree.gen.ts`

and direct route/file comparisons across both repos.

---

## 1) Route Parity Diff

## Source (Next Keystone Starter)
From `app/dashboard/**`:
- `app/dashboard/(admin)/page.tsx`
- `app/dashboard/(admin)/[listKey]/page.tsx`
- `app/dashboard/(admin)/[listKey]/create/page.tsx`
- `app/dashboard/(admin)/[listKey]/[id]/page.tsx`
- `app/dashboard/signin/page.tsx`
- `app/dashboard/signup/page.tsx`
- `app/dashboard/reset/page.tsx`
- `app/dashboard/init/page.tsx`
- `app/dashboard/no-access/page.tsx`

## Target (TanStack)
From `src/routes/dashboard/**` and `src/routeTree.gen.ts`:
- `/dashboard`
- `/dashboard/$listKey`
- `/dashboard/$listKey/create`
- `/dashboard/$listKey/$id`
- `/dashboard/signin`
- `/dashboard/signup`
- `/dashboard/reset`
- `/dashboard/init`
- `/dashboard/no-access`

### Differences
1. **Route existence gap is mostly closed** (was large before).
2. **Behavioral parity still diverges**:
   - Next admin route composition depends on App Router server layouts and action/middleware coupling.
   - TanStack relies on `beforeLoad` and in-process server function bridges.

### Severity
- **Medium** (surface parity high, behavioral semantics still drifting).

### Acceptance criteria
- All route-level redirects match Next behavior matrix for auth/init/no-access.
- Deep-link behavior for create/item routes matches source (including URL-state restoration and permission failures).

---

## 2) Middleware / Guard / Redirect Semantics

## Next reference
- `features/dashboard/middleware.ts`
- Uses GraphQL checks for `redirectToInit` and authenticated user role access.

## TanStack implementation
- `src/routes/dashboard.tsx`
- Uses `getDashboardAuthStateForCurrentRequest()` + `beforeLoad` route gating.

### Differences
1. **Mechanism mismatch**: Next middleware vs TanStack route guard (acceptable adaptation).
2. **Edge behavior risk** on route transitions and SSR/client hydration boundaries.
3. **Public auth routes** now included (`signin/signup/reset`) but still need exact parity on redirect-from handling and stale-session states.

### Severity
- **Medium-High** for correctness and UX consistency.

### Acceptance criteria
- Redirect matrix exact-match across 20+ scenarios (see test matrix section).
- No client-side flashes into blocked content.

---

## 3) Dashboard Shell / Provider Stack Parity

## Next reference
- `features/dashboard/components/DashboardLayout.tsx`
- Wraps: ErrorBoundary, QueryProvider, DashboardProvider, AdminMetaProvider, AI providers, sidebar provider.

## TanStack target
- `src/components/dashboard/dashboard-shell.tsx`
- `src/components/dashboard/dashboard-sidebar.tsx`
- `src/components/dashboard/page-container.tsx`

### Differences
1. **Provider stack incomplete** vs source architecture.
2. **Error boundary semantics not equivalent** to source dashboard boundary.
3. **Right AI sidebar not implemented** (placeholder/floating button only).
4. **Recent Base UI menu context instability** indicates composition fragility.

### Severity
- **High** for stability and product completeness.

### Acceptance criteria
- Provider stack explicit parity map with intentional deltas documented.
- User menu and sidebar interactions stable with no context/runtime errors.
- Right panel parity decision implemented (full port or explicit removal with alt UX).

---

## 4) Auth Screens Parity (signin/signup/reset/init/no-access)

## Signin
- Target now visually closer (logo, links, password toggle) but still differs from source details and action layer behavior.

## Signup
- Target exists but currently scaffold-level (direct create fallback), lacking policy parity.

## Reset
- Target exists as UI/stub; source has reset flow semantics and authless behavior.

## Init
- Core `createInitialUser` mutation exists and naming aligns Keystone behavior.
- Robustness recently improved (full reload, better error surfacing), but still requires end-to-end validation across adapters.

### Differences
1. Missing full action/policy parity for signup/reset.
2. Error/toast and recovery UX not source-equivalent.
3. No complete token-based reset redemption cycle.

### Severity
- **High** (auth flows are core admin viability).

### Acceptance criteria
- Full signup gating parity (including feature flags/policies).
- Reset request + redeem flows implemented with non-enumerating responses.
- Auth screens match source structure and route behavior.

---

## 5) List Page Parity (Read Path)

## Next reference
- `features/dashboard/screens/ListPage/index.tsx`
- `ListPageClient.tsx`
- `components/FilterBar.tsx`, `ListTable.tsx`, `Pagination.tsx`

## TanStack target
- `src/routes/dashboard/$listKey.tsx`
- `src/components/dashboard/filter-bar.tsx`
- `src/components/dashboard/keystone-list-table.tsx`
- `src/components/dashboard/pagination.tsx`

### Differences
1. **Search**: present but narrower vs source metadata-driven breadth.
2. **Filter**: advanced grammar (`!field_filterType`) not implemented.
3. **Sort**: now interactive basic mode; still below source control model.
4. **Display/columns**: partial URL-backed controls exist, but not full source behavior.
5. **Bulk operations**: missing source delete-many UX/action semantics.
6. **Cell rendering**: simplified vs source field view/controller rendering.
7. **Default ordering** differs in observable cases.

### Severity
- **High** (core daily admin workflow).

### Acceptance criteria
- URL-state parity for `search`, filters, sort, fields, page/pageSize.
- Bulk select + delete-many + optimistic/error behavior parity.
- Table headers/cells rendered via source-equivalent field registry.

---

## 6) Create Flow Parity

## Next reference
- `features/dashboard/screens/CreatePage/index.tsx`
- `CreatePageClient.tsx`
- actions + field controller stack.

## TanStack target
- `src/routes/dashboard/$listKey.create.tsx`

### Differences
1. Current create is generic/partial field handling.
2. Missing controller-based per-field create UI behavior.
3. Missing relationship pickers and “create related/view related” affordances.
4. Validation/required-state UX not source-equivalent.

### Severity
- **Critical** for CRUD completeness.

### Acceptance criteria
- Create form generated from controller registry, not ad hoc kind checks.
- Relationship/document/image inputs parity for supported model set.
- Post-create navigation and toast/error behavior match source.

---

## 7) Item/Edit Flow Parity

## Next reference
- `features/dashboard/screens/ItemPage/index.tsx`
- `ItemPageClient.tsx`

## TanStack target
- `src/routes/dashboard/$listKey.$id.tsx` (currently read-focused/partial)

### Differences
1. No full edit/save/reset/delete pipeline equivalent.
2. No changed-field serialization parity.
3. Missing validation hooks (`useInvalidFields`, `useHasChanges` style behavior).
4. Relationship interaction UX minimal.

### Severity
- **Critical**.

### Acceptance criteria
- Editable item form parity for supported field kinds.
- Save/delete actions parity with robust errors and permission handling.
- Dirty-state tracking and reset behavior parity.

---

## 8) Field View Registry / Controller Parity

## Next reference
- `features/dashboard/views/registry.ts`
- `features/dashboard/views/*`
- `components/Fields.tsx`
- `utils/enhanceFields.ts`

## TanStack target
- currently simplified rendering in table/create/item paths.

### Differences
1. Registry-based rendering not fully ported.
2. Controller lifecycle and value conversion semantics incomplete.
3. Document/relationship specialized client components absent.

### Severity
- **Critical** architectural gap (blocks faithful parity at scale).

### Acceptance criteria
- Registry exists with type-by-type adapters.
- Field metadata (`viewsIndex`, `fieldMeta`) mapped into controller surface.
- List cell + create field + item field all use shared registry contracts.

---

## 9) Actions / Hooks / Query Key Architecture

## Next reference
- `features/dashboard/actions/*`
- `features/dashboard/hooks/*`
- `features/dashboard/lib/queryKeys.ts`

## TanStack target
- `src/features/cms/graphql-client.ts` + route-level query usage.

### Differences
1. TanStack consolidates in a single client helper; source has richer action segmentation.
2. Hook abstractions and contract layering missing.
3. Mutation semantics (item/bulk) incomplete.

### Severity
- **High** maintainability and parity risk.

### Acceptance criteria
- Introduce action modules mirroring source use-cases.
- Shared query key factories across list/item/create.
- Dedicated hooks for list/item/create/reset/signup flows.

---

## 10) AI / Dual Sidebar Parity

## Next reference
- `features/dashboard/components/dual-sidebar/*`
- right assistant panel integrated in layout.

## TanStack target
- placeholder floating button, static hidden aside.

### Differences
- Feature absent in meaningful form.

### Severity
- **Medium** (depends on product requirement), but currently visible UX discrepancy.

### Acceptance criteria
- Either full feature parity OR explicit decision to remove and align source expectation with new UX.

---

## 11) Severity Index and Prioritized Gap Ledger

| ID | Gap | Severity | User Impact | Engineering Risk |
|---|---|---|---|---|
| G1 | Field registry/controller parity missing | Critical | High | High |
| G2 | Item edit/save/delete flow incomplete | Critical | High | High |
| G3 | Create flow partial | Critical | High | High |
| G4 | Filter grammar + bulk actions missing | High | High | Medium |
| G5 | Signup/reset functional parity missing | High | Medium/High | Medium |
| G6 | Middleware edge-case drift | High | Medium | Medium |
| G7 | Provider/error-boundary stack mismatch | High | Medium | Medium |
| G8 | AI right-sidebar missing | Medium | Medium | Low |
| G9 | Cell rendering simplifications | High | Medium/High | Medium |
| G10 | Query/action architecture divergence | High | Medium | Medium |

---

## 12) Acceptance Criteria (Master)

Parity is considered complete when all below are true:

1. **Route/guard parity**: all dashboard routes and redirects match source behavior matrix.
2. **CRUD parity**: create/read/update/delete complete for supported field kinds and permissions.
3. **List interaction parity**: search/filter/sort/display/pagination/bulk delete equivalent.
4. **Field-view parity**: registry-driven rendering across table/create/item.
5. **Auth flow parity**: signin/signup/reset/init/no-access fully functional and policy-consistent.
6. **UI parity**: shell/sidebar/breadcrumb/menu/notifications match source intent.
7. **Stability parity**: no runtime context crashes in dropdown/sidebar interactions.
8. **Test parity**: automated matrix green in SSR + browser smoke + auth permutations.

---

## 13) Staged Reconciliation Roadmap

## Stage 0 — Stabilization (1–2 days)
- Fix menu/context composition reliability (done partially; complete via regression sweep).
- Lock route tree integrity and build/lint/test guardrails.
- Add parity tracking sheet (gap IDs above).

Deliverables:
- zero runtime crashes on navigation/user menu.
- stable fresh-init + seeded-init behavior.

## Stage 1 — Field Registry Foundation (3–5 days)
- Port/adapt `views/registry` contract.
- Implement controller adapters for: text, select, checkbox, relationship, password, json/document basic.
- Route list table cell rendering through registry.

Deliverables:
- `features/dashboard/views` equivalent under TanStack.
- table cells parity for supported types.

## Stage 2 — Create & Item Flows (4–7 days)
- Rebuild `/dashboard/$listKey/create` using registry fields and validations.
- Rebuild `/dashboard/$listKey/$id` edit pipeline with dirty-state tracking, save/reset/delete.
- Add relationship picker interactions.

Deliverables:
- full create + item edit/delete for starter models.

## Stage 3 — List Power Features (3–5 days)
- Implement source-like filter grammar and parser.
- Complete sort/field selection UX parity.
- Implement bulk selection + delete-many semantics and error surfacing.

Deliverables:
- list route feature-equivalent behavior.

## Stage 4 — Auth Adjunct Parity (2–4 days)
- Signup policy parity.
- Reset request/redeem end-to-end.
- action-layer parity wrappers for auth.

Deliverables:
- auth screens fully source-equivalent in behavior.

## Stage 5 — Shell/AI/Polish (2–4 days)
- Provider stack and error boundary parity cleanup.
- AI/right-sidebar parity (full port or agreed removal).
- visual and accessibility polish.

Deliverables:
- high-fidelity UI parity and reduced drift.

## Stage 6 — Hardening & Validation (ongoing)
- Full test matrix automation.
- browser smoke snapshots for parity routes.
- regression locks for redirects and auth cookies.

---

## 14) Test Matrix (Comprehensive)

## A. Route and guard matrix
1. Unauth `/dashboard` -> signin with `from`.
2. Unauth `/dashboard/$listKey` -> signin with `from`.
3. Fresh init required -> all dashboard routes redirect `/dashboard/init`.
4. When init done -> `/dashboard/init` redirects to dashboard.
5. Auth but no dashboard access -> `/dashboard/no-access`.
6. Auth user on signin/signup/reset -> redirect dashboard or safe `from`.

## B. Auth flow matrix
1. Signin valid/invalid creds.
2. Signout clears cookie and blocks dashboard.
3. Signup allowed/disabled policy states.
4. Reset request non-enumeration behavior.
5. Reset redeem token valid/expired/invalid.
6. Init first user success/failure/retry.

## C. List read matrix
1. Default list load per list.
2. Search over initialSearchFields.
3. Sort asc/desc by valid orderable fields.
4. Invalid sort ignored safely.
5. Field visibility param valid/invalid.
6. Pagination boundaries and pageSize variants.

## D. Filter grammar matrix
1. Single filter operator types.
2. Multiple filter combinations.
3. Relationship filter cases.
4. Invalid filter syntax handling.
5. URL roundtrip and persistence.

## E. Table interaction matrix
1. Select one/all rows.
2. Bulk delete success/failure partials.
3. Row link to item route.
4. Cell render parity by field kind.

## F. Create flow matrix
1. Required fields validation.
2. Relationship connect/create flows.
3. JSON/document parsing/validation.
4. Error handling on mutation rejection.
5. Success navigation.

## G. Item/edit flow matrix
1. Initial value hydration.
2. Dirty-state detection.
3. Save changes success/failure.
4. Delete flow permissions and outcomes.
5. Reset unsaved changes.

## H. Visual parity matrix
1. Signin/signup/reset/init/no-access screenshots.
2. Home dashboard cards/sidebar parity.
3. List route controls/table parity.
4. Create/item pages parity.

## I. Stability and regression matrix
1. No Base UI context errors in menu/sidebar.
2. No hydration warnings in key routes.
3. SSR/client behavior consistency.
4. Devtools off/on behavior non-invasive.

---

## 15) Recommended Implementation Strategy

1. Stop adding one-off route hacks.
2. Port source field registry/controller architecture first.
3. Build create/item/list features on that shared substrate.
4. Keep a strict parity checklist with screenshot + behavior assertions per route.
5. Require passing route+auth+CRUD matrix before calling parity milestone complete.

---

## 16) Final Verdict

The project has regained momentum and now has near-complete route surface parity and stronger auth/init guard foundations, but it is **not yet functionally equivalent** to Next Keystone Starter dashboard. The largest blocker is still controller/field-view architecture parity; until that is ported, create/item/list experiences will continue to be partial and brittle.

The staged roadmap above is sufficient to reconcile the gap in a disciplined way if executed in order (registry -> CRUD flows -> list power features -> auth adjunct -> polish/hardening).
