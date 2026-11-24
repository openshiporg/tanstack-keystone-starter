# Dashboard/Admin UI parity audit: official Keystone vs this TanStack repo

Date: 2026-05-25

Scope compared:
- Official Keystone admin UI source: `/Users/junaid/code/keystone/packages/core/src/admin-ui` and `/Users/junaid/code/keystone/packages/core/src/___internal-do-not-use-will-break-in-patch/admin-ui/pages/*`
- Local TanStack dashboard: `src/routes/dashboard/*`, `src/components/dashboard/*`, `src/features/cms/graphql-client.ts`
- Supporting local artifacts reviewed: `dashboard-feature-gap-report.md`, `dashboard-visual-comparison.md`, `next-dashboard-ui-inventory.md`, `tanstack-dashboard-delta.md`, `dashboard-browser-smoke.md`

This is a gap audit, not a praise document. It focuses on unfinished or behaviorally different areas with exact file references.

---

## Executive verdict

This repo is no longer a shell-only prototype. It now has working list, create, item, auth, reset, signup, init, filtering, sorting, selectable columns, row selection, bulk delete, sidebar nav, item forms, relationship links, and a field registry.

But it is still **not at official Keystone admin UI parity**. The remaining gaps are not cosmetic; they are in contract fidelity, behavior, error semantics, conditional metadata, field/controller correctness, and advanced admin flows.

The biggest hard differences:

1. **The core admin metadata contract is still different.**
   - Official Keystone builds a `lists` record with `fields` as a keyed record plus real `viewsIndex`-driven controllers from admin meta and field view modules (`admin-ui/context.tsx:69-139`).
   - This repo normalizes into array-based `DashboardList.fields`, synthesizes `kind`, and keeps compatibility shims (`src/features/cms/graphql-client.ts:149-175`).
   - That means much of the UI is *Keystone-inspired*, not actually Keystone-contract-exact.

2. **List behavior is materially simpler and different than official Keystone’s ListPage.**
   - Official Keystone has URL + localStorage persistence, conditional action availability, action bar semantics, field-driven GraphQL filters, and proper empty-state distinctions (`.../pages/ListPage/index.tsx:157-213`, `215-255`, `286-331`, `343-522`, `524-620`).
   - This repo has URL-backed search/filter/sort/fields, but not the same filter encoding, persistence, selection/action rules, or GraphQL/controller semantics (`src/components/dashboard/filter-bar.tsx:29-208`, `src/components/dashboard/keystone-list-table.tsx:11-187`, `src/features/cms/graphql-client.ts:398-523`).

3. **Item/create forms are present, but still behaviorally shallower than Keystone.**
   - Official Keystone item pages honor runtime `itemView` overrides, conditional action modes, field modes, grouped sidebar/form layout, and error separation between GraphQL notice vs details dialogs (`.../pages/ItemPage/index.tsx:164-311`, `315-475`).
   - This repo only partially mirrors that. It merges some runtime field meta, but not action metadata, not Keystone action extensions, and not the full controller/serialization contract (`src/routes/dashboard/$listKey.$id.tsx:66-90`, `102-167`, `183-230`; `src/routes/dashboard/$listKey.create.tsx:37-116`).

4. **Auth/reset/signup/init routes exist locally, but official Keystone core admin UI does not provide equivalent built-in routes in this source tree.**
   - In practice these routes are parity against the custom starter app artifacts, not official Keystone core. That means these should not be counted as “official Keystone parity” wins.

5. **File/image/document/relationship UX is still materially below Keystone-grade behavior.**
   - The registry exists, but much behavior is fallback UI or simplified serialization rather than real Keystone field views and upload/document semantics (`src/components/dashboard/views/registry.tsx:208-374`).

---

## 1) Route surface parity

### Official Keystone
Official Keystone route templates expose home, list, item, create, and no-access pages:
- `admin-ui/templates/home.ts:1`
- `admin-ui/templates/list.tsx:1-4`
- `admin-ui/templates/item.tsx:1-4`
- `admin-ui/templates/create-item.ts:1-4`
- `admin-ui/templates/no-access.ts:1-6`

Those resolve into actual page implementations:
- `.../pages/HomePage/index.tsx:17-74`
- `.../pages/ListPage/index.tsx:257-620`
- `.../pages/ItemPage/index.tsx:313-475`
- `.../pages/CreateItemPage/index.tsx:13-70`
- `.../pages/NoAccessPage/index.tsx:1-24`

### Local TanStack
Current routes:
- Shell/auth gate: `src/routes/dashboard.tsx:18-47`
- Home: `src/routes/dashboard/index.tsx:11-115`
- List: `src/routes/dashboard/$listKey.tsx` (present; loader + page)
- Create: `src/routes/dashboard/$listKey.create.tsx:1-117`
- Item: `src/routes/dashboard/$listKey.$id.tsx:25-257+`
- Sign in: `src/routes/dashboard/signin.tsx:13-128`
- Sign up: `src/routes/dashboard/signup.tsx:17-126`
- Reset: `src/routes/dashboard/reset.tsx:13-133`
- Init: `src/routes/dashboard/init.tsx:13-113`
- No access: `src/routes/dashboard/no-access.tsx:6-42`

### Gap assessment
- **Local route surface now exceeds official Keystone core** by adding auth flows (`signin`, `signup`, `reset`, `init`) that are not part of the official admin-ui source inspected here.
- **But parity is still incomplete in behavior**, because official Keystone’s core pages are wired to the canonical metadata/controller stack; local pages are wired to a custom GraphQL client and custom field registry.
- The important conclusion: **route count parity is mostly solved; route behavior parity is not.**

---

## 2) Navigation and shell

### Official Keystone behavior
- `PageContainer` provides the page wrapper, top bar, mobile sidebar toggle, nav sidebar, and title (`admin-ui/components/PageContainer.tsx:12-115`).
- `Navigation` renders Dashboard + visible lists, selected-state behavior based on path, and developer resources (`admin-ui/components/Navigation.tsx:31-110`).
- Home/list/item/create pages all rely on this common shell.

### Local TanStack behavior
- Shell route decides whether to render standalone auth screens or the dashboard shell (`src/routes/dashboard.tsx:36-46`).
- `DashboardShell` fetches overview data and passes user/lists into layout (`src/components/dashboard/dashboard-shell.tsx:7-18`).
- `DashboardLayout` adds left sidebar plus an always-present right AI sidebar/floating AI button (`src/components/dashboard/dashboard-layout.tsx:32-49`).
- `DashboardSidebar` renders Dashboard plus a hardcoded always-open Models `<details>` group and an icon-mode dropdown (`src/components/dashboard/dashboard-sidebar.tsx:38-137`).
- `PageContainer` and `PageBreadcrumbs` add left and right sidebar triggers (`src/components/dashboard/page-container.tsx:20-65`, `src/components/dashboard/page-breadcrumbs.tsx:20-53`).

### Material differences
1. **Navigation state model differs.**
   - Official Keystone uses simple nav items and current-page logic (`Navigation.tsx:20-57`).
   - Local sidebar is a custom two-mode component with always-open Models details (`dashboard-sidebar.tsx:74-100`), which is not Keystone behavior.

2. **Right sidebar/AI affordance is non-Keystone.**
   - Official Keystone core here has no AI sidebar in admin-ui.
   - Local `DashboardLayout` forces `RightSidebar` and a floating chat button (`dashboard-layout.tsx:42-46`). That is extra UI, not parity.

3. **Double sidebar triggers are added to page headers.**
   - `PageContainer` and `PageBreadcrumbs` both render a right-side `SidebarTrigger` (`page-container.tsx:55-57`, `page-breadcrumbs.tsx:46-48`), which is outside official Keystone’s shell model.

4. **Developer resources menu parity is missing.**
   - Official nav includes API explorer/docs/community links in development (`Navigation.tsx:73-110`).
   - Local shell has no equivalent in sidebar navigation; it is only partially surfaced via user menu GraphQL API link (`src/components/dashboard/user-profile.tsx:54-71`).

5. **Page title/document title handling differs.**
   - Official `PageContainer` sets `<title>` via `NextHead` (`PageContainer.tsx:80-88`).
   - Local page containers do not set document titles.

Bottom line: **navigability exists, but shell behavior is not Keystone-identical.**

---

## 3) Admin metadata and controller contract

This is still the most important parity problem.

### Official Keystone contract
- Admin meta query includes fields, actions, groups, GraphQL names, initial list config, singleton flags, and visibility flags (`admin-ui/admin-meta-graphql.ts:5-134`).
- `KeystoneProvider` transforms `listsData` into a keyed `lists` object and a keyed `fields` object per list, then attaches concrete views + controller instances by numeric `viewsIndex` (`admin-ui/context.tsx:61-139`).
- It also expands custom views and field groups (`context.tsx:79-135`).

### Local TanStack contract
- `normalizeAdminMeta()` maps raw admin meta into array-based `DashboardList.fields` and injects `kind: String(field.fieldMeta.kind || field.viewsIndex)` (`src/features/cms/graphql-client.ts:149-175`).
- `enhanceFields()` only enhances fields when `typeof field.viewsIndex === 'number'` (`src/components/dashboard/enhance-fields.tsx:30-39`).
- `views/registry.tsx` chooses behavior by `field.kind` or `viewsIndex`, but many behaviors are synthesized locally (`src/components/dashboard/views/registry.tsx:346-374`).

### Material differences
1. **Field storage shape differs.**
   - Official: `list.fields` is a record keyed by field key (`context.tsx:72-127`).
   - Local: `list.fields` is an array with a secondary `fieldMap` (`graphql-client.ts:166-171`).
   - This creates persistent translation/adaptation logic everywhere.

2. **Kind inference is synthetic.**
   - Official relies on real view modules keyed by `viewsIndex` and optionally custom views (`context.tsx:79-125`).
   - Local synthesizes `kind` from `fieldMeta.kind` or `viewsIndex` stringification (`graphql-client.ts:157-163`).
   - If a field’s true runtime behavior diverges from this mapping, the UI will silently drift.

3. **Conditional metadata support is partial.**
   - Official item/list pages use action and field conditional filters deeply (`utils/filters.ts:40-145`; `pages/ItemPage/index.tsx:336-398`; `pages/ListPage/index.tsx:367-522`).
   - Local only partially uses runtime item view overrides (`fetchDashboardItemPage()` and item page merge logic at `graphql-client.ts:525-580`, `src/routes/dashboard/$listKey.$id.tsx:66-80`).
   - Local does **not** merge runtime action metadata from `adminMeta.list.actions` into the item page the way official Keystone does.

4. **Controller API is not the Keystone controller API.**
   - Official field controllers expose richer capabilities including `graphql`, parse/serialize/filter contracts used directly by ListPage and ItemPage.
   - Local `FormFieldController` is a homegrown subset: `graphqlSelection`, `defaultValue`, `deserialize`, `serialize`, `validate`, optional `filter` (`views/registry.tsx:37-47`).
   - That is enough to render forms, but not enough for true parity.

Bottom line: **local UI is running on a compatibility layer, not the real Keystone admin contract.**

---

## 4) Home/dashboard page parity

### Official Keystone
- Home queries list counts dynamically from visible lists (`.../HomePage/index.tsx:17-38`).
- It renders visible list cards linking to list or singleton item and a create affordance (`HomePage/index.tsx:39-74`, `76-134`).

### Local TanStack
- Home preloads overview via query client and renders cards from `fetchDashboardOverview()` (`src/routes/dashboard/index.tsx:11-55`).
- It handles singleton links and create links (`index.tsx:57-105`).
- Overview counting is done via generated count selections and singleton probes (`src/features/cms/graphql-client.ts:214-244`).

### Gaps
1. **Local home card styling/semantics are custom, not Keystone.**
   - Official uses `CardLink` with full-card click target and an icon-only create action (`HomePage/index.tsx:102-183`).
   - Local uses generic `Card` + `Link` and a visible button class stack (`src/routes/dashboard/index.tsx:60-103`).

2. **No integrated GraphQLError notice on home.**
   - Official shows `GraphQLErrorNotice` for both meta and counts (`HomePage/index.tsx:50-52`).
   - Local home has no equivalent surfaced error treatment.

3. **Singleton “create” handling differs.**
   - Official home links singleton cards to `/path/1` directly (`HomePage/index.tsx:113-116`).
   - Local branches into “Create singleton” copy but still links to item route (`index.tsx:62-77`), relying on item page fallback behavior instead of the simpler official card behavior.

This is a smaller gap area than list/item pages, but still not exact.

---

## 5) List page behavior

### Official Keystone list behavior
Key list mechanics live in `.../pages/ListPage/index.tsx`:
- Parse filters from URL and initial filter: `157-213`
- Parse sort: `215-236`
- Parse page/pageSize/columns: `238-255`
- Restore from localStorage + URL: `286-301`
- Persist list state back to URL + localStorage: `303-332`
- Build where clauses from field controllers: `343-352`
- Build search via field search helpers: `358-418`
- Pull action-dependent field keys into query selection: `364-377`
- Constrained empty-state logic, sortable headers, selection, action bar, pagination, action dialogs: `421-620`

### Local TanStack list behavior
- Route validates `page`, `pageSize`, `search`, `sortBy`, `fields` (`src/routes/dashboard/$listKey.tsx` loader/search config).
- `fetchDashboardListPage()` builds selected fields, where, orderBy, and query (`src/features/cms/graphql-client.ts:470-523`).
- `FilterBar` manages search, filter popover, sort dropdown, and columns selection (`src/components/dashboard/filter-bar.tsx:29-260+`).
- `KeystoneListTable` manages selection, row rendering, row links, and bulk delete (`src/components/dashboard/keystone-list-table.tsx:11-347`).
- `Pagination` renders floating pager and delete action bar (`src/components/dashboard/pagination.tsx:27-200`).

### Material list gaps

#### 5.1 URL/filter encoding is not Keystone-compatible
- Official Keystone uses repeated `filter` params in `field_filterType[_json]` format (`ListPage/index.tsx:157-213`, `303-323`).
- Local uses arbitrary search keys prefixed with `!${fieldPath}_${type}` (`filter-bar.tsx:25-27`, `52-67`, `90-115`).
- This is a direct behavior difference. Shared URLs/bookmarks are not compatible.

#### 5.2 LocalStorage list-state persistence now exists, but is still partial parity
- Official restores and persists list UI state in localStorage (`ListPage/index.tsx:261-332`).
- Local now persists and restores per-list search/sort/fields/page/pageSize/filter state via `src/components/dashboard/filter-bar.tsx` and `src/components/dashboard/list-state-persistence.ts`, with URL params still winning over stored state.
- Remaining gap: local persistence still does not cover full official list-page state/action semantics, and the URL encoding remains custom.

#### 5.3 Search semantics differ
- Official uses field-driven search logic via `useSearchFilter(searchString, list, list.initialSearchFields)` (`ListPage/index.tsx:358`).
- Local `buildWhere()` only treats search fields of kind `text` and `select`, and uses simple `{ contains: trimmed }` conditions plus exact ID (`graphql-client.ts:398-411`).
- This is materially less expressive and may not match field-level search implementations.

#### 5.4 Filter semantics are simplified and drift-prone
- Official delegates filter GraphQL generation to field controllers: `field.controller.filter!.graphql(...)` (`ListPage/index.tsx:343-352`).
- Local hardcodes per-kind filter translation in `filterWhereForField()` (`graphql-client.ts:324-396`) and hardcodes UI filter types in `views/registry.tsx:126-185`.
- Any field-specific custom filter logic from official Keystone/custom field views is lost.

#### 5.5 Selected columns behavior differs
- Official columns are represented as repeated `column` params (`ListPage/index.tsx:250-255`, `303-307`).
- Local stores a comma-separated `fields` param (`filter-bar.tsx:77-80`; `graphql-client.ts:255-266`).
- Again, URL behavior is not parity.

#### 5.6 No action-metadata-based list action system
- Official computes available actions from `list.actions`, conditional filter field keys, disabled keys, and the action bar (`ListPage/index.tsx:354-377`, `459-522`, `602-620`).
- Local only supports implicit bulk delete when `hideDelete` is false (`keystone-list-table.tsx:17-43`, `177-185`; `pagination.tsx:89-121`).
- Custom list actions from metadata are ignored.

#### 5.7 Table empty states are shallower
- Official has separate loading / no results / empty list states in `TableView.renderEmptyState()` (`ListPage/index.tsx:612-620`).
- Local distinguishes filtered empty vs base empty, but only with custom static cards (`keystone-list-table.tsx:45-85`).
- It lacks official integrated loading semantics and does not leverage table-level accessibility patterns.

#### 5.8 Bulk delete error handling is weaker
- Official bulk actions map GraphQL path-indexed errors back to specific items and provide a details dialog (`ListPage/index.tsx:524-620`).
- Local `deleteSelectedItems()` treats failure as one message string and loses per-item error resolution (`keystone-list-table.tsx:31-43`).

#### 5.9 Conditional action availability is missing
- Official disables/hides actions per selected-row conditional filters (`ListPage/index.tsx:493-522`).
- Local has no such concept for bulk actions or row actions.

#### 5.10 Table implementation is custom, not Keystone’s accessible table stack
- Official uses `@keystar/ui/table` with built-in sorting/selection semantics (`ListPage/index.tsx:22-30`, `602-620`).
- Local uses plain `<table>` with custom controls (`keystone-list-table.tsx:91-176`).
- Accessibility/keyboard parity is therefore not guaranteed.

---

## 6) Sorting

### Official Keystone
- Sort parsing and fallback come from URL or `list.initialSort` only (`ListPage/index.tsx:215-236`).
- Sorting is table-native through `TableView` and `Column` sorting props (`ListPage/index.tsx:603-611`).

### Local TanStack
- Sort selection UI is custom (`filter-bar.tsx:217-260+`).
- Table headers also toggle sort directly (`keystone-list-table.tsx:191-230`).
- Sort fallback logic is custom and opinionated: if no explicit/initial sort, it prefers `createdAt`, `updatedAt`, `timestamp`, `date`, then `id`, and uses descending except for `id` (`graphql-client.ts:440-467`).

### Gap
- **This fallback behavior is not Keystone parity.** Official Keystone does not impose this custom heuristic fallback from inspected source.
- Sort UX is duplicated in two places (dropdown + header) and can drift.
- URL encoding (`-field`) is compatible enough conceptually, but the fallback semantics are not.

---

## 7) Filtering

### Official Keystone
- Filter types and GraphQL output are field-controller-owned (`ListPage/index.tsx:165-171`, `343-352`).
- Empty/not_empty special cases are treated explicitly in UI (`64-155`, `309-320`).

### Local TanStack
- Filter UI also has special handling for needsValue false and editable pills (`filter-bar.tsx:90-115`, `185-207`).
- But actual semantics are split across `views/registry.tsx` and `graphql-client.ts`.

### Gaps
1. **Field-specific filter behavior is not source-of-truth-driven.**
2. **Relationship filters are simplified to ID-based filtering and custom option UI, not official field controller behavior.**
3. **Document filters are simplistic (`contains`, `not_contains`, `is_empty`) and likely only approximate official semantics.**
4. **No compatibility with official `filter` URL params.**

---

## 8) Pagination

### Official Keystone
- Parses `page` and `pageSize` with snapping to supported sizes (`ListPage/index.tsx:238-247`).
- Uses `PaginationControls` integrated with count, singular/plural labels, and table state (`ListPage/index.tsx:624+ via component usage at 672-ish; `PaginationControls` import at line 54).

### Local TanStack
- `Pagination` is a custom floating pill with page number input, page size dropdown, plus/minus adjusters, and bulk delete state (`src/components/dashboard/pagination.tsx:27-200`).

### Gaps
- **UI and behavior are still custom rather than Keystone.**
- Local now snaps page sizes onto a constrained supported set (`10, 25, 50, 100`) through shared helpers in `src/components/dashboard/page-size.ts`, which is materially closer to official behavior.
- Local still shows delete action bar inside the pagination component, while official separates selection action bar from pagination.

---

## 9) Create flow

### Official Keystone
- `CreateItemPage` uses `useCreateItem(list)` and renders official `Fields` with proper required validation and unsaved-change handling (`.../CreateItemPage/index.tsx:17-70`).
- `useCreateItem()` handles default state, invalid fields, mutation, cache behavior, navigation prevention, and success toast/action (`admin-ui/utils/useCreateItem.ts:17-109`).

### Local TanStack
- Create route loads list, rejects singleton/hideCreate cases, enhances fields, computes invalid fields, runs GraphQL mutation, and navigates to item route (`src/routes/dashboard/$listKey.create.tsx:1-117`).

### Material gaps
1. **Unsaved create form navigation guard is now present.**
   - Official `useCreateItem()` integrates navigation prevention (`useCreateItem.ts:56-71`).
   - Local create route now uses `usePreventNavigation(...)`, so this specific gap is closed.

2. **No full Keystone GraphQL notice/details dialog model yet, but error handling is stronger than before.**
   - Official uses `GraphQLErrorNotice` and richer error handling (`CreateItemPage/index.tsx:57-60`).
   - Local now uses raw GraphQL execution plus shared error-detail helpers, and can render message + details inline on create/item routes. It still lacks the full official details-dialog/notice system.

3. **Mutation payload cleanup is custom and lossy.**
   - Local drops `undefined`, `null`, and empty string wholesale before mutation (`$listKey.create.tsx:59-62`).
   - That can break legitimate explicit null writes or empty-string semantics for fields where Keystone would preserve them.

4. **Create success UX is no longer thinner in this specific area.**
   - Official success flow includes a “Create another” toast action via `useCreateItem()` (`useCreateItem.ts:96-105`).
   - Local now includes a “Create another” toast action as well, so this gap is closed.

5. **Singleton create is handled via item-page fallback rather than first-class create flow.**
   - See `SingletonCreateForm` in `src/routes/dashboard/$listKey.$id.tsx:244+`.
   - This works, but it is not official Keystone behavior.

---

## 10) Item/edit/delete flow

### Official Keystone
- Item loading and metadata come from `useListItem()` query plus runtime `adminMeta.list(...).fields/actions` info (`admin-ui/context.tsx:227-260+`, `ItemPage/index.tsx:315-398`).
- Item form uses official `Fields`, invalid field calculation, change detection, save mutation, reset confirmation, delete confirmation, and details dialogs (`ItemPage/index.tsx:164-311`).
- Not-found messaging differs for singleton vs normal items (`ItemPage/index.tsx:433-457`).

### Local TanStack
- Item loader fetches list and item page data (`src/routes/dashboard/$listKey.$id.tsx:25-46`).
- `fetchDashboardItemPage()` queries item plus runtime field itemView metadata (`src/features/cms/graphql-client.ts:525-580`).
- Item route merges field metadata, builds draft state, save/delete/reset/copy-id UI, and singleton missing-item create fallback (`$listKey.$id.tsx:66-257+`).

### Material gaps
1. **No runtime action metadata merge.**
   - Official merges `adminMeta.list.actions` and resolves conditional item actions (`ItemPage/index.tsx:336-398`).
   - Local item page ignores runtime actions entirely. Only built-in Reset/Save/Delete are shown (`$listKey.$id.tsx:183-215`).

2. **Change detection is shallow/wrong for complex values.**
   - Official uses `useHasChanges()` and proper operation-aware diffing (`ItemPage/index.tsx:239`).
   - Local compares `draft[fieldPath] !== currentDraft[fieldPath]` (`$listKey.$id.tsx:89`).
   - That fails for arrays/objects/relationship values unless references are stable.

3. **Update serialization is only per-field current vs draft, not operation-aware.**
   - Official uses `serializeValueToOperationItem('update', list.fields, value, initialValue)` (`ItemPage/index.tsx:213-217`).
   - Local hand-builds `updateData` by skipping unchanged refs and serializing field-by-field (`$listKey.$id.tsx:109-120`).
   - This is much more fragile.

4. **GraphQL error handling is still below official parity, but no longer summary-only.**
   - Official separates field-level/main GraphQL errors and gives details dialog on critical failures (`ItemPage/index.tsx:220-229`, `251-257`, `306-308`).
   - Local now uses raw GraphQL execution and preserves inline detail strings for create/update/delete flows, but it still lacks the official details dialog and field-level mapping model.

5. **Reset confirmation is now present.**
   - Official reset requires explicit confirmation dialog (`ItemPage/index.tsx:145-161`).
   - Local item route now also confirms reset before discarding changes, so this gap is closed.

6. **Delete error handling remains weaker than official, but now preserves detail strings.**
   - Official delete can surface error details dialog (`ItemPage/index.tsx:62-123`).
   - Local now preserves inline error detail text for delete failures, but it still lacks the richer dialog treatment.

7. **Missing action extension system.**
   - Official item header can expose list-defined actions beyond delete/save/reset (`ItemPage/index.tsx:412-425`).
   - Local cannot.

8. **Singleton missing-item UX differs.**
   - Official singleton missing item can show create button via not-found card (`ItemPage/index.tsx:437-442`).
   - Local inlines a dedicated create form inside item route (`$listKey.$id.tsx:175-177`, `244+`).

---

## 11) Singleton handling

### Official Keystone
- Home and item flows treat singleton lists specially via `/path/1` routing and item not-found/create affordances (`HomePage/index.tsx:113-116`, `ItemPage/index.tsx:437-449`).

### Local TanStack
- Home computes `singletonItemId` by querying first list item (`graphql-client.ts:224-241`).
- Home card links to `/dashboard/$listKey/$id` with `id: '1'` for singleton cases (`src/routes/dashboard/index.tsx:62-77`).
- Create route redirects singleton lists to the item route (`src/routes/dashboard/$listKey.create.tsx:17-23`).
- Item route offers `SingletonCreateForm` when `id === '1'` and item is missing (`$listKey.$id.tsx:175-177`, `244+`).

### Gap
- This is serviceable but still **not the same behavior shape** as official Keystone. The local approach depends on a custom “pretend singleton ID is 1” fallback and custom form injection.

---

## 12) Toasts and feedback

### Official Keystone
- Uses `toastQueue` from Keystar throughout list/item/create flows (`ListPage/index.tsx:31`, `558-620`; `ItemPage/index.tsx:20`, `95-105`, `224-234`; `useCreateItem.ts:85-105`).
- Has `GraphQLErrorNotice` and details dialogs for rich feedback.

### Local TanStack
- Uses `useToast()` and inline message banners in item/create pages (`$listKey.$id.tsx:52`, `98-100`, `125-130`, `154-163`, `226`; `$listKey.create.tsx:30`, `73-79`, `110`).

### Gap
- **Feedback is still thinner than official, but it is no longer uniformly shallow.**
- There is still no structured details dialog for failed mutations.
- There is still no official-style global GraphQL notice on item/create routes.
- Local bulk delete now preserves partial-success counts and per-item failure detail strings, reducing one of the earlier sharp gaps.

---

## 13) Auth flows

### Important scope note
The official Keystone core admin-ui source inspected here does **not** include sign-in/signup/reset/init pages in this tree. Those flows are outside the core admin-ui pages being compared. So local auth pages should be judged mainly as custom-dashboard parity, not official Keystone parity.

### Local TanStack auth behavior
- Shell gating/redirects: `src/routes/dashboard.tsx:18-47`
- Sign in mutation: `signin.tsx:46-66`
- Sign up flow: create user then authenticate (`signup.tsx:46-66`)
- Reset flows: send link or redeem token (`reset.tsx:38-64`)
- Init flow: `createInitialUser` (`init.tsx:39-55`)
- No-access page: `no-access.tsx:10-40`

### Material issues even within local auth
1. **Redirect/auth model is custom and browser-driven.**
   - `window.location.assign(...)` after signin/init (`signin.tsx:65`, `init.tsx:54`) instead of consistent router/server redirect semantics.

2. **Sign-up auth success does not explicitly handle session persistence.**
   - It assumes the GraphQL authentication side effect is enough, then `navigate('/dashboard')` (`signup.tsx:54-66`).

3. **Error handling is string-only.**
   - No structured field errors, no toast region parity, no server-side invalidation semantics.

4. **No evidence of official Keystone session UI semantics in shell.**
   - Local sign-out exists in user profile menu (`src/components/dashboard/user-profile.tsx:85-88`), but that is custom, not official admin-ui parity.

---

## 14) Init flow

### Official Keystone core
- No equivalent built-in page found in the inspected official core admin-ui source.

### Local TanStack
- `src/routes/dashboard/init.tsx:13-113`

### Gap assessment
- Not an official Keystone parity target from this source set.
- Within the local implementation, it is basic and lacks the richer admin metadata/config checks or error detail treatment expected from a mature admin UI.

---

## 15) Field rendering, controllers, and views

### Official Keystone
- `Fields` handles conditional field modes, grouping, first-field autofocus, position splitting, and required-state resolution (`admin-ui/utils/Fields.tsx:22-145`).
- Conditional filter resolution helpers live in `admin-ui/utils/filters.ts:40-145`.
- Provider wiring attaches real field views/controllers from `fieldViews[field.viewsIndex]` (`admin-ui/context.tsx:79-125`).

### Local TanStack
- `enhanceFields()` validates base view exports and custom views (`src/components/dashboard/enhance-fields.tsx:28-85`).
- `EnhancedFormFields` handles grouping, visibility, validation, and render regions (`src/components/dashboard/enhanced-form-fields.tsx:23-158`).
- `views/registry.tsx` defines synthesized controller/filter/cell behavior and maps kinds to local view modules (`registry.tsx:49-374`).

### Material gaps
1. **Controllers are reimplemented, not reused from official Keystone.**
2. **Validation contract is simplified.**
   - Official uses per-field controller validate/serialize logic tied to actual field view modules and operation context.
   - Local `validateDraftValue()` plumbing is custom and only surfaced through local controller wrappers.

3. **Field groups and positions are approximated.**
   - Official only applies `position` filtering for item view and leaves create view as form-only (`Fields.tsx:53-61`).
   - Local supports sidebar/form grouping in create and item routes through its own `field-form-layout` grouping, which may diverge from official grouping semantics.

4. **Fallback registry behavior can mask mismatches.**
   - `getFieldViews()` falls back to a generic `RegistryField` and generic `Cell` (`registry.tsx:364-373`).
   - That keeps the UI running, but hides missing true field parity.

5. **Custom field views contract is weaker.**
   - Official custom views can replace controller/Field and preserve allowed exports at provider time (`context.tsx:88-101`).
   - Local does something similar in `enhanceFields()`, but against a much smaller controller/view contract (`enhance-fields.tsx:41-81`).

Bottom line: **field parity is partial. The local system is broad, but not truly Keystone-grade.**

---

## 16) Relationship UX

### Official Keystone
- List filtering and search can incorporate relationship controller behavior (`ListPage/index.tsx`, `useSearchFilter` integration at line 358).
- Item and create pages depend on actual relationship field views/controllers from official field view modules.
- Row links use `Row href={`/${list.path}/${row?.id}`}` in official table (`ListPage/index.tsx:641-657` region in full file).

### Local TanStack
- Relationship filters exist with custom `RelationshipFilterInput` and ID-based filters (`views/registry.tsx:99-124`; `graphql-client.ts:357-367`, `583-635`).
- Relationship cells render chips/links in list table (`keystone-list-table.tsx:267-316`; `views/registry.tsx:310-344`).
- Item/create forms can render relationship editors through local registry modules, but behavior is custom.

### Material gaps
1. **Relationship filtering is ID-centric and custom.**
2. **No evidence of full Keystone relationship field behavior such as richer inline affordances, custom controller serialization parity, or action-aware option restrictions.**
3. **Relationship option querying is custom helper logic (`fetchDashboardRelationshipOptions*`) rather than official field/controller ownership.**
4. **Potential change-detection bugs on relationship arrays/objects due to shallow equality in item route (`$listKey.$id.tsx:89`).**

---

## 17) Document / image / file behavior

### Official Keystone indicators
- Official admin meta and field controller system are designed to attach true field views by `viewsIndex` (`context.tsx:79-125`).
- The official core here also configures upload-capable Apollo transport via `apollo-upload-client` (`admin-ui/context.tsx:189-205`).

### Local TanStack
- GraphQL execution is JSON POST only in browser (`src/features/cms/graphql-client.ts:121-126`).
- `views/registry.tsx` has custom modules for `image`, `file`, `document`, but fallback controller behavior still serializes these through local draft parsing (`registry.tsx:208-228`, `346-358`).
- Generic complex objects often collapse to “Complex data” in cells (`registry.tsx:291-295`; `keystone-list-table.tsx:282`).

### Material gaps
1. **No multipart upload transport parity.**
   - Official uses `UploadLink` (`admin-ui/context.tsx:189-205`).
   - Local does not.

2. **List cells for complex document/image/file values are simplified or opaque.**
3. **Any true Keystone upload/document editing semantics are not demonstrated by the inspected local code.**
4. **GraphQL transport cannot currently support real file uploads the way official Keystone admin client can.**

This remains a major parity hole.

---

## 18) Validation and errors

### Official Keystone
- `Fields` drives `forceValidation` and invalid field sets (`Fields.tsx:27-48`, `67-87`).
- Item/create hooks use `useInvalidFields`, `useHasChanges`, and operation-aware serialization (`ItemPage/index.tsx:204-239`; `useCreateItem.ts:41-84`).
- Error handling distinguishes GraphQL notices, toast summaries, and error details dialogs.

### Local TanStack
- Validation goes through `invalidFieldsForValues()` and local controller `validate()` (`enhanced-form-fields.tsx:56-68`).
- Create/item pages surface a single inline message and toast on failure.

### Gaps
1. **No field-specific GraphQL error mapping.**
2. **No details dialog for mutation failures.**
3. **Potentially incorrect “has changes” logic for non-primitives.**
4. **Create mutation sanitization drops explicit null/empty values.**
5. **Bulk delete now preserves per-record failure detail, but still lacks a full details dialog UI.**

---

## 19) Keyboard and accessibility

### Official Keystone
- Uses Keystar/React Aria primitives heavily: `TableView`, `MenuTrigger`, `DialogTrigger`, `SearchField`, `ActionBar`, `FieldButton`, etc. (`ListPage/index.tsx`, `Fields.tsx`, `PageContainer.tsx`).
- These components provide a large amount of keyboard and ARIA behavior out of the box.

### Local TanStack
- Uses plain HTML tables, custom dropdowns/popovers, and ad hoc button/link composition in many places (`keystone-list-table.tsx`, `filter-bar.tsx`, `page-container.tsx`).

### Material gaps
1. **Table keyboard semantics are almost certainly below official parity.**
   - Plain `<table>` with custom checkboxes and links is not the same as `TableView`.

2. **Filter/search/sort composition is less standardized.**
   - Official uses accessible Keystar primitives for menus/search/table selection.
   - Local mixes custom triggers, raw `<select>`, and generic inputs.

3. **Reset/delete confirmations differ in focus/interaction behavior.**
   - Official reset uses a confirmation dialog; local reset does not.

4. **Page header breadcrumbs are hidden on mobile in `PageBreadcrumbs` (`page-breadcrumbs.tsx:27`), which may reduce orientation compared to the official shell.**

There is not enough evidence here to claim accessibility parity.

---

## 20) No-access page

### Official Keystone
- Very simple error container with shield icon and explanatory copy (`.../NoAccessPage/index.tsx:1-24`).

### Local TanStack
- Custom access denied card with go-back and home buttons (`src/routes/dashboard/no-access.tsx:10-40`).

### Gap
- Functional but not parity. Different layout, copy, actions, and no shared official error container semantics.

---

## 21) Specific high-risk implementation mismatches

These are the places most likely to cause subtle parity bugs even when the screen “looks done”:

1. **Custom fallback sort heuristic**
   - `src/features/cms/graphql-client.ts:440-467`
   - Not official behavior.

2. **Custom filter query-param shape**
   - `src/components/dashboard/filter-bar.tsx:25-27`, `90-115`
   - Not compatible with official Keystone URLs.

3. **Shallow item change detection**
   - `src/routes/dashboard/$listKey.$id.tsx:89`
   - Wrong for arrays/objects/relationship values.

4. **Dropping null/empty values on create**
   - `src/routes/dashboard/$listKey.create.tsx:59-62`
   - Behaviorally dangerous.

5. **No upload-capable GraphQL client**
   - Official: `admin-ui/context.tsx:189-205`
   - Local: `src/features/cms/graphql-client.ts:121-126`

6. **Local controller/filter logic hardcoded by kind instead of field view modules**
   - `src/components/dashboard/views/registry.tsx:49-228`
   - `src/features/cms/graphql-client.ts:300-396`

7. **No runtime item action metadata support**
   - Official: `ItemPage/index.tsx:336-398`
   - Local: absent from item page.

---

## 22) Bottom-line parity status by area

| Area | Verdict |
|---|---|
| Route coverage | Mostly present locally, but behavior still diverges from official Keystone core. |
| Navigation/shell | Partial parity only; custom sidebar/right-sidebar model diverges. |
| Home page | Close in capability, not exact in behavior/error handling. |
| List page basic read | Present. |
| Filtering | Present but not Keystone-compatible in URL/contract semantics. |
| Sorting | Present but with non-Keystone fallback heuristics. |
| Search | Present but simplified vs official field-driven behavior. |
| Pagination | Present but custom, not Keystone-standard. |
| Bulk selection/delete | Present but much weaker error/action semantics. |
| Create flow | Present but thinner validation/error/navigation behavior. |
| Item edit/delete | Present but weaker diffing, metadata, actions, and error handling. |
| Singleton handling | Present but custom and not true official parity. |
| Field controllers/views | Broadly present, still not official contract parity. |
| Relationship UX | Partial only. |
| Document/image/file | Not at parity. Major gap. |
| Validation/errors | Not at parity. |
| Keyboard/accessibility | Not at parity; likely materially weaker. |
| Auth/reset/signup/init | Local-only feature surface; not official Keystone core parity target here. |
| No-access page | Functional, not parity. |

---

## 23) Final verdict

If the question is **“does this dashboard now have the same practical surface area as the official Keystone admin UI?”**, the answer is **not yet**.

If the question is **“is the missing work now mostly edge polish?”**, also **no**.

The remaining parity debt is concentrated in the most important admin-ui behaviors:
- exact metadata/controller contract fidelity
- field-owned filtering/search/serialization semantics
- robust list action semantics
- operation-aware item diffing and validation
- rich mutation error handling
- upload/document/file support
- accessibility behavior that comes for free in the official Keystar/React Aria stack but is custom here

The local dashboard is now broad enough to look complete at a glance. It is **not** Keystone-parity-complete under hard scrutiny.