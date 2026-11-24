# Dashboard ↔ Next Starter ↔ Keystone Admin UI Parity Audit

Date: 2026-05-12  
Target: `/Users/junaid/code/tanstack-keystone-starter`  
References: 
- Next starter dashboard: `/Users/junaid/code/next-keystone-starter/features/dashboard`, `/Users/junaid/code/next-keystone-starter/app/dashboard`
- Keystone Admin UI source: `/Users/junaid/code/keystone/packages/core/src/admin-ui` (+ fields/views semantics)

## Executive Summary

TanStack dashboard has partial parity for route scaffolding, auth gating basics, list querying, and basic create/list UI. However, **item page architecture is missing**, **field-controller/view architecture is not implemented**, and several Keystone semantics are simplified or incompatible (filters, relationship operations, validation/error granularity, conditional field/action modes, complex field editing).

Overall parity status:
- **Critical gaps**: item edit route, controller-based fields architecture, Keystone filter grammar completeness, mutation error model compatibility.
- **High gaps**: relationship create/edit UX parity, save/reset/dirty-state parity, no-access/auth edge behavior, create/update serialization semantics for complex fields.
- **Medium gaps**: empty states nuance, accessibility and button semantics, visual details (table actions, sidebar layout behavior).

---

## Scope Coverage Matrix (requested areas)

| Area | Status |
|---|---|
| `/dashboard` | Partial parity |
| `/dashboard/$listKey` | Partial parity |
| `/dashboard/$listKey/create` | Partial parity |
| `/dashboard/$listKey/$id` | **Missing (critical)** |
| `signin`, `signup`, `reset`, `init`, `no-access` | Partial with behavioral deltas |
| Middleware/guards | Partial parity |
| Shell/sidebar/user menu | Partial |
| List cards/table/pagination/bulk delete | Partial |
| Filter grammar (`!field_type` URL params) | Partial (limited operator/type support) |
| Sort/display fields | Partial |
| Relationship picker | Partial (no inline create/edit parity) |
| Field views/controllers registry architecture | **Missing** |
| Create form | Partial |
| Item edit dirty/reset/delete | **Missing in target** |
| Validation/errors | Partial and simplified |
| Field-type display/edit parity | Partial to low |
| Fresh/init user flows | Partial |
| Accessibility/Base UI warnings | Several issues |
| Visual parity | Partial |

---

## Detailed Findings

## 1) Route behavior and guards

### 1.1 Item route is stubbed
- **Severity:** Critical
- **Target:** `src/routes/dashboard/$listKey.$id.tsx:1-9`
- **Observed:** Returns `Hello "/dashboard/$listKey/$id"!` only.
- **Reference:**
  - Next starter item page client: `features/dashboard/screens/ItemPage/ItemPageClient.tsx`
  - Keystone item template linkage: `packages/core/src/admin-ui/templates/item.tsx`
- **Impact:** No edit/save/delete/reset/dirty-state/field-mode behavior.
- **Fix:** Implement item loader + controller-driven form + save/reset/delete flows; follow Next starter/Keystone item page lifecycle.

### 1.2 Guard flow mostly present, but public-route and redirect nuance differs
- **Target:** `src/routes/dashboard.tsx:1-57`
- **Reference:** `features/dashboard/middleware.ts`
- **Observed parity:** init redirect, signin redirect, no-access gating are present.
- **Deltas:**
  - TanStack uses route `beforeLoad` (SSR-only guard check) while Next uses middleware; client-side navigation edge cases may differ.
  - Public auth route set includes `signup` and `reset`, but behavior around `from` sanitization differs from Next middleware nuances.
- **Fix:** Add test matrix for direct hit vs client navigation across all dashboard auth routes.

---

## 2) Dashboard shell/sidebar/user menu parity

### 2.1 Shell includes non-parity AI floating button
- **Severity:** Medium
- **Target:** `src/components/dashboard/dashboard-shell.tsx:10-20, 22-37`
- **Observed:** `FloatingChatButton` placeholder (“AI chat sidebar coming next”).
- **Reference:** Next starter has explicit dual-sidebar/AI mode architecture (optional but integrated), not a floating placeholder.
- **Fix:** Remove placeholder for strict parity, or implement full feature behind a flag.

### 2.2 Sidebar/menu architecture likely simplified
- **Target files:** `src/components/dashboard/dashboard-sidebar.tsx`, `src/components/dashboard/user-profile.tsx`
- **Observed:** Not reviewed in full here, but architecture appears thinner than Next `DashboardLayout + Sidebar + UserProfileClient` pattern.
- **Fix:** Align list nav grouping, account actions, keyboard navigation and responsive collapse behavior.

---

## 3) List page/table/filter/sort/display/pagination/bulk-delete

### 3.1 Filter grammar supports `!field_type`, but operators/types are incomplete vs Keystone semantics
- **Severity:** High
- **Target:**
  - UI grammar: `src/components/dashboard/filter-bar.tsx:14-277`
  - Backend parse/build: `src/features/cms/graphql-client.ts:215-303`
- **Reference:**
  - Next starter filter composition via controllers: `features/dashboard/components/FilterBar.tsx`, `FilterAdd.tsx`, `FilterList.tsx`
  - Keystone conditional/filter utilities: `packages/core/src/admin-ui/utils/filters.ts`
- **Deltas:**
  - Hardcoded kind/operator mapping; lacks controller-provided filter types/labels/serialization.
  - Missing many field-specific ops (relationship-specific, document/json-specific constraints, etc.).
  - `is_empty/not_empty` implemented only as equals null logic; may not capture empty arrays/strings semantics by field.
- **Fix:** Replace hardcoded grammar with controller-derived filter metadata and graphql builders.

### 3.2 Sort param format differs from Next starter
- **Severity:** Medium
- **Target:** `src/components/dashboard/keystone-list-table.tsx:167-194`, `src/features/cms/graphql-client.ts:305-312`
- **Observed:** `sortBy=field:asc|desc`
- **Reference:** Next uses `sortBy=field` or `sortBy=-field` style in `features/dashboard/components/ListTable.tsx`.
- **Impact:** Interop differences with existing links/tests.
- **Fix:** Accept both syntaxes; normalize internally.

### 3.3 Bulk delete mostly present but error model simplified
- **Severity:** Medium
- **Target:** `src/components/dashboard/keystone-list-table.tsx:34-57`
- **Observed:** Runs delete-many and shows a single message; no per-path error handling pattern.
- **Reference:** Next/Keystone style inspects structured errors and shows detailed dialogs/toasts.
- **Fix:** Parse GraphQL errors into field/global buckets for consistent UX.

### 3.4 Empty state copy diverges
- **Severity:** Low
- **Target:** `src/components/dashboard/keystone-list-table.tsx:61-67`
- **Observed:** single empty state; no differentiated “no results found” vs “no items created” parity path like Next ListPageClient.
- **Fix:** Split empty states by filter/search presence.

---

## 4) Create page semantics

### 4.1 Create route implemented but not controller-based
- **Severity:** High
- **Target:** `src/routes/dashboard/$listKey.create.tsx:1-224`
- **Observed:** Raw string-based draft + `parseDraftValue` for all fields.
- **Reference:** Next starter uses field registry/controllers (`views/registry.ts`) and operation serialization.
- **Impact:** Complex fields and edge validation diverge from Keystone behavior.
- **Fix:** Migrate create form to controller-driven `Field` components + `serialize` pipeline.

### 4.2 Relationship create serialization is lossy for many-rel fields
- **Severity:** High
- **Target:** `src/components/dashboard/field-value-editor.tsx:68-94`
- **Observed:** many relationship uses `{ set: ids.map(id=>({id})) }` from comma input.
- **Risk:** Keystone-style create/update semantics often use connect/disconnect patterns with richer UX (selection objects, inline create).
- **Fix:** Use relationship controller + picker state objects; avoid comma-string transport model.

---

## 5) Field views/controllers architecture parity

### 5.1 Target lacks Keystone-style field registry/controller runtime
- **Severity:** Critical
- **Target architecture:** `src/components/dashboard/field-value-editor.tsx` and ad hoc rendering in `keystone-list-table.tsx`
- **Reference architecture:** `features/dashboard/views/registry.ts` (+ per-type controllers/Cell/Field)
- **Impact:**
  - No standardized `graphqlSelection`, `serialize`, `deserialize`, `validate`, filter metadata.
  - Hard to achieve consistent behavior for document/image/file/relationship/multiselect/password/etc.
- **Fix:** Introduce target-side field registry mirroring Keystone contracts (without importing Keystone UI code).

### 5.2 Field type parity gaps (edit/display)
- **Severity:** High
- **Target:** `src/components/dashboard/field-value-editor.tsx:10-194`, `src/components/dashboard/keystone-list-table.tsx:196-309`
- **Major gaps:**
  - document/json/image/file treated as text/JSON blobs.
  - no specialized editors for document rich text, image/file upload lifecycle.
  - virtual field read-only semantics not explicit.
  - password field UX limited (input + isSet display only).
- **Fix:** Implement per-type Field + Cell components with controller config.

---

## 6) Auth flows: signin/signup/reset/init/no-access

### 6.1 Signup flow is explicitly TODO/scaffold
- **Severity:** High
- **Target:** `src/routes/dashboard/signup.tsx:28-46, 54`
- **Observed:** direct `createUser` mutation fallback + TODO comments.
- **Reference:** Next auth action pipeline and policy gates.
- **Fix:** Implement signup permission checks + action semantics + consistent messages.

### 6.2 Reset/signin mostly functional but with parity differences
- **Severity:** Medium
- **Target:** `src/routes/dashboard/signin.tsx`, `src/routes/dashboard/reset.tsx`
- **Observed:** Works via direct GraphQL calls; error/success format simplified.
- **Fix:** Align response handling and copy with reference flows; preserve non-enumeration semantics.

### 6.3 Init flow includes insecure defaults in form state
- **Severity:** Medium
- **Target:** `src/routes/dashboard/init.tsx:25-27`
- **Observed:** default credentials prefilled (`admin@example.com` / `password`).
- **Risk:** poor operational hygiene.
- **Fix:** empty defaults + password guidance.

---

## 7) Validation, errors, dirty state, delete/reset

### 7.1 No item-page dirty state/reset/delete parity because item page missing
- **Severity:** Critical
- **Target:** `src/routes/dashboard/$listKey.$id.tsx`
- **Reference:** `features/dashboard/screens/ItemPage/ItemPageClient.tsx` (has `useHasChanges`, invalid fields, save states, delete/reset dialogs).
- **Fix:** implement same behavioral model.

### 7.2 Validation is only required/non-empty for create
- **Severity:** High
- **Target:** `src/components/dashboard/field-value-editor.tsx:57-66`
- **Observed:** no controller-level validation, no per-field error focus mapping.
- **Fix:** adopt controller validate + field-level error rendering.

---

## 8) Accessibility and Base UI concerns

### 8.1 Icon-only toggle buttons missing explicit accessible names
- **Severity:** Medium
- **Examples:** password visibility toggles in `signin.tsx` and `signup.tsx` use icon buttons without `aria-label`.
- **Fix:** add `aria-label` and pressed state.

### 8.2 Nested/overlapping interactive regions risk
- **Severity:** Medium
- **Target:** dashboard list cards in `src/routes/dashboard/index.tsx` (card wrapped by link + top-right create control).
- **Fix:** ensure no nested interactive conflicts and proper tab order.

---

## 9) Visual parity

- Overall structure is close for list/table pages but still visibly different from Next/Keystone in spacing, typography, badge style, action areas, and sidebar behaviors.
- Item page is absent, causing largest visual parity failure.

---

## Recommended Fix Plan (priority order)

1. **Implement `/dashboard/$listKey/$id` fully** (critical).  
2. **Introduce field registry/controller architecture** in TanStack codebase (critical).  
3. **Migrate create/list rendering to controller-based Field/Cell/filter definitions** (high).  
4. **Align filter/sort URL grammar compatibility** with Next and Keystone semantics (high).  
5. **Complete signup/auth action parity and refine reset/signin edge behavior** (high).  
6. **A11y sweep** for icon buttons, focus order, semantics (medium).  

---

## Suggested browser smoke tests / screenshots checklist

Capture side-by-side screenshots (TanStack vs Next starter) for:
1. `/dashboard` with multiple lists + empty state variant.
2. `/dashboard/{list}` with:
   - active search
   - at least 2 filters using `!field_type`
   - sorted column indicator
   - display field toggles
   - bulk selection banner
3. `/dashboard/{list}/create` with each key field kind populated.
4. `/dashboard/{list}/{id}` (once implemented): clean state, dirty state, validation error, save success, delete confirm.
5. Auth screens: signin/signup/reset/init/no-access.

Functional smoke script ideas:
- Guard matrix: unauthenticated/authenticated/no-access/init-required across each dashboard route.
- Filter roundtrip: URL -> query -> visible chips -> backend where clause correctness.
- Relationship operations: single and many relationship create/edit/delete.
- Complex field fidelity: document/json/image/file serialization-deserialization stability.

---

## Exact target/reference files examined

### Target (TanStack)
- `src/routes/dashboard.tsx`
- `src/routes/dashboard/index.tsx`
- `src/routes/dashboard/$listKey.tsx`
- `src/routes/dashboard/$listKey.create.tsx`
- `src/routes/dashboard/$listKey.$id.tsx`
- `src/routes/dashboard/signin.tsx`
- `src/routes/dashboard/signup.tsx`
- `src/routes/dashboard/reset.tsx`
- `src/routes/dashboard/init.tsx`
- `src/routes/dashboard/no-access.tsx`
- `src/components/dashboard/dashboard-shell.tsx`
- `src/components/dashboard/filter-bar.tsx`
- `src/components/dashboard/keystone-list-table.tsx`
- `src/components/dashboard/field-value-editor.tsx`
- `src/features/cms/graphql-client.ts`

### Reference (Next starter)
- `features/dashboard/middleware.ts`
- `app/dashboard/(admin)/layout.tsx`
- `features/dashboard/screens/ListPage/ListPageClient.tsx`
- `features/dashboard/screens/ItemPage/ItemPageClient.tsx`
- `features/dashboard/components/FilterBar.tsx`
- `features/dashboard/components/ListTable.tsx`
- `features/dashboard/views/registry.ts`

### Reference (Keystone Admin UI)
- `packages/core/src/admin-ui/templates/item.tsx`
- `packages/core/src/admin-ui/utils/filters.ts`
