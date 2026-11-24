# Dashboard Next→TanStack Parity Gap Audit

Scope compared:
- **Reference (Next):** `app/dashboard/**` + `features/dashboard/**`
- **Target (TanStack):** `src/routes/dashboard/**` + `src/components/dashboard/**`

Allowed architectural deltas were respected conceptually (router/actions + UI lib swaps), but there are still major behavior/UI parity gaps.

---

## 1) Route/auth shell parity

### ✅ Present
- Core routes exist in target: index, list, create, item, signin/signup/reset/init/no-access.
- Server-side auth gating exists via `beforeLoad` in `src/routes/dashboard.tsx`.

### ❌ Gaps
1. **No right sidebar/chat-mode interactivity parity**
   - Next has full right-sidebar provider wiring + floating button that toggles it (`features/dashboard/components/DashboardLayout.tsx`).
   - TanStack shell has static placeholder `aside` and inert floating button (`src/components/dashboard/dashboard-shell.tsx`).
   - Missing: open/close state, mobile/desktop behavior, icon switch, provider-level shared state.

2. **Standalone auth route set differs in behavior richness**
   - Next admin layout does server data fetch and injects to provider tree (`app/dashboard/(admin)/layout.tsx` + `features/dashboard/components/DashboardLayout.tsx`).
   - TanStack fetches overview in shell via query; no equivalent provider stack for dashboard feature state.

3. **No explicit error boundary parity around dashboard shell**
   - Next wraps with `ErrorBoundary` in dashboard layout.
   - TanStack shell path lacks equivalent route-level boundary.

Concrete fix:
- Implement a TanStack `DashboardProviders` wrapper mirroring Next’s composed providers (query/admin meta/dashboard context/ai config/sidebar modes).
- Replace static right `aside` with an actual Base-UI-compatible right sidebar + toggle logic.

---

## 2) Sidebar / navigation parity

### ❌ Gaps
1. **Missing collapsible grouped “Models” behavior parity details**
   - TanStack sidebar approximates model grouping, but Next sidebar ecosystem includes additional dual-sidebar/nav composition and richer sections (`features/dashboard/components/dual-sidebar/**`).

2. **Active-state visual parity incomplete**
   - Next patterns include richer active/hover visual states; TanStack active styles are simplified (especially dropdown collapsed mode markers).

3. **User profile/menu parity likely reduced**
   - Target shows `UserProfile` slot but lacks evidence of full parity actions/options from Next `UserProfileClient` flow.

Concrete fix:
- Port missing user menu actions/states and detailed active/hover classes from Next sidebar components into target Base UI primitives.

---

## 3) Home/dashboard cards parity

### ❌ Gaps
1. **Card styling mismatch**
   - Target index cards are simplified and differ in spacing/titles hierarchy.
   - Next home (`features/dashboard/screens/HomePage`) uses stronger visual grouping conventions.

2. **Singleton behavior likely incorrect assumption**
   - Target links singleton cards to id `'1'` (`src/routes/dashboard/index.tsx`), which is not safe parity behavior unless guaranteed.

Concrete fix:
- Query actual singleton item id (or route by dedicated singleton fetch) rather than hardcoding `1`.
- Match card container spacing/typography/empty-state iconography to Next.

---

## 4) List page controls (search/filter/sort/display) parity

### ❌ Major gaps
1. **Filter UX regressed (popover/dialog → inline toggles)**
   - Next uses composable controls (`FilterAdd`, `FilterList`, `SortSelection`, `FieldSelection`) with richer interaction.
   - Target uses local `showFilter/showSort/showDisplay` blocks in one component (`src/components/dashboard/filter-bar.tsx`).
   - Missing: structured filter builder UX parity, chip/label formatting, operator/value flows.

2. **Filter value rendering is raw JSON stringified**
   - Active filters display raw `String(value)` from query (`filter-bar.tsx`), unlike more polished Next display behavior.

3. **Sort semantics divergence risk**
   - Target uses `field:asc|desc`; Next list table toggles `field`/`-field` in at least one path and uses dedicated sort builder utilities. Parity depends on backend parser compatibility; this is a risk hotspot.

4. **Display fields UX simplified**
   - Target uses native checkboxes; Next uses dedicated field-selection component with better affordances.

5. **Search placeholder source differs**
   - Next computes searchable labels via enhanced field/controller metadata; target uses `isFilterable` only.

Concrete fix:
- Recreate Next control decomposition in TanStack components (same actions, same query-param contract, same pill/chip rendering and reset patterns).
- Normalize filter/sort query encoding to exactly match reference utilities.

---

## 5) Table/list interaction parity

### ❌ Major gaps
1. **Bulk delete flow downgraded**
   - Next: destructive confirmation dialog + selected-item action pill UI (`features/dashboard/components/Pagination.tsx`).
   - Target: `window.confirm` and inline bar (`src/components/dashboard/keystone-list-table.tsx`).

2. **Selection mode footer parity missing**
   - Next pagination morphs into selection action state (cancel/delete, counts).
   - Target pagination is static and unaware of selected rows.

3. **Cell rendering capability reduced**
   - Next table delegates to field view registry (`getFieldViews(...).Cell`) for type-aware rendering.
   - Target has hardcoded kind-switch; misses custom per-view rendering parity.

4. **Row click + keyboard/a11y parity incomplete**
   - Target row click is mouse-focused with `tr` onClick; no keyboard row activation semantics (`Enter/Space` on row-like element) or explicit row role/tabindex handling.

5. **Visual class parity mismatch**
   - Next includes more nuanced classes for badges, hover, destructive errors, and sticky header balance.

Concrete fix:
- Port selection-aware pagination/action bar behavior into target pagination.
- Replace `window.confirm` with alert-dialog equivalent.
- Introduce field-view cell renderer abstraction in target for true controller/view parity.

---

## 6) Pagination parity

### ❌ Major gaps
1. **Missing page-size custom input and +/- controls** (Next has 5/10/25/50/100 + custom numeric adjustment).
2. **Missing selection-aware mode (cancel/delete)**.
3. **Reduced stats/wording variations and layout details**.

Concrete fix:
- Port Next pagination component behavior 1:1 using target UI primitives.

---

## 7) Create page parity

### ❌ Major gaps
1. **Field-controller parity incomplete**
   - Target `FieldValueEditor` is generic string/JSON editor; Next uses field controllers/views and richer per-field components.

2. **No Keystone-style changed/invalid field hooks parity**
   - Next has utilities like `useInvalidFields`, `useHasChanges`, changed-data derivations.

3. **Validation depth limited**
   - Target required validation is minimal and kind-based; Next ecosystem has controller-level validation semantics.

Concrete fix:
- Add controller-driven create/edit adapters per field kind instead of generic parse pipeline.

---

## 8) Item page parity

### ❌ Major gaps
1. **Save/reset state model simplified** vs Next richer hooks and error handling.
2. **Delete uses `window.confirm` not modal parity**.
3. **Field display/edit parity reduced for complex kinds (document/image/file/password behaviors).**
4. **Message surface differs (single message string vs richer alert treatment).**

Concrete fix:
- Port Next item page client patterns (field hooks, modal confirmation, richer status banners).

---

## 9) Relationship picker parity

### ❌ Major gaps
1. **Relationship editor reduced to ID chips + flat list** (`src/components/dashboard/relationship-field-editor.tsx`).
2. **Missing inline create/edit drawer workflows** present in Next relationship components (`features/dashboard/views/relationship/client/components/*`).
3. **Missing custom select/multiselect parity and richer labels/previews.**

Concrete fix:
- Port relationship client component stack (or equivalent Base UI implementation) including inline create/edit and rich option rendering.

---

## 10) Auth pages parity (signup/signin/reset/init/no-access)

### ❌ Critical gaps
1. **Signup flow is explicitly TODO/non-parity**
   - Target comments indicate fallback direct `createUser` mutation and missing policy gate parity (`src/routes/dashboard/signup.tsx`).

2. **Signin uses direct client GraphQL call** vs Next action-based form state patterns; error/field persistence behavior differs.

3. **Reset flow UX and token-handling differs**
   - Target exposes token input field in redeem mode; Next reset flow is action-driven and styled differently.

4. **No-access behavior mismatch**
   - Next no-access offers back + home actions and specific lock-card messaging.
   - Target only offers “Sign in with another account”.

5. **Init defaults are insecure/non-parity for UX**
   - Target pre-fills `admin@example.com` / `password` in form.

Concrete fix:
- Implement auth routes via TanStack server functions mirroring Next action semantics (pending state, returned form values, structured error badges).
- Align no-access CTA set and copy with reference behavior.
- Remove insecure init defaults.

---

## 11) Breadcrumbs/layout parity

### ❌ Gaps
1. **Breadcrumb action/header spacing and typography differ** across list/create/item pages.
2. **Page container top spacing and responsive rhythm differ** (e.g., `mb-3` vs `mb-6` control rows).

Concrete fix:
- Normalize `PageContainer` + `PageBreadcrumbs` spacing tokens and classnames to match reference rhythm.

---

## 12) Keyboard + a11y parity

### ❌ Gaps
1. **Row interactions are pointer-centric** (clickable `tr` without keyboard-operable equivalent).
2. **Bulk destructive flows use `window.confirm`** (not ideal focus management/a11y).
3. **Some icon-only controls lack robust labels/titles consistency** compared to reference patterns.

Concrete fix:
- Ensure keyboard access for row navigation and selection controls.
- Replace native confirms with accessible dialogs.
- Audit all icon-only buttons for `aria-label` and focus-visible parity.

---

## Priority fix order (recommended)

1. **Auth correctness parity**: signup/signin/reset/init/no-access behavior.
2. **List data UX parity**: filter/sort/display controls + table cell rendering + bulk actions.
3. **Relationship editor parity**: inline create/edit + richer picker.
4. **Shell/sidebar parity**: right sidebar/chat toggle state + provider stack.
5. **Visual polish parity**: class-level spacing/typography/breadcrumb rhythm + keyboard/a11y cleanup.

---

## File hotspots to change in target

- `src/routes/dashboard.tsx`
- `src/components/dashboard/dashboard-shell.tsx`
- `src/components/dashboard/dashboard-sidebar.tsx`
- `src/components/dashboard/filter-bar.tsx`
- `src/components/dashboard/keystone-list-table.tsx`
- `src/components/dashboard/pagination.tsx`
- `src/components/dashboard/field-value-editor.tsx`
- `src/components/dashboard/relationship-field-editor.tsx`
- `src/routes/dashboard/index.tsx`
- `src/routes/dashboard/$listKey.tsx`
- `src/routes/dashboard/$listKey.create.tsx`
- `src/routes/dashboard/$listKey.$id.tsx`
- `src/routes/dashboard/signin.tsx`
- `src/routes/dashboard/signup.tsx`
- `src/routes/dashboard/reset.tsx`
- `src/routes/dashboard/init.tsx`
- `src/routes/dashboard/no-access.tsx`

---

## Evidence references (key files reviewed)

- Next:
  - `app/dashboard/(admin)/layout.tsx`
  - `features/dashboard/components/DashboardLayout.tsx`
  - `features/dashboard/screens/ListPage/ListPageClient.tsx`
  - `features/dashboard/components/FilterBar.tsx`
  - `features/dashboard/components/ListTable.tsx`
  - `features/dashboard/components/Pagination.tsx`
  - `features/dashboard/screens/SignInPage/SignInForm.tsx`
  - `features/dashboard/screens/SignUpPage/SignUpForm.tsx`
  - `features/dashboard/screens/NoAccessPage/index.tsx`

- TanStack:
  - `src/routes/dashboard.tsx`
  - `src/components/dashboard/dashboard-shell.tsx`
  - `src/components/dashboard/dashboard-sidebar.tsx`
  - `src/routes/dashboard/index.tsx`
  - `src/routes/dashboard/$listKey.tsx`
  - `src/components/dashboard/filter-bar.tsx`
  - `src/components/dashboard/keystone-list-table.tsx`
  - `src/components/dashboard/pagination.tsx`
  - `src/routes/dashboard/$listKey.create.tsx`
  - `src/routes/dashboard/$listKey.$id.tsx`
  - `src/components/dashboard/field-value-editor.tsx`
  - `src/components/dashboard/relationship-field-editor.tsx`
  - `src/routes/dashboard/signin.tsx`
  - `src/routes/dashboard/signup.tsx`
  - `src/routes/dashboard/reset.tsx`
  - `src/routes/dashboard/init.tsx`
  - `src/routes/dashboard/no-access.tsx`
