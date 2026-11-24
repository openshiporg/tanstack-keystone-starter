# Dashboard feature gap report: TanStack dashboard vs NKS custom dashboard

Date: 2026-05-11  
Scope: dashboard/backend integration audit only. No code changes were made besides this report.

## Executive summary

The TanStack dashboard is currently a **GraphQL-backed read-path prototype**: it has a TanStack Start route shell, shadcn sidebar, TanStack Query SSR hydration, dashboard overview counts, and a list records page that can query items/counts from the CMS GraphQL runtime.

NKS has a much larger custom Keystone-like dashboard: list filters/sorting/column selection, row selection and bulk delete, item detail/edit routes, create routes, field controller/view registry, form serialization/deserialization, relationship option queries, auth/init/reset/sign-up screens, and richer layout/providers.

The most important remaining gap is not the shell; it is the **Keystone Admin UI contract layer**:

1. Normalize `adminMeta` into the same list/field shape NKS screens expect, including a fields record or reliable helper access.
2. Port/adapt field controllers and field views to TanStack-compatible components.
3. Add TanStack routes and GraphQL client mutations for item/create/update/delete.
4. Add list controls: URL-backed filters, sorting, display columns, row links, selection, and bulk actions.
5. Add real auth/session gating once backend auth parity exists.

Backend parity has improved relative to `official-keystone-parity-gap-report.md`: current `src/features/cms/runtime.ts` already generates create/update/delete **and many mutations** for all fixed lists. But dashboard completion is still blocked by backend gaps around real auth/session mutations, `authenticatedItem`, Keystone-like `adminMeta.list(key:)` with item-specific `itemView(id:)`, password/image/document/storage semantics, complete filters/order behavior, nested relationship writes, upload support, hooks/access errors, and production session/cookie handling.

---

## 1. What the TanStack dashboard has now

### Route and layout shell

- `src/routes/dashboard.tsx` defines `/dashboard` and wraps children in `DashboardShell` with an `<Outlet />`.
- `src/components/dashboard/dashboard-shell.tsx` provides a shadcn sidebar and header. It loads dashboard overview data through TanStack Query and builds navigation from GraphQL list metadata:
  - `useSuspenseQuery` for `dashboardQueryKeys.overview` at lines 34-39.
  - nav items from `data.lists.map((list) => ({ title: list.label, to: /dashboard/${list.path} }))` at lines 40-50.
  - sidebar/header chrome at lines 53-125.
- The shell is already independent of official Keystone Admin UI and Next-specific server APIs.

### TanStack Query / GraphQL client boundary

- `src/features/cms/graphql-client.ts` centralizes dashboard data loading:
  - `executeDashboardGraphQL()` posts to `/api/graphql` in the browser and uses in-process GraphQL execution on the server (`typeof window === 'undefined'`) at lines 51-82.
  - `fetchKeystoneAdminMeta()` calls the Keystone-like `adminMeta` query and normalizes fields with a string `kind` at lines 84-110.
  - `fetchDashboardOverview()` fetches `adminMeta`, dynamically builds count selections, and returns list summaries with counts at lines 113-136.
  - `fetchDashboardListPage()` resolves list by path/key, selects fields, builds a basic search `where`, and executes dynamic list/count queries at lines 198-260.
- `src/features/cms/graphql.ts` exposes the current `adminMetaGraphQLQuery` for the dashboard at lines 16-74.

### Dashboard overview page

- `src/routes/dashboard/index.tsx` uses a route loader to prefetch overview data with `context.queryClient.ensureQueryData()` at lines 22-28.
- The page renders:
  - GraphQL-backed CMS snapshot metrics for lists/fields/items at lines 61-79.
  - list cards for every list at lines 83-87.
  - migration/dependency status cards at lines 89-127.
- `src/components/dashboard/list-card.tsx` renders per-list item count, field count, initial columns, and links to `/dashboard/$listKey`. Create buttons are present but disabled.

### List page read path

- `src/routes/dashboard/$listKey.tsx` implements `/dashboard/$listKey` with URL search validation for `page`, `pageSize`, and `search` at lines 23-28.
- Its loader fetches list page data via TanStack Query and maps missing lists to `notFound()` at lines 30-54.
- The component renders:
  - list header and item count at lines 82-104.
  - records tab with basic Enter-to-search over initial search fields and previous/next pagination at lines 112-172.
  - fields tab listing field metadata at lines 176-189.
  - contracts tab dumping the normalized list contract at lines 191-205.
- `src/components/dashboard/list-preview-table.tsx` renders loading/error/empty states and a simple table at lines 19-89.
- Its field display supports checkboxes, multiselects, relationships, password `{ isSet }`, object JSON fallback, and primitives at lines 91-157.

### Sign-in placeholder

- `src/routes/dashboard/signin.tsx` exists but is explicitly disabled/placeholder-only:
  - Description says auth/session flow is future work at lines 18-22.
  - email/password inputs and submit button are disabled at lines 24-36.

### Backend currently reachable from dashboard

- `src/features/cms/runtime.ts` now generates fixed-list GraphQL CRUD schema:
  - list item/list/count query fields at lines 366-372.
  - single and many create/update/delete mutation fields at lines 375-385.
  - mutation resolvers for single/many create/update/delete at lines 507-542.
- This is enough for dashboard read path and a first create/update/delete UI, but not enough for full NKS/Keystone behavior.

---

## 2. What NKS dashboard has that TanStack lacks

### Full route surface

NKS route tree under `/Users/junaid/code/next-keystone-starter/app/dashboard` includes:

- `/dashboard` home route.
- `/dashboard/[listKey]` list page.
- `/dashboard/[listKey]/[id]` item edit/detail page.
- `/dashboard/[listKey]/create` create page.
- Auth/init routes: `signin`, `signup`, `reset`, `init`, `no-access`.
- `(admin)/layout.tsx` fetches `adminMeta` and authenticated user server-side before rendering the dashboard layout. It calls `Promise.all([getAdminMetaAction(), getAuthenticatedUser()])` and passes both to `DashboardLayout`.

TanStack currently has only:

- `/dashboard`
- `/dashboard/$listKey`
- `/dashboard/signin` placeholder

It lacks item routes, create routes, real auth routes, init/reset/sign-up/no-access routes, and authenticated dashboard loader gating.

### Rich dashboard layout/providers

NKS `features/dashboard/components/DashboardLayout.tsx` wraps children with:

- React Query provider.
- Dashboard base path provider.
- AdminMetaProvider.
- AI config/chat providers.
- shadcn sidebar provider.
- left sidebar and optional right AI sidebar.
- floating chat button.
- error boundary.

TanStack has the core shell/sidebar but lacks:

- authenticated user display/profile.
- adminMeta context/provider shape used by NKS screens.
- error boundary around dashboard chrome.
- right AI assistant sidebar/chat UI.
- sign-out/user menu.

AI assistant pieces are optional unless parity means NKS UI feature parity, not Keystone Admin parity. The user context says TanStack should rebuild/port the custom dashboard; therefore AI UI should be considered a later optional NKS-only feature after core CMS parity.

### List controls and table behavior

NKS list page (`features/dashboard/screens/ListPage/ListPageClient.tsx`) has:

- URL-reactive search params conversion at lines 82-89.
- `buildOrderByClause()` and `buildWhereClause()` integration at lines 95-118.
- combines search and filters as `{ AND: [...] }` at lines 102-111.
- selected fields from URL `fields`, `initialColumns`, or fallback label-like fields at lines 121-143.
- `FilterBar` with search, filters, sort, display columns, and create button at lines 215-220.

NKS `features/dashboard/components/ListTable.tsx` has:

- row selection state at lines 52-75.
- bulk delete via `deleteManyItemsAction()` and React Query invalidation at lines 77-118.
- field-controller-based cell rendering via `getFieldViews(field.viewsIndex).Cell` at lines 137-177.
- link-to-item behavior for id/first text field at lines 142-151.
- sortable headers using `sortBy` URL params at lines 209-218.
- pagination component integration later in the file.

TanStack list page lacks:

- URL-backed advanced filters.
- sort dropdown and sortable headers.
- display-column selector and URL `fields` param support.
- row selection.
- bulk delete UI.
- row/item links.
- field controller `Cell` rendering.
- create button navigation (button currently disabled).
- robust empty state distinction between no items and filtered no results.

### Item detail/edit page

NKS `features/dashboard/actions/getItemAction.ts` dynamically builds field selections for item pages and queries both item data and item-specific `adminMeta.list(key:)` metadata:

- filters non-hidden fields and maps field selections at lines 77-86.
- query includes `item: ${list.graphql.names.itemQueryName}(where: { id: $id })` at lines 90-93.
- query includes `keystone.adminMeta.list(key: $listKey).fields.itemView(id: $id)` at lines 94-106.

NKS `features/dashboard/screens/ItemPage/ItemPageClient.tsx` has:

- enhanced fields via `enhanceFields()` at lines 255-258.
- controller-based deserialization at lines 223-247 and initial form value at lines 260-266.
- dynamic required metadata and validation at lines 277-299.
- changed-field detection and update serialization at lines 300-321.
- save error handling/toasts/cache invalidation at lines 323-350.
- reset, delete, copy id, not-found handling, breadcrumbs, and form layout.

TanStack lacks the entire item route and edit lifecycle.

### Create page

NKS `features/dashboard/screens/CreatePage/CreatePageClient.tsx` has:

- enhanced field setup at lines 51-54.
- `useCreateItem()` integration at lines 56-57.
- validation before create at lines 59-67.
- navigation to new item on success at lines 67-70.
- field form rendering via `Fields` at lines 182-185.

TanStack lacks create route and create form UI.

### Field controllers/views

NKS `features/dashboard/views/registry.ts` registers field implementations for:

- `bigInt`, `checkbox`, `decimal`, `document`, `float`, `id`, `image`, `integer`, `json`, `multiselect`, `password`, `relationship`, `select`, `text`, `timestamp`, `virtual`.

NKS `features/dashboard/utils/enhanceFields.ts`:

- validates each field view has `Field` and `controller` exports at lines 20-28.
- applies custom views at lines 33-45.
- attaches `views`, `controller`, normalized `createView`, `itemView`, `listView`, and GraphQL metadata at lines 47-74.

NKS `features/dashboard/components/Fields.tsx`:

- serializes current values for conditional field-mode filtering at lines 63-70.
- resolves field mode (`edit`, `read`, `hidden`) at lines 76-93.
- renders `field.views.Field` with controller, value, validation, required state, and `onChange` at lines 95-112.
- supports field groups at lines 116-130 onward.

TanStack has no equivalent field registry, controllers, `Fields` component, validation hooks, or form serialization/deserialization. Its `viewsIndex` is currently a string in GraphQL/adminMeta (`src/features/cms/runtime.ts` declares `viewsIndex: String!`), whereas NKS `enhanceFields()` expects numeric `viewsIndex` (`typeof field.viewsIndex !== 'number'`). This mismatch must be resolved before copying NKS field code directly.

### Mutations and GraphQL client features

NKS `features/dashboard/actions/item-actions.ts` has dynamic mutations:

- update item at lines 7-43.
- create item at lines 46-83.
- delete item at lines 86-122.
- delete many at lines 124-166.

These return Apollo-style `{ errors, data }` objects expected by NKS UI, but include Next-specific `revalidatePath()` calls at lines 28-30, 67-70, 107-108, and 151-152.

NKS `features/dashboard/lib/keystoneClient.ts` has a structured GraphQL client around `graphql-request` and multipart upload handling. TanStack’s client is currently simpler and lacks:

- Apollo-style error shape helpers for forms.
- cookie/auth forwarding for real sessions.
- multipart upload support.
- file/upload detection.
- richer formatted GraphQL errors.

### Relationship picker

NKS `features/dashboard/actions/relationship.ts` exposes `getRelationshipOptions()` to query related items and counts using list-specific GraphQL names. NKS relationship views include custom select/multiselect, inline create/edit, and cards under `features/dashboard/views/relationship/client/**`.

TanStack only displays relationship values in list cells. It lacks relationship selectors and relationship mutation UI.

### Auth/session/init/reset/sign-up

NKS `features/dashboard/actions/auth.ts` has:

- `signIn()` using `authenticateUserWithPassword` and setting `keystonejs-session` cookie at lines 21-89.
- sign-up, sign-out, initial user, and reset-password flows later in the file.

TanStack has a disabled sign-in placeholder only. Backend also lacks real auth/session primitives, so this is blocked.

---

## 3. Which NKS pieces can be copied/adapted vs rewritten

### Can be copied/adapted with targeted TanStack changes

These are mostly UI/framework-agnostic or only lightly coupled to Next:

1. **Field controller/view implementations** from `features/dashboard/views/**`.
   - High-value, but must adapt imports to TanStack repo component paths and resolve the `viewsIndex` mismatch.
   - Heavy document editor and image upload parts should be staged later because they depend on backend upload/storage semantics and additional packages.

2. **`enhanceFields()` concept** from `features/dashboard/utils/enhanceFields.ts`.
   - Reusable shape: raw field metadata -> `{ views, controller, createView, itemView, listView, graphql }`.
   - Needs rewrite for string `kind` or target must switch to numeric `viewsIndex` compatible with NKS.

3. **`Fields` component** from `features/dashboard/components/Fields.tsx`.
   - Mostly portable React/shadcn logic.
   - Needs import path changes and must use TanStack-compatible field controllers.

4. **Form lifecycle utilities**:
   - `useInvalidFields`, `useHasChanges`, `serializeValueToOperationItem`, `useCreateItem`, `useChangedFieldsAndDataForUpdate`.
   - These depend on enhanced controllers, not Next directly.
   - Adapt mutation calls and query invalidation to TanStack query keys.

5. **List utilities**:
   - `buildWhereClause.ts`, `buildOrderByClause.ts`, `sort.ts`, `useSelectedFields.ts`, `useSort.ts`.
   - Need adaptation from Next `useSearchParams`/router to TanStack Router search state.
   - Also ensure generated backend filters support every operator these utilities emit.

6. **List control UI**:
   - `FilterBar`, `FilterAdd`, `FilterList`, `SortSelection`, `FieldSelection`, `Pagination`.
   - Mostly portable UI, but must replace `next/navigation` and `next/link` with TanStack Router APIs.

7. **List table UI**:
   - `ListTable` row selection, field-cell rendering, sort headers, bulk delete concept.
   - Must replace `next/link`, `next/navigation`, `toast` dependency decisions, and mutation action calls.

8. **Relationship option query concept**:
   - `getRelationshipOptions()` query shape is portable.
   - Rewrite as TanStack server function or shared GraphQL client function.

9. **GraphQL selection maps**:
   - NKS `getListItemsAction.ts` and `getItemAction.ts` selection maps for password, relationship, image, document, virtual fields are useful specs.
   - Centralize in TanStack instead of duplicating per action.

### Must be rewritten for TanStack Start

1. **Routes and layouts**.
   - NKS App Router files use Next conventions and should be rebuilt as TanStack file routes:
     - `/dashboard/$listKey/create`
     - `/dashboard/$listKey/$id`
     - auth/init/reset/sign-up/no-access routes.

2. **Server actions**.
   - NKS actions use `'use server'`, `next/cache`, `next/headers`, and `next/navigation`.
   - Rewrite as shared GraphQL client functions, TanStack Start server functions, or route loaders/actions.
   - Replace `revalidatePath()` with TanStack Query invalidation and/or router invalidation.

3. **Auth/session handling**.
   - NKS uses Next cookies and redirects.
   - TanStack needs TanStack Start/server APIs or request/response cookie handling.
   - Also blocked until backend implements real session/auth mutations.

4. **Dashboard shell provider wiring**.
   - Keep TanStack’s current `DashboardShell` as owner of chrome.
   - Add only the providers truly needed by ported screens: query client already exists; add adminMeta/auth context only if route loaders/context are insufficient.

5. **GraphQL client transport**.
   - Current TanStack client uses fetch/in-process execution. Preserve that boundary.
   - Add structured errors, credentials/cookie forwarding, multipart uploads, and mutation helpers in target style rather than importing `graphql-request` unless explicitly chosen.

### Should be deferred or copied only after backend support

1. **Image/file/document upload editors**.
   - NKS views can be staged, but full behavior needs Upload scalar, multipart Yoga route, storage URL output, and image/file output types.

2. **Password/auth UI beyond display**.
   - Backend currently has password stubs. Do not claim Keystone-like auth parity until hashing/compare/auth mutations exist.

3. **AI sidebar/chat**.
   - NKS has substantial AI UI and dependencies. This is not required for Keystone dashboard CRUD parity and should be after core dashboard parity unless product priority says otherwise.

---

## 4. Backend dependencies blocking dashboard feature completion

### Hard blockers for auth-gated dashboard

- No real `authenticateUserWithPassword`, `endSession`, `authenticatedItem`, password compare/hash, or session cookie strategy. `official-keystone-parity-gap-report.md` flags auth/session primitives as missing/prototype.
- Current runtime uses a development fallback session and optional `x-cms-user-id` header. `src/features/cms/runtime.ts` notes this explicitly at lines 449-464.
- Dashboard cannot safely implement production sign-in/sign-out/access gating until backend auth/session parity exists.

### Blockers for item form parity

- NKS item data query expects `keystone.adminMeta.list(key: $listKey).fields.itemView(id: $id)` (`getItemAction.ts` lines 94-106). Current target `AdminMeta` GraphQL type exposes only `lists`; it does not expose `adminMeta.list(key:)` or item-specific `itemView(id:)`.
- Current `adminMeta` field `viewsIndex` is a string in target GraphQL (`src/features/cms/runtime.ts` declares `viewsIndex: String!`), while NKS field enhancement expects numeric `viewsIndex`. Either backend/adminMeta must provide numeric view indexes, or dashboard must rewrite registry lookup around string `kind`.
- Field metadata does not yet fully express Keystone dynamic access, dynamic required modes, conditional field modes, field hooks, field-owned input/output fragments, or item-specific visibility.

### Blockers for advanced filters/sorting

- Target runtime has basic scalar/relationship filters and orderBy generation, but official gap report says Keystone filter/order parity remains partial: missing provider-specific field-owned resolver semantics, dynamic filter/order access, unique filters beyond id, exact null semantics, and official error behavior.
- NKS `buildWhereClause()` emits many operators, including relationship empty/not_empty/some/not_some and text case-insensitive-ish mappings. Each emitted operator must be verified against `src/features/cms/runtime.ts`/adapters before enabling UI globally.

### Blockers for relationship form parity

- Target relationship input types support connect/disconnect/set for create/update, but official parity report says nested create/update/delete relationship inputs and full existence/access validation are missing.
- Inline create/edit relationship UI from NKS should be deferred until nested relationship writes and mutation hooks/access are stable.

### Blockers for image/file/document parity

- Backend image/document are JSON/stub-like. Official report says no Upload scalar input, no local/S3 storage strategy, no Keystone image/file output type, and no multipart Yoga route behavior.
- NKS image field selection expects nested image metadata (`id`, `url`, `extension`, `filesize`, `width`, `height`), while target currently outputs image/document as `JSON` in `runtime.ts` field output type behavior.

### Blockers for production mutation parity

- Current backend now has many mutations (`createMany`, `updateMany`, `deleteMany`) in `runtime.ts` lines 379-384 and resolvers lines 511-542. That removes the previous high-impact blocker from `official-keystone-parity-gap-report.md`.
- Remaining mutation blockers: hooks lifecycle, access semantics, nested writes, validation/error shape, password/image/document-specific inputs, transactions, and Prisma/codegen parity.

### Blockers for upload-capable GraphQL client

- Current TanStack dashboard client is JSON POST only (`src/features/cms/graphql-client.ts` lines 61-65). Multipart support should be added only when backend Yoga/storage supports it.

---

## 5. Ordered dashboard implementation plan after backend milestones

### Milestone 0 — Confirm backend contract baseline before UI expansion

Backend prerequisites:

- Fixed-list CRUD queries and mutations remain stable for `Todo`, `User`, `Role`, `TodoImage`.
- Many mutations are validated in memory/Prisma where applicable.
- `adminMeta` shape is stable enough for dashboard.

Dashboard work:

1. Decide and document field identity strategy:
   - Option A: make backend `viewsIndex` numeric like NKS/Keystone and copy NKS registry more directly.
   - Option B: keep string `kind` and rewrite `enhanceFields()`/registry lookup around kind.
2. Normalize list metadata into a single dashboard contract:
   - Keep array fields for rendering where useful.
   - Provide `fieldsByPath` or convert to record for NKS-compatible form utilities.
3. Add dashboard GraphQL mutation helper returning consistent `{ errors, data }` for form code.

Validation:

- `npm run lint`
- `npm run build`
- smoke query dashboard overview and one list page.

### Milestone 1 — Bring list page to NKS read parity

Implement before item forms because it is mostly UI/client-side and builds on current read path.

1. Port/adapt selected field handling:
   - URL `fields` param.
   - initialColumns fallback.
   - display-column dropdown.
2. Port/adapt sorting:
   - `sortBy` URL param.
   - `buildOrderByClause()`.
   - sort dropdown and/or sortable headers.
3. Port/adapt filters:
   - `FilterBar`, `FilterAdd`, `FilterList`.
   - `buildWhereClause()` with backend-supported operators only.
   - reset filters state.
4. Upgrade table:
   - row links to future item route.
   - field-specific cell rendering from controllers where available.
   - row selection state.
5. Wire bulk delete only after deleteMany validated.

Validation:

- List page search/filter/sort/field params survive reload.
- GraphQL variables match backend-supported where/orderBy types.
- Bulk delete invalidates correct query keys and updates counts.

### Milestone 2 — Port field registry/controllers in slices

Recommended order:

1. Scalars: `id`, `text`, `checkbox`, `integer`, `float`, `decimal`, `bigInt`, `timestamp`, `select`, `multiselect`, `json`.
2. Password display/field only after password backend behavior is clarified.
3. Relationship field display/select after relationship option queries and connect/disconnect are stable.
4. Image/document/virtual later after backend output/input parity.

Tasks:

- Add target-owned `views/registry` or `features/cms/dashboard-fields` equivalent.
- Port `enhanceFields()` adapted to target metadata.
- Port `Fields`, validation hooks, create/update serialization helpers.
- Keep dependencies minimal; add `sonner`, `react-hook-form`, Slate/Plate/document deps only when a ported field requires them.

Validation:

- Controller deserialize/serialize round trips for each supported field kind.
- Create/update mutation input matches generated GraphQL inputs.
- Hidden/read/edit modes are honored for create/item views.

### Milestone 3 — Add item detail/edit route

Backend prerequisites:

- Item query by ID works for all lists.
- Either `adminMeta.list(key:)`/`itemView(id:)` exists or dashboard has an equivalent static metadata fallback.

Dashboard tasks:

1. Add `/dashboard/$listKey/$id` route.
2. Loader fetches list metadata and item data using `list.graphql.names.itemQueryName`.
3. Build GraphQL selections from field controllers/central selection map.
4. Render form with enhanced fields.
5. Implement changed-field detection and update mutation.
6. Implement delete mutation and navigation back to list.
7. Add save/reset/delete/copy-id UX and errors/toasts.

Validation:

- Open item from list row.
- Edit scalar fields, save, and verify list/detail refetch.
- Delete item and verify redirect/count update.
- Hidden/read-only fields do not serialize edits.

### Milestone 4 — Add create route

Backend prerequisites:

- Create mutation inputs are stable.
- Required/default semantics sufficiently implemented for supported fields.

Dashboard tasks:

1. Add `/dashboard/$listKey/create` route.
2. Enable create buttons in overview/list/filter bar.
3. Use controller default values and create-view validation.
4. Serialize create data and execute `create${listKey}`.
5. Navigate to new item on success.

Validation:

- Create one item for each fixed list supported by access rules.
- Required fields show validation before submission.
- Relationship connect create values work where backend supports them.

### Milestone 5 — Relationship selectors and relationship mutations

Backend prerequisites:

- Relationship filters and connect/disconnect/set are stable.
- Relationship option list queries are access-filtered correctly.

Dashboard tasks:

1. Port relationship options query helper.
2. Port relationship select/multiselect UI, initially without inline create/edit.
3. Wire connect/disconnect/set serialization.
4. Add inline create/edit only after nested writes or drawer create flow is stable.

Validation:

- To-one and to-many fields query options, search, paginate, and serialize correct mutation inputs.
- Access restrictions do not expose forbidden related items.

### Milestone 6 — Real auth/session dashboard gating

Backend prerequisites:

- `authenticateUserWithPassword`, `endSession`, `authenticatedItem`, real password hashing/compare, cookie session strategy.
- `User.role.canAccessDashboard` or equivalent access metadata.

Dashboard tasks:

1. Rewrite NKS auth actions as TanStack Start server functions/actions.
2. Implement `/dashboard/signin`, sign-out, and authenticated dashboard loader redirects.
3. Add user profile/sidebar menu.
4. Add no-access route.
5. Add sign-up/init/reset only if backend exposes those mutations.

Validation:

- Anonymous dashboard access redirects to sign-in.
- Successful sign-in sets `keystonejs-session` cookie and returns to requested dashboard path.
- Sign-out clears cookie and invalidates router/query data.
- User without dashboard access reaches no-access.

### Milestone 7 — Upload/document/image parity

Backend prerequisites:

- Upload scalar/multipart request handling in Yoga route.
- Storage strategy and image/file output types.
- Document field JSON/renderer/editor contract.

Dashboard tasks:

1. Add multipart support to `executeDashboardGraphQL()` or a dedicated upload mutation helper.
2. Port image field UI and selections.
3. Port document editor only after dependencies and backend shape are accepted.

Validation:

- Upload image, save item, reload item/list, verify URL/metadata display.
- Document edit/save/reload round trip.

### Milestone 8 — Optional NKS-only enhancements

After core CRUD/auth parity:

- AI right sidebar/chat and related providers.
- global dashboard search command palette.
- richer error boundary and user profile UX.
- code splitting improvements for large field/document chunks.

---

## Key risks

1. **Metadata shape drift:** NKS assumes numeric `viewsIndex` and fields as records in form paths; current TanStack uses string `viewsIndex`/`kind` and fields arrays in the dashboard client.
2. **False UI parity before backend parity:** Forms can be built against current CRUD, but Keystone-like behavior will still differ until hooks/access/errors/auth/uploads are implemented.
3. **Operator mismatch:** NKS filters may emit where shapes unsupported by current target adapters. Gate/filter by supported operators.
4. **Dependency creep:** NKS includes many packages (`sonner`, `graphql-request`, `react-hook-form`, Slate/document dependencies, AI SDK, etc.). Add only when a concrete ported feature needs them.
5. **Next-specific code paths:** Any NKS file using `next/navigation`, `next/link`, `next/cache`, `next/headers`, or server actions must be rewritten, not copied blindly.
