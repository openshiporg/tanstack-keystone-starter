# Next ↔ TanStack Parity Audit (Latest)

Scope:
- Reference: `/Users/junaid/code/next-keystone-starter`
- Target: `/Users/junaid/code/tanstack-keystone-starter`
- Inputs cross-checked against official/internal ledgers:
  - `reports/deep-dashboard-next-parity-ledger.md`
  - `reports/deep-backend-keystone-parity-ledger.md`
  - `reports/dashboard-next-parity-gap-audit.md`

This list is prioritized for **concrete, fixable** gaps across dashboard behavior/UI/auth/routes/backend runtime.

---

## P0 — Critical parity blockers (fix first)

## 1) Signup flow is still non-parity / partially TODO
**Impact:** Auth onboarding is behaviorally divergent from Next; parity claim blocked.

**Target files:**
- `src/routes/dashboard/signup.tsx`
- (adjacent shared auth behavior) `src/routes/dashboard/signin.tsx`, `src/routes/dashboard/reset.tsx`

**Observed gap:**
- Signup route contains explicit non-parity fallback/TODO behavior instead of matching Next semantics.

**Reference files:**
- `next-keystone-starter/features/dashboard/screens/SignUpPage/SignUpForm.tsx`
- `next-keystone-starter/app/dashboard/signup/page.tsx`

**Suggested fix:**
- Rebuild signup around the same interaction contract as Next (pending state, structured field/form errors, preserved form values, policy gating).
- Keep TanStack router/server-function style, but mirror Next UX states and validation messaging.

---

## 2) List bulk actions + destructive flow parity missing
**Impact:** Core admin workflows diverge; accessibility and UX regression.

**Target files:**
- `src/components/dashboard/keystone-list-table.tsx`
- `src/components/dashboard/pagination.tsx`

**Observed gap:**
- Uses `window.confirm` and separate inline bulk strip.
- Missing Next-style selection mode integrated into pagination footer with cancel/delete flow and richer page-size controls.

**Reference files:**
- `next-keystone-starter/features/dashboard/components/Pagination.tsx`
- `next-keystone-starter/features/dashboard/components/ListTable.tsx`

**Suggested fix:**
- Port selection-aware pagination contract (`selectedItems`, reset selection, delete callback, loading state).
- Replace native confirm with accessible alert-dialog confirmation.

---

## 3) Filter/sort/display controls are simplified and query-contract risk exists
**Impact:** High-frequency list interactions differ; sort/filter semantics can drift.

**Target files:**
- `src/components/dashboard/filter-bar.tsx`
- `src/routes/dashboard/$listKey.tsx`

**Observed gap:**
- Inline toggles replace composable filter/sort/display components.
- Raw filter value rendering and simplified operator handling.
- Potential encoding drift (`field:asc|desc` vs Next patterns including `field`/`-field`).

**Reference files:**
- `next-keystone-starter/features/dashboard/components/FilterBar.tsx`
- `next-keystone-starter/features/dashboard/components/FilterAdd.tsx`
- `next-keystone-starter/features/dashboard/components/FilterList.tsx`
- `next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx`

**Suggested fix:**
- Recreate Next decomposition (`FilterAdd`, `FilterList`, `SortSelection`, `FieldSelection`) with Base UI primitives.
- Align URL/query parsing/building with reference semantics exactly.

---

## P1 — High-value parity gaps

## 4) Dashboard shell/provider parity incomplete (right sidebar/chat state missing)
**Impact:** Structural layout parity incomplete; key dashboard UX absent.

**Target files:**
- `src/components/dashboard/dashboard-shell.tsx`
- `src/routes/dashboard.tsx`

**Observed gap:**
- Static inert right sidebar placeholder and non-functional toggle.
- Missing equivalent provider composition seen in Next dashboard layout.
- No equivalent error boundary wrapping pattern.

**Reference files:**
- `next-keystone-starter/features/dashboard/components/DashboardLayout.tsx`
- `next-keystone-starter/app/dashboard/(admin)/layout.tsx`

**Suggested fix:**
- Add `DashboardProviders` wrapper mirroring provider responsibilities (admin meta/dashboard context/ai/sidebar states).
- Implement real right sidebar toggle behavior (desktop/mobile state + icon/state transitions).
- Add route/shell-level error boundary parity.

---

## 5) Item/Create pages use generic field editor instead of controller/view parity
**Impact:** Editing semantics diverge for complex fields; validation/change tracking weaker.

**Target files:**
- `src/routes/dashboard/$listKey.create.tsx`
- `src/routes/dashboard/$listKey.$id.tsx`
- `src/components/dashboard/field-value-editor.tsx`

**Observed gap:**
- Generic kind-based editor/parsing instead of controller-driven field contracts.
- Simplified reset/delete confirmation behavior.

**Reference files:**
- `next-keystone-starter/features/dashboard/screens/CreatePage/*`
- `next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx`

**Suggested fix:**
- Move create/item forms to controller-backed deserialize/serialize/validate pipeline.
- Port invalid-field/has-changes semantics and dialog-based destructive actions.

---

## 6) Relationship editor is reduced vs Next behavior
**Impact:** Relationship UX is notably behind (selection, inline create/edit, richer labeling).

**Target file:**
- `src/components/dashboard/relationship-field-editor.tsx`

**Reference files:**
- `next-keystone-starter/features/dashboard/views/relationship/client/*`

**Suggested fix:**
- Port richer relationship picker stack with inline create/edit flows and improved option rendering semantics.

---

## 7) Auth route parity gaps beyond signup (reset/init/no-access/signin semantics)
**Impact:** Auth UX/policy consistency incomplete.

**Target files:**
- `src/routes/dashboard/signin.tsx`
- `src/routes/dashboard/reset.tsx`
- `src/routes/dashboard/init.tsx`
- `src/routes/dashboard/no-access.tsx`

**Observed gaps:**
- Signin/reset interaction model diverges from Next action/form-state semantics.
- Init uses insecure/non-parity prefilled defaults.
- No-access CTA/copy set is simplified.

**Reference files:**
- `next-keystone-starter/features/dashboard/screens/SignInPage/*`
- `next-keystone-starter/features/dashboard/screens/ResetPasswordPage/*`
- `next-keystone-starter/features/dashboard/screens/NoAccessPage/index.tsx`

**Suggested fix:**
- Align pending/error/success/form persistence behaviors to Next patterns.
- Remove prefilled init credentials.
- Match no-access actions/copy parity.

---

## 8) Table cell rendering parity incomplete (view registry not used)
**Impact:** Custom/field-specific display semantics and future extensibility diverge.

**Target file:**
- `src/components/dashboard/keystone-list-table.tsx`

**Observed gap:**
- Hardcoded cell-kind switch instead of field view registry-based rendering.

**Reference file:**
- `next-keystone-starter/features/dashboard/components/ListTable.tsx`

**Suggested fix:**
- Introduce registry-backed cell rendering (`getFieldViews(...).Cell` parity pattern) with fallback only for unsupported kinds.

---

## P1 — Backend runtime parity issues affecting correctness/compatibility

## 9) Keystone config surface + unsupported option handling incomplete
**Impact:** Model portability claims are weakened; hidden no-op config risk.

**Target files:**
- `src/features/cms/config.ts`
- `src/features/cms/fields/index.ts`
- `src/features/cms/types.ts`

**Observed gap:**
- Large Keystone config/options surface not fully represented or executed; unsupported keys often silently accepted as metadata.

**Reference file:**
- `keystone/packages/core/src/types/config/index.ts`

**Suggested fix:**
- Expand config typing parity where feasible.
- Add normalization-time explicit rejection/warnings for unsupported options.

---

## 10) Error envelope parity (access/hooks/mutations) still divergent
**Impact:** API behavior mismatches for clients/tests relying on Keystone-style error semantics.

**Target files:**
- `src/features/cms/runtime.ts`
- `src/features/cms/access.ts`
- `src/features/cms/hooks.ts`
- `src/features/cms/where-unique.ts`
- `src/features/cms/auth/graphql.ts`

**Observed gap:**
- Structured `extensions.code` and grouped error semantics are not fully Keystone-equivalent.

**Suggested fix:**
- Normalize mutation/access/validation error construction to Keystone-like envelopes.
- Add conformance tests per error class.

---

## 11) Prisma generation + relationship ownership semantics are still simplified
**Impact:** Complex schema parity and nested mutation edge cases can diverge.

**Target files:**
- `src/features/cms/prisma-schema.ts`
- `src/features/cms/adapters/prisma.ts`

**Observed gap:**
- Nuanced ownership/default/db mapping/provider-specific generation behavior differs from Keystone.

**Suggested fix:**
- Incrementally align generator/mapper logic with Keystone DB-layer semantics.
- Add targeted parity fixtures for bidirectional relations and nested writes.

---

## 12) Auth session materialization/reset-token semantics remain partially non-parity
**Impact:** Session shape + reset behavior can differ unexpectedly across configs.

**Target files:**
- `src/features/cms/runtime.ts`
- `src/features/cms/auth/graphql.ts`
- `cms.config.ts`

**Observed gap:**
- SessionData and reset token behavior have known parity caveats in ledger; also dev auth fallback is non-Keystone behavior.

**Suggested fix:**
- Ensure `auth.sessionData` drives actual session materialization consistently.
- Isolate/document dev fallback as disabled-by-default non-parity shim.

---

## P2 — Polish and consistency

## 13) Home cards / singleton routing assumptions / layout rhythm
**Target files:**
- `src/routes/dashboard/index.tsx`
- `src/components/dashboard/page-container.tsx` (if present)
- breadcrumb/header components used by list/create/item pages

**Observed gap:**
- Visual rhythm and card details are simplified.
- Singleton link assumptions using hardcoded `id: '1'` are brittle.

**Suggested fix:**
- Resolve singleton targets via data, not hardcoded IDs.
- Normalize spacing/typography/breadcrumb rhythm to Next.

---

## 14) Sidebar active/collapsed/menu interaction polish
**Target file:**
- `src/components/dashboard/dashboard-sidebar.tsx`

**Observed gap:**
- Core nav works, but active/collapsed/group/menu nuance is less complete.

**Suggested fix:**
- Port class/state behavior parity for compact mode, grouped models, and profile menu actions.

---

## Recommended execution order
1. Auth parity block (signup/reset/init/no-access/signin behavior)
2. List interaction block (filter/sort/display + bulk/pagination + table cell renderer)
3. Item/Create/relationship controller parity
4. Dashboard shell/provider/right-sidebar parity
5. Backend error/config/prisma compatibility hardening
6. Visual polish (home/sidebar/layout rhythm)

---

## Notes
- This audit intentionally excludes framework-only acceptable deltas (Next router/actions vs TanStack router/server-functions; shadcn/Radix internals vs Base UI internals).
- Focus remains on user-visible behavior and runtime semantic parity.