# Next Keystone Dashboard UI & Route Inventory (for TanStack migration)

## Route structure (`app/dashboard`)

### Root + shells
- `app/dashboard/layout.tsx` — global dashboard shell (theme + toaster only).
- `app/dashboard/(admin)/layout.tsx` — authenticated admin shell; prefetches `adminMeta` + `authenticatedUser`, then renders `features/dashboard/components/DashboardLayout`.

### Admin routes (all map to feature screens)
- `app/dashboard/(admin)/page.tsx` → `HomePage`
- `app/dashboard/(admin)/[listKey]/page.tsx` → `ListPage`
- `app/dashboard/(admin)/[listKey]/create/page.tsx` → `CreatePage`
- `app/dashboard/(admin)/[listKey]/[id]/page.tsx` → `ItemPage`

### Auth/init/access routes
- `app/dashboard/signin/page.tsx` → `SignInPage`
- `app/dashboard/signup/page.tsx` → `SignUpPage`
- `app/dashboard/reset/page.tsx` → `ResetPage`
- `app/dashboard/init/page.tsx` → `InitPage`
- `app/dashboard/no-access/page.tsx` → `NoAccessPage`

---

## UI/component map (`features/dashboard/components`)

## Core layout/navigation
- `DashboardLayout.tsx`
  - Wraps app in: `ErrorBoundary` → `QueryProvider` (React Query) → `DashboardProvider` → `AdminMetaProvider` → `AiConfigProvider` → chat state provider → `SidebarProvider`.
  - Renders left `Sidebar`, main `SidebarInset`, right AI/chat sidebar (`RightSidebar`), floating chat toggle button.
- `Sidebar.tsx`
  - Builds nav from `adminMeta.lists` dynamically.
  - Home link + Models collapsible/dropdown (icon mode).
  - User footer via `UserProfileClient`.
- `PageContainer.tsx`
  - Shared page scaffold: header, sidebar trigger, breadcrumbs, optional page header, main content.

## List UI controls/table
- `FilterBar.tsx`, `FilterAdd.tsx`, `FilterList.tsx` — filtering UX.
- `SortSelection.tsx` — sort selection.
- `FieldSelection.tsx`, `Fields.tsx` — field/column controls.
- `ListTable.tsx`
  - Renders list rows, sort headers, row selection, bulk delete (`deleteManyItemsAction`), pagination.
  - Uses field view registry (`views/registry`) to render cells by field type.
- `Pagination.tsx` — page nav + bulk action footer behavior.

## Supporting components
- `PageBreadcrumbs.tsx`, `Logo.tsx`, `ErrorBoundary.tsx`, `UserProfileClient.tsx`
- `components/dual-sidebar/*` — AI/chat second sidebar system.

---

## Screen map (`features/dashboard/screens`)

- `HomePage/index.tsx` (server)
  - Fetches admin meta + list counts; renders model cards with create shortcut.
- `ListPage/index.tsx` (server)
  - Resolves list by path, parses URL params, builds `where/orderBy`, fetches items, fetches admin list metadata, hands to `ListPageClient`.
- `ListPage/ListPageClient.tsx` (client)
  - URL-reactive search/filter/sort/paging state.
  - React Query refetch for list data; renders `FilterBar` + `ListTable` + empty/error states.
- `ItemPage/index.tsx` + `ItemPage/ItemPageClient.tsx`
  - Fetch item + validation metadata; render editable item form.
- `CreatePage/index.tsx` + `CreatePage/CreatePageClient.tsx`
  - Resolve list + render create form.
- Auth screens (`SignInPage`, `SignUpPage`, `ResetPage`, `InitPage`, `NoAccessPage`) are route-level page UIs.

---

## Data/actions/middleware dependencies

## Actions (`features/dashboard/actions`)
Key server actions used by UI flow:
- `getAdminMetaAction.ts` — central schema/list metadata query; augments lists with GraphQL names.
- `getListByPath.ts`, `getListItemsAction.ts`, `getItemAction.ts`, `getItemValidationAction.ts`, `getListCounts.ts`
- `auth.ts` — sign in/out/up/reset, `getAuthenticatedUser`.
- `item-actions.ts` — mutations including bulk delete used by `ListTable`.

## Middleware
- Actual file is `features/dashboard/middleware.ts` (not a middleware directory).
- Handles dashboard auth gating and redirects:
  - init flow (`/dashboard/init`)
  - signin/reset protection
  - no-access redirect based on `user.role.canAccessDashboard`

---

## Views system (`features/dashboard/views`)

- `views/registry.ts` + field-type folders (`text`, `relationship`, `document`, etc.)
- Critical for List/Item rendering: field metadata includes `viewsIndex`; UI resolves to concrete Cell/Field components.
- `document` and `relationship` view stacks are heavy and have many nested client components.

---

## Prioritized copy/adapt plan for TanStack

## P0 — Route parity and shell (start here)
1. Recreate route tree parity in TanStack Router:
   - `/dashboard`
   - `/dashboard/:listKey`
   - `/dashboard/:listKey/create`
   - `/dashboard/:listKey/:id`
   - `/dashboard/signin|signup|reset|init|no-access`
2. Port shell hierarchy first:
   - `DashboardLayout` + providers (Query, dashboard context, admin meta context, sidebar state).
3. Port `Sidebar` + `PageContainer` to establish navigation and consistent frame.

## P1 — List experience (largest surface)
1. Port server-query logic from `screens/ListPage/index.tsx` into TanStack loader/query layer:
   - param parsing (`page`, `pageSize`, `search`, `fields`, filters)
   - `buildWhereClause` + `buildOrderByClause`
2. Port `ListPageClient`, `FilterBar`, `ListTable`, `Pagination`.
3. Keep URL as source of truth for table state.

## P2 — Item/Create forms
1. Port `ItemPage` flow (fetch item + validation metadata).
2. Port `CreatePage` flow.
3. Reuse field views registry integration early to avoid temporary custom renderers.

## P3 — Home and auth flows
1. Port `HomePage` cards/counts.
2. Port signin/signup/reset/init/no-access UIs + auth action integration.
3. Re-implement middleware intent as TanStack/router guards + server-side auth checks.

## P4 — Optional/advanced
1. Port dual-sidebar AI/chat components only after core CRUD parity.
2. Defer `document` editor refinements and complex relationship UX until baseline works.

---

## High-risk / adaptation notes

- **Middleware model mismatch:** Next middleware logic must be remapped to router guards and server endpoints.
- **Server actions dependency:** Next server actions (`'use server'`) need API/function equivalents in TanStack stack.
- **Field view registry coupling:** List/Item rendering relies on `viewsIndex` and registry lookup; port registry contract intact.
- **URL-state semantics:** Current list UX depends heavily on query params; preserve exact behavior for compatibility.
- **Auth cookie behavior:** Sign-in/out uses `keystonejs-session` cookie and cache invalidation semantics; replicate carefully.

---

## Concrete “open first” files for implementation

1. `features/dashboard/components/DashboardLayout.tsx` — provider stack + overall composition.
2. `features/dashboard/screens/ListPage/index.tsx` — canonical list data-flow and query var construction.
3. `features/dashboard/screens/ListPage/ListPageClient.tsx` — client URL-state + React Query behavior.
4. `features/dashboard/components/ListTable.tsx` — table rendering contract + actions + field view integration.
5. `features/dashboard/views/registry.ts` — dynamic field renderer backbone.
6. `features/dashboard/middleware.ts` — auth/init/no-access routing rules to reproduce in TanStack guards.
