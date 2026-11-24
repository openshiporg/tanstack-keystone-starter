# Dashboard parity audit 05: relationships, singletons, navigation, and error-state flows

## Scope
Compared `/Users/junaid/code/tanstack-keystone-starter` against `/Users/junaid/code/next-keystone-starter` for:

- relationship field editor
- relationship filter input
- selected-option hydration
- singleton canonical `/1` behavior
- create redirects
- missing singleton UX
- breadcrumbs / page container / navigation
- not-found / error / no-access flows

## Audit notes
- `plan.md` was not present in the TanStack repo at audit time.
- `progress.md` indicates recent item/create hardening work.
- `npm run build` passes in `tanstack-keystone-starter`.
- I did **not** find targeted dashboard tests covering these flows in either repo, so all conclusions below are code-path based.

## Executive summary

### Highest-priority parity gaps
1. **P0 – Missing item/singleton routes are broken by an undefined component reference** in the TanStack item route, so the intended missing-singleton and item-not-found UX never runs.
2. **P1 – Relationship editor/filter option loading ignores field-specific relationship metadata** (`refLabelField`, `refSearchFields`) that the Next baseline uses, so search behavior and displayed labels can diverge.
3. **P1 – Editing an existing many-relationship filter corrupts the selection shape** in TanStack by converting an ID array into a single comma-joined string.
4. **P2 – Relationship field editor is functionally simpler than the Next baseline**: no inline create drawer and no “view related list” flow for many relationships.
5. **P3 – Sidebar model navigation is less feature-complete**: the TanStack sidebar shows the Models section permanently expanded instead of using the collapsible section used in Next.

### Areas that are already at/near parity
- Singleton cards on the dashboard home route link to canonical `/1` paths in both repos.
- Visiting a singleton `create` route redirects to canonical `/1` in TanStack.
- TanStack already hydrates selected relationship chips by ID in both the editor and filter input.
- Breadcrumb/page-container infrastructure exists and is wired on dashboard/list/create/item routes.
- No-access and top-level error boundary flows are present and largely aligned.

---

## Detailed findings

### P0 — Missing singleton / missing item flow is currently broken in TanStack
**Impact:** The most important singleton parity path is not actually reachable. If the item payload is missing, TanStack attempts to render an undefined component before it can show either the singleton-create UI or the normal not-found UI.

#### Evidence in TanStack
- `src/routes/dashboard/$listKey.$id.tsx:85` returns `<MissingSingletonItem data={data} />` immediately when `!item`.
- `src/routes/dashboard/$listKey.$id.tsx:155-163` contains the *actual* missing-item branches that should handle:
  - singleton `/1` missing item -> singleton create / missing singleton message
  - non-singleton missing item -> “Item not found.”
- `grep` found **no definition** of `MissingSingletonItem`; the only hit is the usage at `src/routes/dashboard/$listKey.$id.tsx:85`.
- Because the undefined component is returned first, the later branches at `:157-163` and the explicit missing-singleton message at `:216-223` are effectively dead code.

#### Next baseline
- `features/dashboard/screens/ItemPage/ItemPageClient.tsx:400-424` explicitly handles missing items inline:
  - singleton `/1` missing -> message + create button (`:405-413`)
  - other missing item -> not-found copy (`:416-421`)

#### Why this is priority P0
This directly breaks the audit’s requested singleton parity area:
- missing singleton UX
- canonical `/1` behavior when the singleton does not yet exist
- item not-found handling

This is the single most important dashboard parity blocker I found.

---

### P1 — Relationship option loading drops `refSearchFields` and `refLabelField`
**Impact:** The TanStack relationship editor/filter can resolve the correct related list, but it does **not** honor field-specific search-field and label-field metadata the way the Next baseline does. That creates mismatched search results and labels for relationships whose field config overrides the related list defaults.

#### Evidence in TanStack editor/filter components
- `src/components/dashboard/relationship-field-editor.tsx:37-64`
  - resolves related list path correctly
  - fetches options through `fetchDashboardRelationshipOptions({ listKey: resolvedListKey, search, ... })`
  - fetches hydrated selections through `fetchDashboardRelationshipOptionsByIds({ listKey: resolvedListKey, ids })`
- `src/components/dashboard/views/relationship-filter-input.tsx:35-52`
  - same pattern for filter input

#### Evidence in TanStack data layer
- `src/features/cms/graphql-client.ts:562-577`
  - `fetchDashboardRelationshipOptions()` always uses `list.labelField` (fallback `id`) for labels
- `src/features/cms/graphql-client.ts:590-602`
  - `fetchDashboardRelationshipOptionsByIds()` also always uses `list.labelField`
- `src/features/cms/graphql-client.ts:371-383`
  - search behavior comes from `buildWhere(list, search)` using `list.initialSearchFields`
  - there is no use of `field.fieldMeta.refSearchFields`

#### Next baseline
- `features/dashboard/views/relationship/client/Field.tsx:173-176` passes field-specific metadata into the relationship select:
  - `labelField={field?.refLabelField ?? 'id'}`
  - `searchFields={field?.refSearchFields}`
- `features/dashboard/views/relationship/client/components/RelationshipSelect.tsx:47-72` builds search conditions from the supplied `searchFields`
- `features/dashboard/views/relationship/client/components/RelationshipSelect.tsx:111-118` and `:158-169` propagate the chosen label/search metadata into fetching
- `features/dashboard/views/relationship/ClientRelationshipFilter.tsx:55-60` and `:82-87` do the same for filter UIs

#### Practical parity gap
In TanStack, a relationship field configured with a non-default label field or custom search fields will:
- search the wrong fields
- show the wrong label source in option lists and hydrated chips

This is a real functional parity miss, not just a styling difference.

---

### P1 — Editing an existing many-relationship filter breaks selected-option hydration/state shape
**Impact:** TanStack can initially add a many-relationship filter correctly, but reopening that filter for editing converts the stored array of IDs into one comma-joined string. The relationship filter input then treats that entire string as a single ID.

#### Evidence in TanStack
- URL values are saved as JSON in the filter bar:
  - `src/components/dashboard/filter-bar.tsx:381-383`
- Existing filter values are converted into editable draft state by stringifying parsed values:
  - `src/components/dashboard/filter-bar.tsx:423-429`
  - for an array like `["a", "b"]`, this returns `"a,b"`
- The relationship filter input parses strings as **one** ID, not a split list:
  - `src/components/dashboard/views/relationship-filter-input.tsx:18-21`
  - only arrays are preserved as many IDs
- The edited value is then saved back from this broken shape:
  - `src/components/dashboard/views/relationship-filter-input.tsx:67-70`

#### Why this fails
For a `some` / `not_some` relationship filter:
1. initial saved URL value is an array JSON string
2. pill edit dialog parses it, then flattens it to `"id1,id2"`
3. `RelationshipFilterInput.selectedIds()` treats that as one ID
4. hydration and selection editing are now wrong

#### Next baseline
- `features/dashboard/components/FilterList.tsx:88-100` keeps parsed JSON values as arrays
- `features/dashboard/components/FilterList.tsx:249-253` writes the edited value back as JSON without flattening it first
- `features/dashboard/views/relationship/ClientRelationshipFilter.tsx:68-76` expects and preserves an actual ID array for many filters

#### Priority rationale
This is not a route-level blocker, but it is a direct regression in relationship filter editing and selected-option hydration behavior.

---

### P2 — Relationship field editor is less complete than the Next baseline
**Impact:** TanStack covers the basic edit/search/select path, but it is missing richer relationship workflows that exist in the Next baseline.

#### What TanStack already does correctly
- Selected chips are hydrated by ID in the editor:
  - `src/components/dashboard/relationship-field-editor.tsx:58-64`
  - rendered at `:80-85`
- Selected chips are hydrated by ID in the filter input:
  - `src/components/dashboard/views/relationship-filter-input.tsx:47-52`
  - rendered at `:78-84`

#### Remaining parity gaps vs Next
1. **No inline create flow**
   - TanStack only offers navigation links:
     - `src/components/dashboard/relationship-field-editor.tsx:113-133`
   - Next supports an inline create drawer:
     - `features/dashboard/views/relationship/client/Field.tsx:210-239`

2. **No many-relationship “view related list” action**
   - TanStack only shows “View related details” when exactly one ID is selected:
     - `src/components/dashboard/relationship-field-editor.tsx:128-131`
   - Next supports linking to the related list with a backreference filter for many relations:
     - `features/dashboard/views/relationship/client/Field.tsx:47-74`

3. **No authenticated-self quick action**
   - Next offers “Add/Set as authenticated user” when the related list is `User`:
     - `features/dashboard/views/relationship/client/Field.tsx:242-259`
   - No equivalent exists in TanStack.

#### Priority rationale
These are workflow parity issues rather than hard correctness bugs, so I rank them below the metadata/search issues.

---

### P3 — Sidebar navigation is less complete than the Next baseline
**Impact:** Navigation works, but the model section behavior is simpler and less polished.

#### TanStack behavior
- `src/components/dashboard/dashboard-sidebar.tsx:74-97`
  - the “Models” section is always rendered expanded in the desktop sidebar
  - there is no collapsible state on the main sidebar section

#### Next baseline
- `features/dashboard/components/Sidebar.tsx:127-170`
  - wraps the Models group in a `Collapsible`
  - preserves a dedicated expand/collapse affordance

#### Priority rationale
This is a UX parity gap, not a correctness problem.

---

## Areas reviewed that are currently in good shape

### Singleton canonical `/1` links and create redirect behavior
TanStack is largely aligned here.

#### TanStack
- Dashboard home singleton cards use `/dashboard/$listKey/$id` with `id: '1'`:
  - `src/routes/dashboard/index.tsx:62-75`
- Singleton create route redirects to canonical `/1` instead of rendering a create page:
  - `src/routes/dashboard/$listKey.create.tsx:18-22`
- Item fetch allows missing singleton `/1` without immediately throwing not-found:
  - `src/features/cms/graphql-client.ts:536`
- Singleton creation route navigates back to `/1` after create:
  - `src/routes/dashboard/$listKey.$id.tsx:266-269`

#### Next baseline
- Home cards also use `/dashboard/${list.path}/1`:
  - `features/dashboard/screens/HomePage/index.tsx:22-25`

**Conclusion:** canonical singleton home-link and `/create` redirect behavior is already at parity. The real issue is the broken missing-singleton render path described in P0.

---

### Breadcrumbs and page-container infrastructure
TanStack has the expected primitives wired through the main routes.

#### TanStack
- Shared page container with breadcrumbs:
  - `src/components/dashboard/page-container.tsx:32-62`
- Shared page breadcrumbs header:
  - `src/components/dashboard/page-breadcrumbs.tsx:20-49`
- Used on:
  - dashboard home: `src/routes/dashboard/index.tsx:35`
  - list route: `src/routes/dashboard/$listKey.tsx:84-92`
  - create route: `src/routes/dashboard/$listKey.create.tsx:88-100`
  - item route: `src/routes/dashboard/$listKey.$id.tsx:167-198`, singleton create fallback `:279-282`

#### Next baseline
- Equivalent container/breadcrumb primitives exist:
  - `features/dashboard/components/PageContainer.tsx:32-77`
  - `features/dashboard/components/PageBreadcrumbs.tsx:26-65`

**Conclusion:** no material parity gap here.

---

### No-access and top-level error flows
These are broadly aligned.

#### No-access
- TanStack route guard:
  - `src/routes/dashboard.tsx:21-50`
- TanStack no-access page:
  - `src/routes/dashboard/no-access.tsx:10-38`
- Next middleware baseline:
  - `features/dashboard/middleware.ts:118-154`
- Next no-access page:
  - `features/dashboard/screens/NoAccessPage/index.tsx:7-40`

#### Top-level error handling
- TanStack root route installs a global dashboard error boundary:
  - `src/routes/__root.tsx:38-41`
- TanStack boundary UI:
  - `src/components/dashboard/error-boundary.tsx:16-55`
- Next dashboard layout wraps children in an error boundary:
  - `features/dashboard/components/DashboardLayout.tsx:109-121`
- Next boundary implementation:
  - `features/dashboard/components/ErrorBoundary.tsx:36-80`

**Conclusion:** no major parity gap found in these two areas.

---

## Priority-ranked gap list

### P0
- **Broken missing item / missing singleton render path due to undefined `MissingSingletonItem`**
  - TanStack: `src/routes/dashboard/$listKey.$id.tsx:85`
  - Intended but unreachable fallback logic: `src/routes/dashboard/$listKey.$id.tsx:155-163`, `:216-223`
  - Baseline: `next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx:400-424`

### P1
- **Relationship option search + labels ignore `refSearchFields` / `refLabelField`**
  - TanStack: `src/components/dashboard/relationship-field-editor.tsx:37-64`, `src/components/dashboard/views/relationship-filter-input.tsx:35-52`, `src/features/cms/graphql-client.ts:371-383`, `:562-577`, `:590-602`
  - Baseline: `next-keystone-starter/features/dashboard/views/relationship/client/Field.tsx:173-176`, `next-keystone-starter/features/dashboard/views/relationship/client/components/RelationshipSelect.tsx:47-72`, `:111-118`, `:158-169`, `next-keystone-starter/features/dashboard/views/relationship/ClientRelationshipFilter.tsx:55-60`, `:82-87`

- **Editing many-relationship filters corrupts selected IDs into one comma-string**
  - TanStack: `src/components/dashboard/filter-bar.tsx:368-383`, `:423-429`, `src/components/dashboard/views/relationship-filter-input.tsx:18-21`, `:67-70`
  - Baseline: `next-keystone-starter/features/dashboard/components/FilterList.tsx:88-100`, `:249-253`, `next-keystone-starter/features/dashboard/views/relationship/ClientRelationshipFilter.tsx:68-76`

### P2
- **Relationship editor lacks inline create and related-list navigation parity**
  - TanStack: `src/components/dashboard/relationship-field-editor.tsx:113-133`
  - Baseline: `next-keystone-starter/features/dashboard/views/relationship/client/Field.tsx:47-74`, `:210-239`, `:242-259`

### P3
- **Sidebar Models section is not collapsible like the Next baseline**
  - TanStack: `src/components/dashboard/dashboard-sidebar.tsx:74-97`
  - Baseline: `next-keystone-starter/features/dashboard/components/Sidebar.tsx:127-170`

---

## Bottom line
TanStack already has the basic dashboard plumbing in place for relationships, singletons, breadcrumbs, no-access, and global errors. The biggest remaining problem is not breadth but **correctness**: the item route’s undefined `MissingSingletonItem` currently breaks the exact singleton/not-found parity path this audit targeted.

After that blocker, the most important remaining work is relationship parity at the metadata layer:
- honor `refSearchFields`
- honor `refLabelField`
- preserve array values when editing many-relationship filters

Those three fixes would remove the major functional gaps relative to `next-keystone-starter` for this slice of the dashboard.