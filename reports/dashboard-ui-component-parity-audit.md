# Dashboard UI/Component Parity Audit (Frontend Only)

Compared:
- **Reference (Next):** `/Users/junaid/code/next-keystone-starter/features/dashboard` + `/Users/junaid/code/next-keystone-starter/app/dashboard`
- **Target (TanStack):** `/Users/junaid/code/tanstack-keystone-starter/src/components/dashboard` + `/Users/junaid/code/tanstack-keystone-starter/src/routes/dashboard*`

---

## Executive Summary

Parity is **partial**. Shell/sidebar/list/create/auth pages exist, but there are major gaps:
- **ItemPage parity is missing entirely** (route is placeholder)
- **Filter system parity regressed** from controller-driven (`FilterAdd`/`FilterList`) to simplified primitive selects
- **Pagination composition regressed** (missing bulk-selection mode + richer page-size controls)
- **Right AI sidebar composition is stubbed** (non-functional)
- Several **a11y and Base UI composition issues** remain in filters/auth/table interactions

---

## Priority 0 (Blocking parity)

### 1) ItemPage is not implemented
- **Target:** `src/routes/dashboard/$listKey.$id.tsx:1-9`
- Current output is only `Hello "/dashboard/$listKey/$id"!`.
- **Reference implementation:** full edit/save/reset/delete/error flow in `features/dashboard/screens/ItemPage/ItemPageClient.tsx`.
- Missing behaviors:
  - field controller deserialization and editing UI
  - invalid-field validation
  - change tracking / reset / save mutation
  - delete dialog and action
  - breadcrumbs/actions parity
  - sidebar/main field grouping layout
  - item-not-found UX

**Impact:** core admin workflow is missing.

---

### 2) Field-controller parity gap for filters (FilterAdd/FilterList)
- **Reference:**
  - `features/dashboard/components/FilterAdd.tsx`
  - `features/dashboard/components/FilterList.tsx`
- Uses `enhanceFields(...)` controllers + controller-provided:
  - filter types
  - filter editor component (`Filter`)
  - filter label rendering (`Label`)
- **Target:** `src/components/dashboard/filter-bar.tsx:10-209`
  - hardcoded `FilterType` enum
  - native `<select>` and `<input>`
  - no controller `Filter` UI, no controller `Label`
  - no editable pill popover behavior

**Impact:** feature mismatch across field kinds and custom controllers; reduced capability and consistency.

---

## Priority 1 (Major UI/interaction parity issues)

### 3) List table bulk-actions/pagination UX parity regression
- **Target table:** `src/components/dashboard/keystone-list-table.tsx:14-157`
- **Target pagination:** `src/components/dashboard/pagination.tsx:8-113`
- **Reference pagination:** `features/dashboard/components/Pagination.tsx`

Differences:
- reference has selection-mode floating pill with cancel/delete confirmation and shared interaction model
- target shows separate inline bulk bar and simpler pagination
- reference has richer page-size dropdown + +/- controls + scrollable menu; target has plain `<select>` (10/25/50/100)
- target dropped props/flows (`selectedItems`, `onResetSelection`, `onDelete`) from pagination composition

**Impact:** noticeably different behavior and UI from reference.

---

### 4) Dashboard shell right sidebar/chat composition is stubbed
- **Target:** `src/components/dashboard/dashboard-shell.tsx:29-37`
  - static `<aside ... data-open="false" aria-hidden="true" />`
  - floating button has only title “coming next”, no toggle/action
- **Reference:** `features/dashboard/components/DashboardLayout.tsx` + `components/dual-sidebar/*`
  - integrated right sidebar state + toggle behavior

**Impact:** missing functional shell capability and interaction parity.

---

### 5) PageContainer header parity mismatch
- **Target:** `src/components/dashboard/page-container.tsx:31-60`
- **Reference `PageBreadcrumbs` behavior:** sticky header, responsive breadcrumb visibility, group-collapsible height behavior, actions slot

Target issues:
- non-sticky main header in `PageContainer`
- no `actions` slot in container (split across separate components inconsistently)
- missing group-collapsible responsive class behavior in this shared wrapper

**Impact:** layout/scroll behavior differs across pages.

---

## Priority 2 (Incorrect composition / accessibility / polish)

### 6) FilterBar runtime edge-case risks
- **Target:** `src/components/dashboard/filter-bar.tsx:66-68, 139-146`
- `activeFilterField` can be undefined when no filterable fields; code still dereferences `.path` and passes to `filterTypesForField(activeFilterField)`.
- may crash for lists without filterable fields.

---

### 7) Accessibility issues in filter controls
- **Target:** `src/components/dashboard/filter-bar.tsx:140-149, 165-174, 185-193`
- Native `<select>` / checkbox blocks lack explicit `<label htmlFor>` associations (some rely on proximity text only).
- Filter-removal pills use unlabeled icon+text button patterns without explicit aria labels for remove action semantics.
- Reference filter pill UX includes clearer structured interaction/edit dialog semantics.

---

### 8) Password visibility toggle buttons missing accessible names
- **Target:**
  - `src/routes/dashboard/signin.tsx` password toggle button
  - `src/routes/dashboard/signup.tsx` password toggle button
- No `aria-label` / sr-only text on eye toggle buttons.

---

### 9) Signup flow explicitly marked TODO (action/policy parity incomplete)
- **Target:** `src/routes/dashboard/signup.tsx:35-37`
- Comment confirms missing Keystone-style signup gate/auth action parity.

**Impact:** functional parity gap in auth path behavior and policy handling.

---

### 10) List table action semantics differ from reference
- **Target:** `src/components/dashboard/keystone-list-table.tsx`
- Differences:
  - row-click navigation plus nested interactive elements can create accidental navigation edge cases
  - bulk delete uses `window.confirm` (reference uses dialog pattern)

**Impact:** interaction model inconsistency and lower UX quality.

---

## Component-by-component parity checklist

### Shell / Sidebar / User profile
- `DashboardShell`/`DashboardSidebar`/`UserProfile`: **mostly present**
- Missing: functional right sidebar integration and chat toggle behavior

### PageContainer / Breadcrumbs
- `page-container.tsx`, `page-breadcrumbs.tsx`: **partially present**
- Missing sticky/layout parity in shared container; split responsibilities inconsistent

### list-card
- Present (`src/components/dashboard/list-card.tsx`) and route-level cards also implemented in `dashboard/index.tsx`
- Risk: duplicated card implementations can drift

### ListTable
- Present (`keystone-list-table.tsx`) but differs from reference interaction patterns

### FilterBar / FilterAdd / FilterList
- `FilterBar`: present but simplified
- `FilterAdd` and `FilterList`: **missing in target** (controller-driven parity absent)

### Pagination
- Present but simplified; missing reference composite behaviors

### CreatePage
- Present (`src/routes/dashboard/$listKey.create.tsx`) and relatively strong
- Still tied to simplified field editor model, not full controller parity across all complex field types

### ItemPage
- **Missing (placeholder route)**

### Signin / Signup / Reset / Init / NoAccess
- All routes present
- Noted gaps: signup TODO policy parity, a11y labels on password toggles

---

## Base UI / shadcn composition concerns

1. Right sidebar uses inert HTML `<aside>` instead of composed sidebar primitives for interactive behavior (`dashboard-shell.tsx:35`).
2. Filter surfaces rely on raw native controls rather than composed primitives (`Select`, `Popover`, etc.) used by reference `FilterAdd`/`FilterList`, reducing consistency and extensibility.
3. List bulk-delete uses `window.confirm` instead of dialog primitives, inconsistent with other destructive actions.

---

## Recommended implementation order

1. **Implement ItemPage route parity first** (`/dashboard/$listKey/$id`) using reference ItemPageClient behavior.
2. **Restore controller-driven filters** by porting/adapting `FilterAdd` + `FilterList` pattern and wiring into list route.
3. **Upgrade pagination/list bulk selection composition** to reference floating selection mode and delete dialog model.
4. **Implement functional right sidebar toggle/composition** in shell.
5. **Fix a11y issues** (password toggle labels, filter labels/semantics).
6. **Align PageContainer sticky/header behavior** for consistent layout parity.

---

## Files reviewed (target highlights)
- `src/routes/dashboard/$listKey.$id.tsx` (placeholder)
- `src/routes/dashboard/$listKey.tsx`
- `src/routes/dashboard/$listKey.create.tsx`
- `src/components/dashboard/filter-bar.tsx`
- `src/components/dashboard/keystone-list-table.tsx`
- `src/components/dashboard/pagination.tsx`
- `src/components/dashboard/page-container.tsx`
- `src/components/dashboard/page-breadcrumbs.tsx`
- `src/components/dashboard/dashboard-shell.tsx`
- `src/components/dashboard/dashboard-sidebar.tsx`
- `src/routes/dashboard/signin.tsx`
- `src/routes/dashboard/signup.tsx`
- `src/routes/dashboard/reset.tsx`
- `src/routes/dashboard/init.tsx`
- `src/routes/dashboard/no-access.tsx`

## Reference files reviewed (non-exhaustive)
- `features/dashboard/components/DashboardLayout.tsx`
- `features/dashboard/components/Sidebar.tsx`
- `features/dashboard/components/PageContainer.tsx`
- `features/dashboard/components/PageBreadcrumbs.tsx`
- `features/dashboard/components/FilterAdd.tsx`
- `features/dashboard/components/FilterList.tsx`
- `features/dashboard/components/Pagination.tsx`
- `features/dashboard/screens/ListPage/ListPageClient.tsx`
- `features/dashboard/screens/ItemPage/ItemPageClient.tsx`
