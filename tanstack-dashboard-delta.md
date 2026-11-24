# TanStack Dashboard Delta vs original Next starter dashboard

Audit date: 2026-05-12

## Scope compared
- **Current implementation:** `/Users/junaid/code/tanstack-keystone-starter/src/routes/dashboard*`, `src/components/dashboard/*`, `src/features/cms/*dashboard*`, `src/features/cms/graphql-client.ts`
- **Original Next starter dashboard:** `/Users/junaid/code/next-keystone-starter/app/dashboard/*`, `/Users/junaid/code/next-keystone-starter/features/dashboard/*`

---

## 1) Routes: exact deltas

## Present in TanStack
- `/dashboard` (`src/routes/dashboard.tsx`, `src/routes/dashboard/index.tsx`)
- `/dashboard/$listKey` (`src/routes/dashboard/$listKey.tsx`)
- `/dashboard/signin` (`src/routes/dashboard/signin.tsx`)
- `/dashboard/init` (`src/routes/dashboard/init.tsx`)
- `/dashboard/no-access` (`src/routes/dashboard/no-access.tsx`)

## Present in Next starter but missing in TanStack
- `/dashboard/$listKey/create` (Next: `app/dashboard/(admin)/[listKey]/create/page.tsx`)
- `/dashboard/$listKey/$id` item detail/edit route (Next: `app/dashboard/(admin)/[listKey]/[id]/page.tsx`)
- `/dashboard/signup` (Next: `app/dashboard/signup/page.tsx`)
- `/dashboard/reset` (Next: `app/dashboard/reset/page.tsx`)

## Route-behavior deltas
- Next admin layout server-fetches auth + admin meta before rendering dashboard (`app/dashboard/(admin)/layout.tsx`).
- TanStack gates in `beforeLoad` via `getDashboardAuthStateForCurrentRequest()` (`src/routes/dashboard.tsx`) and excludes `/init`, `/signin`, `/no-access` from shell, but does not yet include signup/reset route handling.

---

## 2) Screens & page capabilities: exact deltas

## TanStack has
- Dashboard overview cards + migration/status UI (`src/routes/dashboard/index.tsx`)
- List page with basic search, pagination, fields/contracts tabs (`src/routes/dashboard/$listKey.tsx`)
- Sign-in form calling `authenticateUserWithPassword` (`src/routes/dashboard/signin.tsx`)
- Init (create first user) form (`src/routes/dashboard/init.tsx`)
- No-access screen (`src/routes/dashboard/no-access.tsx`)

## Missing vs Next starter
- Full **Item page** UX (read/edit/save/reset/delete/copy id/breadcrumbs/required validation/toasts)
  - Next: `features/dashboard/screens/ItemPage/*`
- Full **Create page** UX (default values, required validation, create + navigate)
  - Next: `features/dashboard/screens/CreatePage/*`
- **Sign-up/reset** screens and flows
  - Next: `features/dashboard/screens/SignUpPage/*`, `screens/ResetPage/*`
- Next Home/List screens include richer filter/sort/field-selection behaviors (see section 5)

---

## 3) Components: missing/partial deltas

## TanStack has
- Shell/sidebar/header: `src/components/dashboard/dashboard-shell.tsx`
- List card: `src/components/dashboard/list-card.tsx`
- Preview table: `src/components/dashboard/list-preview-table.tsx`

## Missing vs Next starter component surface
- `features/dashboard/components/Fields.tsx` dynamic field renderer with conditional mode/group handling
- List control components:
  - `FilterBar.tsx`, `FilterAdd.tsx`, `FilterList.tsx`, `SortSelection.tsx`, `FieldSelection.tsx`, `Pagination.tsx`
- Advanced `ListTable.tsx` (row selection, bulk actions, sortable headers, linked cells)
- Page structure utilities (`PageContainer`, `PageBreadcrumbs`, error boundary)
- User/profile menu component parity (`UserProfileClient.tsx`)
- Dual-sidebar/AI components (`components/dual-sidebar/*`) — optional product feature but present in Next

---

## 4) Actions / data layer deltas

## TanStack currently implements
- GraphQL read + metadata boundary: `src/features/cms/graphql-client.ts`
  - overview query + dynamic list query/count
  - server/browser execution path
- Auth state server fn bridge: `src/features/cms/dashboard-auth.functions.ts`, `dashboard-auth.ts`
- Signin/init mutations are called directly from route components via `executeDashboardGraphQL`

## Missing vs Next starter actions
- Item CRUD action layer equivalents:
  - `features/dashboard/actions/item-actions.ts` (create/update/delete/deleteMany wrappers)
- List/item fetch action parity:
  - `getListItemsAction.ts`, `getItemAction.ts`, `getItemValidationAction.ts`
- Relationship options action:
  - `actions/relationship.ts`
- Complete auth action surface:
  - `actions/auth.ts` includes signOut, signup, reset, getAuthenticatedUser helpers and cookie flow
- Query hooks/factories/query-key structure parity:
  - `hooks/use*.query.ts`, `lib/queryKeys.ts`

---

## 5) CRUD parity delta (core)

## Read
- **List read:** Partial parity
  - TanStack has list records + count + primitive table rendering.
  - Missing Next-level selected field URL control + filter/sort richness.
- **Item read:** Missing
  - No `/dashboard/$listKey/$id` route/page.

## Create
- Missing practical CRUD UI parity
  - Buttons visible but disabled (`src/components/dashboard/list-card.tsx`, `src/routes/dashboard/$listKey.tsx`)
  - No create route/form/hook equivalent to Next `useCreateItem` + create screen.

## Update
- Missing
  - No item edit form, no changed-field serialization flow, no update action wrapper.

## Delete
- Missing
  - No item delete UI flow.
  - No bulk delete UI/selection pipeline.

---

## 6) Filtering/sorting/field-selection deltas

## TanStack now
- Search only (enter key) over initial search fields on list page.
- Basic previous/next pagination.

## Missing vs Next starter
- URL-driven filter grammar (`!field_filterType` style)
- `buildWhereClause` parity usage
- `buildOrderByClause` + `sortBy` URL behavior
- Visible columns (`fields` URL param) selector
- Sort UI and sortable table headers
- Full pagination control component parity

---

## 7) Field views/controllers parity delta

## Missing in TanStack
- Registry + controller stack from Next:
  - `features/dashboard/views/registry.ts`
  - `utils/enhanceFields.ts`
  - per-type views/controllers (`text`, `select`, `relationship`, `image`, `document`, etc.)
- Form utilities:
  - `useInvalidFields`, `useHasChanges`, changed-data serialization helpers
- Result: TanStack table uses simplified value rendering, not controller-based `Cell`/`Field` behavior.

---

## 8) Styling/layout deltas

## TanStack
- shadcn/base shell styling exists and is coherent.
- Standalone auth screens styled with card forms.

## Missing vs Next starter
- Dashboard provider stack parity (AdminMetaProvider/QueryProvider/DashboardProvider shape as used by screens)
- Right AI sidebar/floating chat UI (optional feature parity)
- Dedicated dashboard error boundary wrapping app chrome
- Some page-level composition patterns (breadcrumbs/container conventions)

---

## 9) Auth/init flow deltas

## TanStack now
- Route guard in `/dashboard` layout (`src/routes/dashboard.tsx`)
- `signin`, `init`, `no-access` screens exist
- Signin and init invoke GraphQL mutations

## Missing vs Next starter
- Signup route/screen/flow
- Reset route/screen/flow
- Signout action/menu parity integrated into shell
- Full auth helper action layer parity (cookie/session helper APIs similar to Next `actions/auth.ts`)

---

## 10) Bottom-line delta summary

Current TanStack dashboard is a **working shell + overview + list read prototype with auth gating basics**.

Main missing deltas vs original Next starter dashboard are:
1. Missing routes (`create`, `item`, `signup`, `reset`).
2. Missing item/create screens and full CRUD interactions.
3. Missing controller-based field system (registry, enhanceFields, Fields renderer, validation/serialization hooks).
4. Missing advanced list controls (filter/sort/field selection, bulk actions).
5. Missing action-layer parity (item actions, relationship options, full auth flows/signout).
6. Missing optional but present Next UX stack (error boundary, dual-sidebar AI/chat, richer provider composition).
