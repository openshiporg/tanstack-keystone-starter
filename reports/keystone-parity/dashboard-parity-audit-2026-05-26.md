# Dashboard Parity Audit

## 1. Verdict

Not full parity.

The TanStack dashboard has moved well past scaffolding. It now has real dashboard routes, auth/init/no-access routing, list/search/filter/sort/column controls, list and item GraphQL data paths, item/create forms, field controllers/views, relationship editors, file upload plumbing, bulk delete, and metadata-driven custom actions. Those are code-backed implementations, not placeholders.

The remaining parity blockers are narrower but still real. The biggest mismatches are around dynamic dashboard contract semantics that the Next dashboard gets from enhanced Keystone field controllers, plus behavioral details in rich field views and list state/navigation. Some TanStack behavior is intentionally more advanced than the Next starter, but several differences still affect dashboard parity rather than mere visual polish.

## 2. What is already at parity

- Dashboard shell wraps normal dashboard routes but not standalone auth routes in `src/routes/dashboard.tsx`; this matches the reference split between dashboard layout and standalone auth screens under `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/*`.
- Sidebar/dashboard chrome exists with model navigation, user profile slot, right sidebar/chat affordance, and floating chat button in `src/components/dashboard/dashboard-shell.tsx` and `src/components/dashboard/dashboard-sidebar.tsx`, corresponding to reference `components/DashboardLayout.tsx`, `components/Sidebar.tsx`, and `components/dual-sidebar/*`.
- Auth/init/no-access routing exists in `src/features/cms/dashboard-route-guards.ts`, `src/routes/dashboard/signin.tsx`, `src/routes/dashboard/signup.tsx`, `src/routes/dashboard/reset.tsx`, `src/routes/dashboard/init.tsx`, and `src/routes/dashboard/no-access.tsx`, corresponding to reference `screens/SignInPage`, `SignUpPage`, `ResetPage`, `InitPage`, and `NoAccessPage`.
- Dashboard home loads visible list summaries, counts, singleton affordances, and create affordances in `src/routes/dashboard/index.tsx` and `src/features/cms/graphql-client.ts` `fetchDashboardOverview`, corresponding to reference `screens/HomePage/index.tsx`.
- List route canonicalizes list path and loads list page data through TanStack Query in `src/routes/dashboard/$listKey.tsx`; reference list page loads list data and list items via `screens/ListPage/index.tsx` and `screens/ListPage/ListPageClient.tsx`.
- List search/filter/sort/column/create control row exists in `src/components/dashboard/filter-bar.tsx`, corresponding to reference `components/FilterBar.tsx`, `FieldSelection.tsx`, `FilterAdd.tsx`, `FilterList.tsx`, and `SortSelection.tsx`.
- Selected columns include `id`, respect default columns, and hide `id` from the column picker in target `src/features/cms/graphql-client.ts` `selectedListFields` and `src/components/dashboard/filter-bar.tsx` `FieldSelection`, matching reference `hooks/useSelectedFields.ts` and `components/FieldSelection.tsx` behavior.
- List table has selectable rows, select-all, row link cells, sortable column headers, per-row view links, pagination, and empty-state branching in `src/components/dashboard/keystone-list-table.tsx`, corresponding to reference `components/ListTable.tsx` and `components/Pagination.tsx`.
- Filtered empty state vs unfiltered empty state exists in target `src/components/dashboard/keystone-list-table.tsx` via `isFiltered`; reference implements the split in `screens/ListPage/ListPageClient.tsx` with `EmptyStateDefault` and `EmptyStateSearch`.
- Bulk delete handles partial success and preserves failed selected IDs in `src/components/dashboard/keystone-list-table.tsx` `collectBulkDeleteResult`/`deleteSelectedItems`; reference supports delete-many in `components/ListTable.tsx` but does not preserve partial-failure detail as fully.
- Metadata-driven list actions exist in target `src/components/dashboard/list-page-actions.tsx` and are sourced through `actions` in `src/features/cms/admin-meta-query.ts`; reference dashboard does not expose equivalent generic list actions beyond delete-many in inspected code.
- Item route loads data, merges runtime field metadata, computes dirty state, validates, saves, resets with confirmation, deletes with confirmation, handles custom item actions, and blocks unsaved navigation in `src/routes/dashboard/$listKey.$id.tsx`; reference item route handles edit/delete/reset/errors in `screens/ItemPage/ItemPageClient.tsx`.
- Create route exists, blocks hidden create for singleton/hidden-create lists, computes default values, validates, creates, supports create-another toast action, and blocks unsaved navigation in `src/routes/dashboard/$listKey.create.tsx`; reference create route exists in `screens/CreatePage/CreatePageClient.tsx`.
- Dashboard admin-meta query includes list metadata, field metadata, groups, GraphQL names, hidden navigation, create/delete flags, and actions in `src/features/cms/admin-meta-query.ts`, corresponding to reference `actions/getAdminMetaAction.ts` and `types/index.ts` expectations.
- Field grouping and form/sidebar placement are implemented by `src/components/dashboard/enhanced-form-fields.tsx` and `src/components/dashboard/field-form-layout.tsx`, corresponding to reference `components/Fields.tsx` and group metadata use in item/create screens.
- Field view registry exists for text, checkbox, relationship, image/file, document, json, number, timestamp, select/multiselect, and password in `src/components/dashboard/views/registry.tsx` and `src/components/dashboard/views/*`, corresponding to reference `features/dashboard/views/*`.
- Relationship editing has dedicated target UI in `src/components/dashboard/relationship-field-editor.tsx`, `relationship-create-sheet.tsx`, and `relationship-edit-sheet.tsx`, corresponding to reference relationship view files under `/Users/junaid/code/next-keystone-starter/features/dashboard/views/relationship`.

## 3. Remaining blockers

1. **Dynamic `itemView`/`createView` requiredness and field mode parity is only partially equivalent**
   - severity: high
   - why it blocks parity: the reference dashboard builds enhanced fields with controller behavior and uses requiredness from `list.adminMetaFields` and controller validation. The target has a static-plus-runtime metadata merge, but create route does not request per-item validation metadata before rendering and item route only merges `fieldMetaByPath` from the item loader. Dynamic field mode/requiredness can diverge when rules depend on item/input/session.
   - reference implementation files: `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/actions/getItemValidationAction.ts`, `/Users/junaid/code/next-keystone-starter/features/dashboard/utils/useInvalidFields.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/components/Fields.tsx`.
   - target implementation files: `src/routes/dashboard/$listKey.$id.tsx`, `src/routes/dashboard/$listKey.create.tsx`, `src/features/cms/graphql-client.ts`, `src/components/dashboard/enhanced-form-fields.tsx`, `src/components/dashboard/field-value-editor.tsx`.
   - exact mismatch explanation: target item route merges `data.fieldMetaByPath[fieldPath]` into enhanced fields, but create route only uses admin-meta fields from `fetchKeystoneAdminMeta()` and never calls an equivalent of reference `getItemValidationAction` for create/input-dependent state. `EnhancedFormFields` can evaluate conditional field modes via serialized data, but parity depends on the metadata being available and equivalent. This is not guaranteed from the inspected target create path.
   - dashboard-only or deeper dependency: dashboard plus dashboard-facing metadata/runtime dependency.

2. **Rich field views are materially simplified for document and some media/relationship behaviors**
   - severity: high
   - why it blocks parity: the reference dashboard contains specialized Keystone-like field views. The target has view files and editors, but some rich fields are not behaviorally equivalent to the source dashboard's custom views.
   - reference implementation files: `/Users/junaid/code/next-keystone-starter/features/dashboard/views/document/index.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/views/image/index.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/views/image/Field.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/views/relationship/index.tsx`, and relationship client components under `views/relationship/client`.
   - target implementation files: `src/components/dashboard/field-value-editor.tsx`, `src/components/dashboard/views/document.tsx`, `src/components/dashboard/views/image.tsx`, `src/components/dashboard/file-field-editor.tsx`, `src/components/dashboard/relationship-field-editor.tsx`, `src/components/dashboard/relationship-create-sheet.tsx`, `src/components/dashboard/relationship-edit-sheet.tsx`.
   - exact mismatch explanation: target `FieldValueEditor` falls back to a JSON textarea for `document` fields and uses generic file editor semantics for `image`/`file`; the reference has dedicated document and image field views and relationship inline create/edit/card flows. The target has relationship sheets, but parity requires verifying inline create/edit/connect/remove modes against the source relationship client behavior, not just having relationship controls.
   - dashboard-only or deeper dependency: dashboard-only for UI behavior, with upload/runtime support as a dependency for media.

3. **List state semantics have drifted beyond the reference and need compatibility verification**
   - severity: medium
   - why it blocks parity: the reference dashboard uses URL params directly (`search`, `sortBy`, `fields`, `!field_filter`) and reset clears the URL. The target adds localStorage persistence, official `filter` params, `column` compatibility, and default-state normalization. These may be useful, but parity requires same effective behavior when users navigate in/out of a list and reset filters.
   - reference implementation files: `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx`, `components/FilterBar.tsx`, `components/FieldSelection.tsx`, `components/SortSelection.tsx`, `components/FilterList.tsx`.
   - target implementation files: `src/components/dashboard/filter-bar.tsx`, `src/components/dashboard/list-state-persistence.ts`, `src/components/dashboard/list-state-defaults.ts`, `src/components/dashboard/list-search-url.ts`, `src/components/dashboard/filter-param-compat.ts`.
   - exact mismatch explanation: target `FilterBar` restores persisted list state from `localStorage` when no explicit URL state is present. Reference `handleResetFilters` routes to `window.location.pathname` and has no localStorage restore layer. Target reset writes normalized defaults rather than simply clearing URL state. This can make returning to a list restore search/filter/sort/fields where the reference would show defaults.
   - dashboard-only or deeper dependency: dashboard-only.

4. **Sort token handling is compatible but not identical in all paths**
   - severity: medium
   - why it blocks parity: reference sort UI stores `sortBy=field` for ASC and `sortBy=-field` for DESC. Target supports that and legacy `field:asc`/`field:desc`, but some table header and filter-bar paths normalize differently and need route-level verification.
   - reference implementation files: `/Users/junaid/code/next-keystone-starter/features/dashboard/components/SortSelection.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/components/ListTable.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/lib/buildOrderByClause.ts`.
   - target implementation files: `src/components/dashboard/filter-bar.tsx`, `src/components/dashboard/keystone-list-table.tsx`, `src/features/cms/graphql-client.ts` `resolveEffectiveSortToken` and `buildOrderBy`.
   - exact mismatch explanation: target `resolveEffectiveSortToken` accepts both `field:desc` and `-field`, while target controls generally emit `field`/`-field`. This is acceptable compatibility if all UI paths consistently preserve reference tokens, but table header uses `useSearch` and writes raw `nextSort` without `normalizeListSearchForUrl`, while filter-bar writes through normalization. That split should be tightened or tested.
   - dashboard-only or deeper dependency: dashboard-only.

5. **No live-browser evidence for current dashboard parity after the latest code changes**
   - severity: medium
   - why it blocks parity: code inspection shows implementations, but the contract requires behavior. There is no fresh current-code browser evidence in this audit for auth redirects, list controls, mutation toasts, relationship sheets, or unsaved navigation blockers.
   - reference implementation files: reference behavior is spread across `/Users/junaid/code/next-keystone-starter/features/dashboard/components/*`, `screens/*`, and `views/*`.
   - target implementation files: all target dashboard route/component files inspected above.
   - exact mismatch explanation: static inspection proves presence and intent, not runtime behavior. In particular, TanStack Router search typing, route loaders, and in-process GraphQL can behave differently than Next server actions. This audit did not start a dev server per instruction.
   - dashboard-only or deeper dependency: dashboard-only verification, no dev server started.

6. **AI right sidebar/chat parity is incomplete or unverified**
   - severity: low
   - why it blocks parity: the reference dashboard shell has real `RightSidebar`, chat mode context, AI config provider, and chat submission hooks. The target has AI/chat component files, but shell evidence shows a right-sidebar area and floating button; parity of chat behavior was not proven in this slice.
   - reference implementation files: `/Users/junaid/code/next-keystone-starter/features/dashboard/components/DashboardLayout.tsx`, `components/dual-sidebar/right-sidebar.tsx`, `components/dual-sidebar/ai-chat-sidebar.tsx`, `hooks/use-ai-config.tsx`, `hooks/use-chat-submission.tsx`, `actions/ai-chat.ts`.
   - target implementation files: `src/components/dashboard/dashboard-shell.tsx`, `src/components/dashboard/ai-chat-sidebar.tsx`, `src/components/dashboard/right-sidebar.tsx`, `src/components/dashboard/ai-config.tsx`, `src/features/cms/dashboard-completion.ts`.
   - exact mismatch explanation: target files exist, but this audit did not verify that the floating button toggles a functioning right sidebar/chat flow equivalent to reference `useSidebarWithSide('right')` and `RightSidebar` wiring.
   - dashboard-only or deeper dependency: dashboard-only plus completion endpoint dependency.

## 4. False alarms / things that look different but are acceptable

- The target uses TanStack Router loaders/query-client preloading instead of Next server components and server actions. This is not a parity blocker by itself because `src/routes/dashboard/$listKey.tsx`, `src/routes/dashboard/$listKey.$id.tsx`, and `src/features/cms/graphql-client.ts` preserve equivalent data-loading responsibilities.
- The target uses `executeRawDashboardGraphQL` and in-process GraphQL on the server instead of reference server actions like `getListItemsAction` and `updateItemAction`. Different transport is acceptable if query/mutation behavior and error display match.
- The target has generic metadata-driven list and item actions (`list-page-actions.tsx`, `item-page-actions.tsx`) that the inspected reference dashboard does not expose as a generic action system. This is extra capability, not a parity gap.
- The target's partial-success bulk delete handling is more detailed than the reference `ListTable.tsx`, which primarily surfaces first errors/toasts. Extra error detail is not a parity blocker.
- The target supports singleton overview lookup through `fetchDashboardOverview()` and canonical path redirects in route loaders. These are harmless architecture differences and likely improvements.
- The target uses shadcn/base UI generated components instead of the reference shadcn/Radix component mix. Component primitive differences are not blockers unless they alter behavior.

## 5. Smallest next slice

Implement and/or verify create-page dynamic field metadata parity.

Concrete target files likely to change:
- `src/features/cms/graphql-client.ts`
- `src/routes/dashboard/$listKey.create.tsx`
- `src/components/dashboard/enhanced-form-fields.tsx`
- possibly `src/features/cms/admin-meta-query.ts` if create-time field metadata is not exposed

The slice should add a create-page equivalent to the reference's item validation/admin-meta requiredness flow: before rendering/saving create fields, resolve `createView.fieldMode`, `createView.isRequired`, and field metadata in the same shape the item page already receives via `fieldMetaByPath`. Then use that runtime-resolved metadata in `EnhancedFormFields` and `invalidFieldsForValues`. Add a safe non-server validation check if possible; do not start dev servers.

## 6. Evidence appendix

### Dashboard shell/navigation

- Reference `features/dashboard/components/DashboardLayout.tsx` wraps children with `ErrorBoundary`, `QueryProvider`, `DashboardProvider`, `AdminMetaProvider`, `AiConfigProvider`, `ChatModeProvider`, `SidebarProvider`, left `Sidebar`, `RightSidebar`, and `FloatingChatButton`.
- Target `src/routes/dashboard.tsx` runs `beforeLoad` auth decisions and only wraps non-standalone auth routes in `DashboardShell`.
- Target `src/components/dashboard/dashboard-shell.tsx` fetches overview with `useSuspenseQuery`, renders `DashboardSidebar`, `SidebarInset`, right-sidebar placeholder, and `FloatingChatButton`.
- Target `src/components/dashboard/dashboard-sidebar.tsx` builds dashboard and model links from `DashboardListSummary[]` and closes mobile sidebar on navigation.

### Auth/init/no-access

- Reference auth screens live in `features/dashboard/screens/SignInPage`, `SignUpPage`, `ResetPage`, `InitPage`, and `NoAccessPage`; auth actions live in `features/dashboard/actions/auth.ts`.
- Target `src/features/cms/dashboard-route-guards.ts` implements redirects for init, signin, signup, reset, no-access, authenticated public-auth users, and missing dashboard access.
- Target `src/routes/dashboard/signin.tsx`, `signup.tsx`, `reset.tsx`, and `init.tsx` call dashboard GraphQL auth mutations and render standalone forms.

### List semantics

- Reference `screens/ListPage/ListPageClient.tsx` constructs query variables from URL `page`, `pageSize`, `search`, filter params, and selected fields, then renders `FilterBar`, empty states, and `ListTable`.
- Target `src/routes/dashboard/$listKey.tsx` validates search, loads via `fetchDashboardListPage`, detects child routes, and renders `FilterBar` plus `KeystoneListTable`.
- Target `src/features/cms/graphql-client.ts` implements `selectedListFields`, `buildWhere`, `filterWhereForField`, `resolveEffectiveSortToken`, `buildOrderBy`, and `fetchDashboardListPage`.
- Target `src/components/dashboard/filter-bar.tsx` handles search, filter add/edit/remove, sort selection, column selection, localStorage state persistence, and reset-to-defaults.

### Bulk actions/list table

- Reference `components/ListTable.tsx` handles row selection, select all, delete-many through `deleteManyItemsAction`, cache invalidation, error toast, and `Pagination` selection controls.
- Target `src/components/dashboard/keystone-list-table.tsx` handles row selection, hide-delete checkbox suppression, delete-many through `executeRawDashboardGraphQL`, partial failure collection, cache invalidation, toasts, and delegates custom actions to `ListPageActions`.
- Target `src/components/dashboard/list-page-actions.tsx` runs metadata-driven many actions from `data.list.actions` with prompts and success/failure messages.

### Item/create behavior

- Reference `screens/ItemPage/ItemPageClient.tsx` enhances fields, deserializes item values, validates with `useInvalidFields`, checks dirty state with `useHasChanges`, saves only changed serialized fields, resets/deletes with dialogs, and shows error details.
- Target `src/routes/dashboard/$listKey.$id.tsx` enhances fields, merges runtime `fieldMetaByPath`, serializes changed values, validates with `invalidFieldsForValues`, blocks navigation with `usePreventNavigation`, handles delete/reset/save/action flows, and supports singleton missing-item create flow.
- Reference `screens/CreatePage/CreatePageClient.tsx` uses `useCreateItem`, enhanced fields, `Fields`, and navigates to the new item after create.
- Target `src/routes/dashboard/$listKey.create.tsx` computes default values, validates, blocks unsaved navigation, creates via GraphQL, shows toast with create-another action, and redirects to item page.

### Dashboard contract

- Reference `types/index.ts` defines `ListMeta`, `FieldMeta`, `GraphQLNames`, `FieldController`, and field views contract.
- Target `src/features/cms/admin-meta-query.ts` requests list/field/group/action metadata, GraphQL names, view modes, requiredness, hidden navigation, and actions.
- Target `src/features/cms/admin-meta.ts` generates Keystone-style admin meta, field metadata, relationship metadata, GraphQL selection hints, list UI flags, default columns, actions, and dynamic mode evaluation helpers.
- Target `src/features/cms/graphql-client.ts` normalizes admin meta into `DashboardList`/`DashboardField` and uses it for dashboard route data.

### Rich field views

- Reference rich views live under `/Users/junaid/code/next-keystone-starter/features/dashboard/views/*`, including relationship client components and image/document views.
- Target view registry lives in `src/components/dashboard/views/registry.tsx`, with specialized view modules for text, number, timestamp, json, checkbox, relationship, image/file, document, select/multiselect, and password.
- Target `src/components/dashboard/field-value-editor.tsx` still uses a generic textarea for document/json and delegates image/file to `FileFieldEditor` and relationship to `RelationshipFieldEditor`, which is the main rich-field parity risk.
