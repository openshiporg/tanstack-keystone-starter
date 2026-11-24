# Deep Dashboard Next Parity Ledger (TanStack target)

Scope audited:
- **Target:** `/Users/junaid/code/tanstack-keystone-starter`
- **Reference app:** `/Users/junaid/code/next-keystone-starter/features/dashboard` + `/Users/junaid/code/next-keystone-starter/app/dashboard`
- **Reference upstream semantics:** `/Users/junaid/code/keystone/packages/core/src/admin-ui`

Allowed differences only:
1) TanStack Router APIs instead of Next router/actions
2) Base UI internals instead of Radix/shadcn internals

Everything else below is parity-checked for **visual behavior + feature semantics**.

---

## Legend
- [x] Parity achieved (or acceptable framework-only delta)
- [~] Partial parity / notable drift
- [ ] Missing / incorrect parity

---

## 1) Shell / Providers / Global layout

### 1.1 Provider stack parity
- [~] Target has `SidebarProvider` + query usage, but does **not** match full composed provider stack used by Next shell.
  - Target: `src/components/dashboard/dashboard-shell.tsx`
  - Reference: `features/dashboard/components/DashboardLayout.tsx`
  - Missing layers vs reference: `ErrorBoundary`, `DashboardProvider`, `AdminMetaProvider`, `AiConfigProvider`, chat-state context.

**Fix instructions**
- Create a TanStack dashboard providers wrapper (e.g., `src/components/dashboard/dashboard-providers.tsx`) that mirrors reference provider composition order.
- Keep TanStack routing/query mechanics, but preserve semantic responsibilities (admin meta context, dashboard base-path context, chat/right-sidebar state).

### 1.2 Left shell + inset
- [x] Left sidebar + main inset structural pattern present.
  - Target: `src/components/dashboard/dashboard-shell.tsx` (`DashboardSidebar`, `SidebarInset`)

### 1.3 Right AI sidebar integration
- [ ] Missing interactive parity.
  - Target currently renders inert aside + static button title.
  - Target: `src/components/dashboard/dashboard-shell.tsx`
  - Reference toggle behavior/state: `features/dashboard/components/DashboardLayout.tsx` + `components/dual-sidebar/*`

**Fix instructions**
- Replace static `<aside data-open="false" aria-hidden="true" />` with real right sidebar component.
- Implement toggle state tied to sidebar provider (`open`, `isMobile`, position shift, icon swap Sparkles/Chevron equivalent).

### 1.4 Error boundary coverage
- [ ] Missing parity at shell boundary.
  - Reference wraps dashboard in `ErrorBoundary`; target shell does not.

**Fix instructions**
- Add route-level or shell-level error boundary equivalent around dashboard frame.

---

## 2) Left sidebar parity

- [~] Core nav exists and is functional, but deeper behavior/style parity likely incomplete.
  - Target: `src/components/dashboard/dashboard-sidebar.tsx`
  - Reference: `features/dashboard/components/Sidebar.tsx`

Likely drift areas:
- grouped/collapsible model interactions in compact/icon mode
- active-state class nuance
- full user-profile action menu parity

**Fix instructions**
- Diff exact class names/states against reference sidebar implementation and port missing interactions.
- Ensure user profile dropdown actions and semantics match `UserProfileClient` behavior.

---

## 3) Auth pages parity (signin/signup/reset/init/no-access)

### 3.1 Sign in
- [~] Functional but architecture/behavior differs.
  - Target: `src/routes/dashboard/signin.tsx`
  - Reference route/screen: `app/dashboard/signin/page.tsx`, `features/dashboard/screens/SignInPage/*`

Notes:
- Direct GraphQL call in component instead of reference action/form-state pattern.
- Visual semantics mostly close.

### 3.2 Sign up
- [ ] Not parity-complete.
  - Target contains explicit TODO for parity.
  - Target: `src/routes/dashboard/signup.tsx`

### 3.3 Reset
- [~] Works but flow/presentation differs from reference semantics.
  - Target: `src/routes/dashboard/reset.tsx`

### 3.4 Init
- [~] Core flow exists; defaults are non-parity/insecure UX.
  - Target prefilled credentials in `src/routes/dashboard/init.tsx`.

### 3.5 No-access page
- [~] Route exists but CTA/copy behavior likely simplified versus reference.

### 3.6 Accessibility (auth)
- [x] Password visibility toggles now include `aria-label` in signin/signup.
  - `src/routes/dashboard/signin.tsx`
  - `src/routes/dashboard/signup.tsx`

**Fix instructions**
- Rebuild signup/reset/init/no-access to match reference copy, policy gating, error states, and CTA set.
- Remove prefilled init defaults.
- Normalize loading/error state handling to reference interaction pattern.

---

## 4) Home/dashboard cards parity

- [~] Home cards present, but visual/detail parity is simplified.
  - Target: `src/routes/dashboard/index.tsx`
  - Reference: `features/dashboard/screens/HomePage/*`

Potential semantic risk previously observed: singleton assumptions based on id `1` patterns.

**Fix instructions**
- Match spacing/typography/metadata display and singleton navigation semantics exactly to reference behavior.

---

## 5) List route parity (search/filter/sort/display)

### 5.1 List route wiring
- [~] Core list route exists and loads data.
  - Target: `src/routes/dashboard/$listKey.tsx`
  - Reference: `features/dashboard/screens/ListPage/index.tsx` + `ListPageClient.tsx`

### 5.2 Filter builder
- [ ] Major parity gap.
  - Target uses simplified inline UI and hardcoded operators.
  - Target: `src/components/dashboard/filter-bar.tsx`
  - Reference: `features/dashboard/components/FilterBar.tsx`, `FilterAdd.tsx`, `FilterList.tsx`

Missing semantics:
- controller-driven filter types
- controller-provided filter editor + label rendering
- pill editing/removal interactions aligned to reference

### 5.3 Sort controls
- [~] Present but simplified and potentially encoding-divergent.
  - Target uses `field:asc|desc` pattern in multiple places.
  - Reference table sorting commonly uses `field` / `-field` semantics.

### 5.4 Display field selection
- [~] Present, but simplified native checkbox composition vs reference selection popover UX.

**Fix instructions**
- Port decomposition pattern:
  - `FilterAdd`, `FilterList`, `SortSelection`, `FieldSelection`
- Reuse enhanced/controller metadata pipeline (reference uses `enhanceFields(...)`)
- Align query-param contract exactly with reference parsing/build logic.

---

## 6) Table cells/rendering parity

### 6.1 Table structure + selection
- [~] Base table and row selection exist.
  - Target: `src/components/dashboard/keystone-list-table.tsx`

### 6.2 Field-cell rendering contract
- [ ] Not parity-complete.
  - Target uses hardcoded kind branching in `CellContent`.
  - Reference delegates to field view registry `getFieldViews(...).Cell`.

### 6.3 Sort header behaviors/classes
- [~] Similar but not exact in state/class details.

### 6.4 Row interaction/a11y
- [~] Click navigation exists, but keyboard row semantics are not equivalently explicit.

**Fix instructions**
- Introduce field-view registry based cell rendering adapter in target list table.
- Keep fallback rendering only as defensive fallback.
- Ensure keyboard-operable row/cell navigation patterns align with reference intent.

---

## 7) Pagination + selection + bulk actions parity

- [ ] Significant parity gap.
  - Target pagination: `src/components/dashboard/pagination.tsx`
  - Target list bulk action area: `src/components/dashboard/keystone-list-table.tsx`
  - Reference: `features/dashboard/components/Pagination.tsx`

Missing from target:
- selection-mode floating pill inside pagination component
- cancel selection action integrated in pagination mode
- alert-dialog destructive confirmation flow
- richer page-size menu (preset + +/- + direct numeric adjustment)

Current target uses `window.confirm` and separate inline bulk bar.

**Fix instructions**
- Port reference pagination behavior 1:1 with Base UI primitives.
- Move selection-mode UI into pagination component contract (`selectedItems`, `onResetSelection`, `onDelete`, loading state).

---

## 8) Create page parity

- [~] Create route exists and generally works, but controller parity is incomplete.
  - Target: `src/routes/dashboard/$listKey.create.tsx`
  - Related editor: `src/components/dashboard/field-value-editor.tsx`
  - Reference: `features/dashboard/screens/CreatePage/*`

Gap:
- target uses generic per-kind parsing/editor, not full controller/view parity for all field types.

**Fix instructions**
- Move create form to controller-driven field components/validation semantics (same as reference field pipeline).

---

## 9) Item page parity

- [~] Implemented in target now (no longer placeholder), but still semantically behind reference.
  - Target: `src/routes/dashboard/$listKey.$id.tsx`
  - Reference: `features/dashboard/screens/ItemPage/ItemPageClient.tsx`

Open gaps:
- uses generic field editor pipeline, not full enhanced-controller stack
- destructive and reset confirmations still simpler (`window.confirm` for delete)
- no full parity with invalid-field/force-validation patterns from reference utilities
- sidebar/main layout behavior is simplified

**Fix instructions**
- Rework item route around enhanced field controllers (`enhanceFields`, invalid fields, changed-field serialization).
- Replace delete/reset native confirm flow with alert-dialog pattern.

---

## 10) Relationship field parity

- [ ] Not parity-complete.
  - Target: `src/components/dashboard/relationship-field-editor.tsx`
  - Reference related implementation: `features/dashboard/views/relationship/client/*`

Missing semantics:
- richer relationship picker UX
- inline create/edit workflows and advanced option rendering
- deeper relationship controller semantics

**Fix instructions**
- Port relationship client component stack behavior with Base UI equivalents; preserve create/view linked workflows and label semantics.

---

## 11) Field controller parity (every field controller)

Target coverage currently via generic editor in `src/components/dashboard/field-value-editor.tsx`.

### 11.1 Present (generic support)
- [x] text
- [x] password (basic input)
- [x] json (textarea + JSON parse)
- [x] document (treated as raw JSON text)
- [x] image/file (treated as raw JSON text)
- [x] select / multiselect (basic)
- [x] checkbox
- [x] integer / float / decimal / bigInt / timestamp (basic scalar handling)
- [x] relationship (basic custom picker)

### 11.2 True controller/view parity with reference
- [ ] text controller parity
- [ ] password controller parity
- [ ] json controller parity
- [ ] document controller parity (rich editor semantics missing)
- [ ] image controller parity (upload semantics missing)
- [ ] file controller parity (upload semantics missing)
- [ ] select/multiselect controller parity nuances
- [ ] checkbox controller parity nuances
- [ ] number/date scalar controller parity nuances
- [ ] relationship controller parity

**Fix instructions**
- Adopt controller-driven deserialize/serialize/validate/render contract for each field type.
- Use registry-driven field views for both list cells and item/create editing surfaces.

---

## 12) Accessibility parity audit

- [~] Mixed.

Confirmed good:
- password toggle controls in signin/signup are labeled.

Still drifting:
- destructive confirmation uses native `window.confirm` (focus management + modality parity missing)
- filter/sort/display native controls are less semantically rich than reference popovers/dialog controls
- row-click behavior remains pointer-centric

**Fix instructions**
- Replace native confirms with accessible dialogs.
- Align control semantics/labels/focus handling with reference interactions.
- Add keyboard-first affordances for row navigation/selection where needed.

---

## 13) Exact classes/layout deviations (high-signal deltas)

1. **Filter row spacing**
   - Target uses `mb-3` and inline toggled panels (`src/components/dashboard/filter-bar.tsx`)
   - Reference uses `mb-6` + detached composed controls.

2. **Right sidebar shell classes**
   - Target has hidden inert aside: `className="hidden border-l ... data-[open=true]:block md:w-72"`
   - No parity with reference right sidebar responsive behavior and floating button offset dynamics.

3. **Pagination composition classes**
   - Target lacks selection-mode variant container and dropdown menu internals from reference.
   - Target page size is a raw `<select>` with limited options.

4. **Table + bulk action composition**
   - Target shows separate bulk strip (`mx-4 mb-3 ...`) above table;
   - Reference integrates selection mode in pagination pill at bottom.

5. **Item page layout**
   - Target main wrapper and group layout differ from reference sticky sidebar/edit panel rhythm.

---

## 14) File-by-file fix map (target)

1. `src/components/dashboard/dashboard-shell.tsx`
   - Add provider parity wrappers, right sidebar component, toggle behavior, and error boundary integration.

2. `src/components/dashboard/filter-bar.tsx`
   - Replace simplified filter/sort/display implementation with controller-driven composed components.

3. `src/components/dashboard/keystone-list-table.tsx`
   - Move destructive confirmations to dialog pattern; switch cell rendering to view registry-based model.

4. `src/components/dashboard/pagination.tsx`
   - Add selection mode + cancel/delete flow + richer page-size controls.

5. `src/components/dashboard/field-value-editor.tsx`
   - Transition from generic inputs to controller/view-backed field editors.

6. `src/components/dashboard/relationship-field-editor.tsx`
   - Port richer relationship UX semantics.

7. `src/routes/dashboard/$listKey.$id.tsx`
   - Align item-page state/validation/change tracking to reference utility semantics.

8. `src/routes/dashboard/$listKey.create.tsx`
   - Align create workflow with field controller pipeline.

9. `src/routes/dashboard/signup.tsx`, `reset.tsx`, `init.tsx`, `no-access.tsx`
   - Complete auth policy and UX parity.

---

## 15) Final parity verdict

- **Overall dashboard/UI parity status: PARTIAL, not full parity.**
- Core routes/components exist, but major semantic drifts remain in:
  1) provider/shell + right sidebar,
  2) filter/controller system,
  3) pagination/selection/bulk delete behavior,
  4) field-controller/view parity (especially relationship/document/file/image semantics),
  5) auth signup/reset/init/no-access policy/UX parity.

Until these are addressed, parity with Next/official admin semantics is **incomplete**.