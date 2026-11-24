# Dashboard Migration Handoff Context

Target: rebuild the custom Keystone dashboard from `/Users/junaid/code/next-keystone-starter` in `/Users/junaid/code/tanstack-keystone-starter` using TanStack Start + shadcn/base UI, reusing only portable concepts/pieces.

## Executive summary

The source dashboard is a custom Next.js App Router admin UI that mirrors Keystone Admin UI concepts:

- fetches Keystone `adminMeta` over GraphQL,
- augments list metadata with Keystone GraphQL operation/type names,
- maps `viewsIndex` to field view/controller implementations,
- builds list/item/create GraphQL selections and mutations dynamically,
- serializes/deserializes fields through per-field controllers,
- implements Keystone-like filters, sorting, pagination, relationship selectors, validation, and changed-field detection.

The reusable value is mostly **field view/controller logic** and **GraphQL/metadata utilities**. The route/layout/actions/navigation/session/cache layer is Next-specific and should be rewritten in TanStack-native primitives.

The TanStack starter already has a dashboard shell and a CMS metadata skeleton, but its current GraphQL endpoint only exposes `keystone.adminMeta`; it does not yet expose CRUD list/item queries and mutations. Treat dashboard implementation as the milestone immediately after GraphQL CRUD parity.

## Current target repo state

Relevant target files:

- `/Users/junaid/code/tanstack-keystone-starter/src/routes/dashboard.tsx`
  - TanStack route for `/dashboard`, renders `DashboardShell` and `<Outlet />`.
- `/Users/junaid/code/tanstack-keystone-starter/src/routes/dashboard/index.tsx`
  - dashboard landing page with list cards and migration skeleton UI.
- `/Users/junaid/code/tanstack-keystone-starter/src/routes/dashboard/$listKey.tsx`
  - current list route is a preview/static metadata page; loader finds list by path/key from `cmsAdminMeta`.
- `/Users/junaid/code/tanstack-keystone-starter/src/routes/api/graphql.ts`
  - TanStack Start server route forwards GET/POST to `cmsGraphQLYoga.handle(request, {})`.
- `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/graphql.ts`
  - GraphQL Yoga schema currently defines only `Query.keystone.adminMeta` and metadata types; no item/list CRUD operations yet.
- `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/admin-meta.ts`
  - converts local `cmsLists` registry into Keystone-like `AdminMeta`, adds `gqlNames`/`graphql.names`.
- `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/gql-names.ts`
  - currently implements a simplified pluralization helper. Source repo uses Keystone/pluralize-compatible logic; consider replacing with source version or adding `pluralize` dependency.
- `/Users/junaid/code/tanstack-keystone-starter/src/components/dashboard/dashboard-shell.tsx`
  - TanStack shell using shadcn sidebar; already owns app chrome and navigation.

Important target dependency constraints from `package.json`:

- Has TanStack Start/Router and Base UI/shadcn dependencies.
- Does **not** currently have `@tanstack/react-query`, `graphql-request`, `sonner`, `react-hook-form`, Slate/Plate, or AI SDK packages.
- Current source dashboard uses React Query, graphql-request, sonner, SWR, Next themes/navigation/server actions/cookies. Decide dependencies explicitly before porting features.

## Source dashboard architecture

### Route tree and layouts

Source route files under `/Users/junaid/code/next-keystone-starter/app/dashboard`:

- `layout.tsx`: wraps dashboard in `next-themes` `ThemeProvider` and `Toaster`; Next-specific.
- `(admin)/layout.tsx`: `dynamic = 'force-dynamic'`; server-fetches adminMeta and authenticated user with `Promise.all([getAdminMetaAction(), getAuthenticatedUser()])`, then renders `features/dashboard/components/DashboardLayout`.
- `(admin)/page.tsx`: exports `HomePage`.
- `(admin)/[listKey]/page.tsx`: exports `ListPage`.
- `(admin)/[listKey]/[id]/page.tsx`: exports `ItemPage`.
- `(admin)/[listKey]/create/page.tsx`: exports `CreatePage`.
- auth/init routes: `signin`, `signup`, `reset`, `init`, `no-access` have separate screen modules.

The route param named `listKey` is actually the **list path** in list/item/create pages. The source resolves it with `getListByPath(path)` and then uses the real `list.key` for GraphQL names/mutations.

### Dashboard shell/providers

Source `features/dashboard/components/DashboardLayout.tsx`:

- Client component wrapping:
  - `QueryProvider` (React Query),
  - `DashboardProvider` (`basePath`/version only),
  - `AdminMetaProvider initialData={adminMeta}`,
  - `AiConfigProvider`,
  - `ChatModeProvider`,
  - shadcn `SidebarProvider` with left sidebar and right AI sidebar.
- Uses `RightSidebar` and `FloatingChatButton`; this is UI/Next-client code, not portable as-is.

Source `features/dashboard/context/DashboardProvider.tsx` is portable conceptually but trivial: provides `basePath = '/dashboard'` and version.

Target should let TanStack `DashboardShell` own layout. If a context is needed, keep it tiny: `{ basePath, adminMeta, authenticatedItem }` or prefer loader data/context.

## How source dashboard gets metadata/data/session

### adminMeta

Source: `features/dashboard/actions/getAdminMetaAction.ts`

Key behavior:

- Uses exact Keystone adminMeta query shape, selecting:
  - list basics: `key`, query names, `initialSort`, `path`, labels, `pageSize`, `labelField`, singleton/hidden/create/delete flags,
  - fields: `path`, `label`, `description`, `fieldMeta`, order/filter flags, `viewsIndex`, `customViewsIndex`, search/nullability, `createView`, `itemView`, `listView`,
  - groups.
- Calls `keystoneClient(query)`.
- Extracts `response.data.keystone.adminMeta`.
- Enhances every list with `gqlNames` and `graphql.names` using `getGraphQLNames(list.key, { plural: list.plural })`.
- If called with `listKey`, returns one list with `fields` transformed from array to record keyed by `field.path`.

Important source lines:

- `getAdminMetaAction.ts:18` starts `query KsFetchAdminMeta { keystone { adminMeta { lists { ... }}}}`.
- `getAdminMetaAction.ts:95-103` adds `gqlNames`/`graphql.names`.
- `getAdminMetaAction.ts:131-139` returns a single list with fields as a record.

Target mapping:

- Implement as TanStack loader/server function/shared module around `/api/graphql`.
- Keep response shape compatible with source enhanced list contract (`fields` as record for screens/controllers).
- In target `src/features/cms/admin-meta.ts`, `viewsIndex` is currently a string kind (`'text'`, etc.) while source expects numeric `viewsIndex`. Either normalize the target registry to use string keys everywhere or preserve Keystone numeric behavior. Do not blindly copy source `enhanceFields` without resolving this mismatch.

### list metadata by key/path

Source:

- `features/dashboard/actions/getList.ts`: calls full adminMeta, finds `list.key === listKey`, returns fields record.
- `features/dashboard/actions/getListByPath.ts`: calls full adminMeta, finds `list.path === path`, returns fields record.

Target mapping:

- Keep both helpers, but make them pure/shared or server-loader-friendly.
- Route params should use `list.path`; GraphQL operations should use `list.key`/`list.graphql.names`.

### list items, filters, sorting, pagination

Source list page flow: `features/dashboard/screens/ListPage/index.tsx`.

- Parses `page`, `pageSize`, `search`, `fields` from URL search params.
- Resolves list by path.
- Builds `orderBy = buildOrderByClause(list, searchParamsObj)`.
- Builds `filterWhere = buildWhereClause(list, searchParamsObj)`.
- Builds `searchWhere = buildWhereClause(list, { search })` and combines filters/search as `{ AND: [...] }`.
- Computes selected fields:
  - always `id`,
  - URL `fields` if present,
  - else `list.initialColumns`,
  - else fallback common labels (`name`, `title`, `label`, `createdAt`, `updatedAt`).
- Calls `getListItemsAction(list.key, variables, selectedFields, cacheOptions)`.
- Fetches `getAdminMetaAction(list.key)` again for enhanced metadata.

Source `getListItemsAction.ts`:

- Gets list by real `list.key`.
- Maps selected field paths to GraphQL selections using `FIELD_GRAPHQL_SELECTIONS` or `field.controller.graphqlSelection`.
- Query shape:
  ```graphql
  query GetListItems(
    $where: ${list.graphql.names.whereInputName},
    $take: Int!,
    $skip: Int!,
    $orderBy: [${list.graphql.names.listOrderName}!]
  ) {
    items: ${list.graphql.names.listQueryName}(where: $where, take: $take, skip: $skip, orderBy: $orderBy) { id ... }
    count: ${list.graphql.names.listQueryCountName}(where: $where)
  }
  ```

Important source lines:

- `ListPage/index.tsx:43-69` builds order/filter/search/pagination variables.
- `ListPage/index.tsx:73-96` selected fields algorithm.
- `getListItemsAction.ts:31-54` field-type GraphQL selections.
- `getListItemsAction.ts:116-130` dynamic list query/count names.

Reusable:

- `buildWhereClause.ts` is high-value and mostly portable, but it depends on `getFieldTypeFromViewsIndex` and assumes source filter URL key format `!${fieldPath}_${filterType}` with JSON-encoded values.
- `buildOrderByClause.ts` and `sort.ts` are portable with small routing/SearchParam adaptation.
- Field GraphQL selection mapping should be centralized and ideally derived from controllers after enhancement, not duplicated in item/list actions.

### item data and item-specific adminMeta

Source item page: `features/dashboard/screens/ItemPage/index.tsx`.

- Resolves list by path.
- Calls `getItemAction(list, itemId)`.
- Calls `getAdminMetaAction(list.key)` and `getItemValidationAction(list.key, itemId)`.
- Merges item-specific validation/meta into `enhancedList.fields[fieldPath].itemView`.

Source `getItemAction.ts`:

- Builds selection for all fields where `field.itemView?.fieldMode !== 'hidden'`.
- Uses field-type GraphQL selection map:
  - `document`: `${fieldPath} { document }`,
  - `password`: `${fieldPath} { isSet }`,
  - `relationship`: `${fieldPath} { id label: ${refLabelField || 'name'} }`,
  - `virtual`: `${fieldPath}${fieldMeta?.query}`,
  - `image`: nested image metadata.
- Query shape:
  ```graphql
  query KsFetchItem($id: ID!, $listKey: String!) {
    item: ${list.graphql.names.itemQueryName}(where: {id: $id}) { ... }
    keystone { adminMeta { list(key: $listKey) { fields { path itemView(id: $id) { fieldMode fieldPosition }}}}}
  }
  ```

Source `getItemValidationAction.ts`:

- Queries `adminMeta.list(key: $listKey).fields { path isNonNull fieldMeta itemView(id: $id) { fieldMode fieldPosition } }`.
- Builds validation map with `isRequired: field.fieldMeta?.validation?.isRequired || false`.

Important source lines:

- `getItemAction.ts:78-86` filters fields and builds selected fields.
- `getItemAction.ts:91-102` item + item-specific adminMeta query.
- `getItemValidationAction.ts:12-31` validation query.

Target mapping:

- Prefer one TanStack loader for item page that returns `{ list, item, validationMeta }`.
- If target GraphQL schema does not support `adminMeta.list(key:)` and `itemView(id:)`, implement equivalent metadata server-side or keep view modes static until Keystone parity exists.

### create/update/delete

Source `features/dashboard/actions/item-actions.ts`:

- `updateItemAction(listKey, id, data)` mutation:
  ```graphql
  mutation ($id: ID!, $data: ${listKey}UpdateInput!) {
    item: update${listKey}(where: { id: $id }, data: $data) { id }
  }
  ```
- `createItemAction(listKey, data, selectedFields = 'id')` mutation:
  ```graphql
  mutation ($data: ${listKey}CreateInput!) {
    item: create${listKey}(data: $data) { ${selectedFields} }
  }
  ```
- `deleteItemAction(listKey, id)` mutation: `delete${listKey}(where: { id: $id }) { id }`.
- `deleteManyItemsAction(listKey, ids, gqlNames)` mutation uses `gqlNames.deleteManyMutationName` and `[${gqlNames.whereUniqueInputName}!]!`.
- Returns Apollo-style `{ errors: [], data }` because UI expects that.
- Calls `revalidatePath`; Next-specific and must be removed/replaced.

Important source lines:

- `item-actions.ts:10-18`, `49-57`, `89-97`, `131-140`.
- `item-actions.ts:28-30`, `67-69`, `107-108`, `151-152` are Next cache invalidation, rewrite.

Target mapping:

- Implement create/update/delete as TanStack Start `createServerFn` or route actions/server functions calling the GraphQL adapter.
- Use TanStack Router `router.invalidate()` and/or query invalidation if React Query is adopted; do not use Next `revalidatePath`.
- Preserve Apollo-style field error shape only if the form layer depends on it.

### auth/session

Source `features/dashboard/actions/auth.ts`:

- `signIn`: GraphQL `authenticateUserWithPassword`, stores `keystonejs-session` HTTP-only cookie with Next `cookies()`, redirects with `next/navigation`.
- `signOut`: GraphQL `endSession`, removes cookie, `revalidatePath`, redirects.
- `getAuthenticatedUser`: GraphQL query:
  ```graphql
  authenticatedItem { ... on User { id email name role { canAccessDashboard } } }
  ```
- `getAuthHeaders`: returns `Cookie: keystonejs-session=${cookie}` for server-side GraphQL requests.
- Also includes sign-up, initial-user, reset-password flows.

Target mapping:

- Rewrite auth using TanStack Start server functions and cookie APIs available in the target runtime (or direct `Request`/`Response` cookie handling in server routes).
- Client routes should redirect with TanStack Router (`redirect` in loaders/actions or `useNavigate`) rather than Next `redirect`/`useRouter`.
- Preserve cookie name `keystonejs-session` if the Keystone backend expects it.

### GraphQL client and uploads

Source `features/dashboard/lib/keystoneClient.ts`:

- Uses `graphql-request` `GraphQLClient` against `getGraphQLEndpoint()`.
- Adds auth headers from cookies.
- Returns `KeystoneResponse<T> = { success: true; data } | { success: false; error; errors? }`.
- Formats GraphQL `ClientError` details.
- Detects `File`/`upload` variables and sends GraphQL multipart request spec:
  - `operations` JSON,
  - `map` JSON,
  - file parts indexed `1`, `2`, etc.

Important source lines:

- `keystoneClient.ts:87-117` main client.
- `keystoneClient.ts:136-187` multipart upload implementation.
- `keystoneClient.ts:224-239` upload detection.

Target mapping:

- Create `src/features/cms/graphql-client.ts` or similar with a generic `cmsGraphQL<T>(query, variables, options)` around `/api/graphql`.
- It should work from:
  - server functions/loaders: absolute URL or request-relative URL, forward cookies,
  - browser components: relative `/api/graphql`, `credentials: 'include'`.
- Consider not adding `graphql-request`; plain `fetch` is enough and already available.
- Keep multipart upload logic for image/file fields when those fields are in scope.

## Field rendering, controllers, validation, form lifecycle

### View registry and field controllers

Source `features/dashboard/views/registry.ts`:

- Imports all field views:
  - `bigInt`, `checkbox`, `decimal`, `document`, `float`, `id`, `image`, `integer`, `json`, `multiselect`, `password`, `relationship`, `select`, `text`, `timestamp`, `virtual`.
- `fieldTypes` maps field type string to implementation.
- `getFieldViews(viewsIndex)` calls generated `getFieldTypeFromViewsIndex(viewsIndex)` then returns implementation.
- Each implementation is expected to export at least `Field` and `controller`; most also export `Cell`, `CardValue`, filters.

Source `features/dashboard/utils/enhanceFields.ts`:

- Validates `Field` and `controller` exports.
- Gets default views by `viewsIndex` and optionally custom views by `customViewsIndex`.
- Builds enhanced field with:
  - normalized `createView`, `itemView`, `listView`,
  - `graphql.isNonNull`,
  - `views`,
  - `controller: views.controller({ listKey, fieldMeta, label, description, path, customViews })`.

Important lines:

- `enhanceFields.ts:8-23` required exports and lookup.
- `enhanceFields.ts:50-69` enhanced field/controller shape.

Target mapping:

- This is one of the highest-value reusable concepts.
- But target metadata currently sets `viewsIndex` to string field kinds, not numeric indices. Options:
  1. Adapt registry to `getFieldViews(field.viewsIndex)` where `viewsIndex` can be a field kind string.
  2. Change target `AdminMetaField.viewsIndex` contract back to numeric and port generated mapping.
- Recommended: make a new portable `viewRegistry` keyed by `fieldMeta.kind` or string `viewsIndex`, while keeping source controller APIs (`defaultValue`, `deserialize`, `serialize`, `validate`, `filter`, `graphqlSelection`). This avoids brittle Keystone numeric view-index coupling.

### Fields component and conditional modes

Source `features/dashboard/components/Fields.tsx`:

- Serializes current form state through controllers.
- Evaluates Keystone conditional field modes using `testFilter`.
- For each visible field, renders `<field.views.Field field={field.controller} value={...} onChange={...} forceValidation={...} isRequired={...} />`.
- Supports groups from `list.groups` and collapsible sections.

Important lines:

- `Fields.tsx:16-39` `testFilter`.
- `Fields.tsx:63-70` serialized state.
- `Fields.tsx:77-92` field mode handling.
- `Fields.tsx:98-108` field rendering contract.

Target mapping:

- Port concept almost directly, replacing imports/UI as needed.
- Make it routing-framework-agnostic. It should not import Next or server actions.
- Use shadcn/base UI primitives already in target.

### Item edit lifecycle

Source `features/dashboard/screens/ItemPage/ItemPageClient.tsx`:

- Enhances fields with `enhanceFields(list.fields, list.key)`.
- Deserializes item data field-by-field via `controller.deserialize(itemForField)`.
- Tracks `value`, `forceValidation`, save state, errors.
- Builds `isRequireds` from enhanced fields + optional adminMeta overrides.
- Uses `useInvalidFields(enhancedFields, value, isRequireds)`.
- Uses `useHasChanges('update', enhancedFields, value, initialValue)`.
- Save flow:
  1. force validation if invalid,
  2. serialize changed fields only: `serializeValueToOperationItem('update', enhancedFields, value, initialValue)`,
  3. call `updateItemAction(list.key, id, changedData)`,
  4. handle GraphQL errors,
  5. show toast, invalidate query.
- Delete flow calls `deleteItemAction`, invalidates list/item queries, navigates back to list.

Important lines:

- `ItemPageClient.tsx:255-263` enhance + deserialize.
- `ItemPageClient.tsx:277-301` requireds, invalid fields, changes.
- `ItemPageClient.tsx:303-349` save lifecycle.

Risks:

- `deserializeItemToValue` currently passes only `item[field.path]` and may not correctly handle controllers whose `graphqlSelection` returns a different root key (`password`, `image`, `relationship count`, `virtual`). A future implementation should parse root GraphQL fields from controller selections or pass the full item to every controller.

### Create lifecycle

Source `features/dashboard/utils/useCreateItem.ts`:

- Makes default value map from `field.controller.defaultValue`.
- Computes create requiredness and invalid fields.
- `create()` validates, serializes all necessary fields with `serializeValueToOperationItem('create', enhancedFields, value)`, calls `createItemAction`, invalidates list queries, returns created item.
- `CreatePageClient` navigates to `${basePath}/${list.path}/${item.id}` after success.

Important lines:

- `useCreateItem.ts:23-35` default values.
- `useCreateItem.ts:50-63` requireds/invalids.
- `useCreateItem.ts:70-113` create flow.

Target mapping:

- Port as a framework-agnostic hook, injecting `createItem` function and navigation callback.
- Or use TanStack Router actions/server functions and component state directly.

### Validation and changed-field detection

Source:

- `features/dashboard/utils/useInvalidFields.tsx`: serializes all fields, calls `field.controller.validate(value, { isRequired })`, returns set of invalid field keys.
- `features/dashboard/utils/useHasChanges.ts`: exact Keystone-style serialize-and-deep-equal comparison using `fast-deep-equal`; includes always-required fields on create/update based on `field.graphql.isNonNull`.

Reusable:

- Port nearly directly.
- Target lacks `fast-deep-equal`; either add it or use an equivalent small comparator.

## Relationship fields

Source relationship implementation is important but coupled to Next and server actions.

Files:

- `features/dashboard/views/relationship/index.tsx`
- `features/dashboard/views/relationship/client/Field.tsx`
- `features/dashboard/views/relationship/client/components/*`
- `features/dashboard/actions/relationship.ts`

Concepts to reuse:

- Controller states:
  - one: `{ kind: 'one', value, initialValue }`,
  - many: `{ kind: 'many', value, initialValue }`,
  - cards: `{ kind: 'cards-view', currentIds, initialIds, itemBeingCreated, itemsBeingEdited, displayOptions }`,
  - count: `{ kind: 'count', count }`.
- GraphQL selection:
  - count: `${path}Count`,
  - normal: `${path} { id label: ${refLabelField} }`.
- Serialize:
  - many produces `connect`/`disconnect` arrays,
  - one produces `connect` or `disconnect: true`,
  - cards produces connect/disconnect by comparing ID sets.
- Filters distinguish one vs many:
  - one: `empty`, `not_empty`, `is`, `not_is`,
  - many: `empty`, `not_empty`, `some`, `not_some`.

Source `getRelationshipOptions` query:

```graphql
query GetOptions($where: ${whereInputName}!, $take: Int!, $skip: Int!) {
  items: ${listQueryName}(where: $where, take: $take, skip: $skip) {
    id
    ${labelField}
    ${extraSelection}
  }
  count: ${listQueryCountName}(where: $where)
}
```

Rewrite requirements:

- Replace `next/link`, `useRouter`, SWR, server actions with TanStack `Link`, local async fetch/server function, and optional query cache.
- Relationship option search should call GraphQL adapter with foreign list gql names.
- Inline create/edit drawer can be phased after basic connect/disconnect works.

## Filters/sorting/field selection UI

Source files:

- `components/FilterBar.tsx`
- `components/FilterAdd.tsx`
- `components/FilterList.tsx`
- `components/SortSelection.tsx`
- `components/FieldSelection.tsx`
- `hooks/useSelectedFields.ts`
- `hooks/useSort.ts`
- `lib/buildWhereClause.ts`
- `lib/buildOrderByClause.ts`
- `lib/sort.ts`

Source behavior:

- Search is URL param `search`.
- Filter URL params use keys like `!${fieldPath}_${filterType}` with JSON string values.
- Sort uses URL param `sortBy`, with descending indicated by `-${field}`.
- Fields use URL param `fields=field1,field2`.
- Pagination uses `page` and `pageSize`.

Target recommendation:

- Use TanStack Router validated search params for list route:
  ```ts
  type ListSearch = {
    page?: number
    pageSize?: number
    search?: string
    sortBy?: string
    fields?: string
    [filterKey: `!${string}`]: string | undefined
  }
  ```
- Build `where/orderBy/selectedFields` in the route loader or a shared `buildListQueryState(list, search)` helper.
- Components update route search with `navigate({ search: old => newSearch })`, not `window.location` or `next/navigation`.

## Field views under `features/dashboard/views`

Potentially reusable field views:

- Good candidates to port early:
  - `text`, `checkbox`, `select`, `multiselect`, `integer`, `float`, `decimal`, `bigInt`, `timestamp`, `id`, `json`, `password`, `virtual`.
- More complex candidates:
  - `relationship`: high value but requires GraphQL option loader and route/navigation rewrite.
  - `image`: requires upload-capable GraphQL client and target storage/API parity.
  - `document`: large Slate/Keystone document editor tree; source uses `@keystone-6/document-renderer`, `@keystone-6/fields-document`, Slate editor code. Target lacks these dependencies. Phase later or replace with Plate if that is the chosen editor.

Caveat: source field components import many source UI files under `@/components/ui/*` such as `field-container`, `field-label`, `field-description`, `empty-state`, `sonner`, etc. Target shadcn/base UI set is not identical. Port controller logic first, then rebuild Field/Cell renderers against target UI primitives.

## Copy vs rewrite matrix

| Source path | Recommendation | Why / notes |
|---|---:|---|
| `features/dashboard/views/*` primitive field controllers | Copy concepts, port selectively | Controller APIs (`defaultValue`, `deserialize`, `serialize`, `validate`, `filter`, `graphqlSelection`) are valuable. Rewrite imports/UI for target shadcn/base. |
| `features/dashboard/views/document/**` | Defer / rewrite carefully | Large editor dependency surface; target lacks document deps. Only port after deciding editor stack and GraphQL document shape. |
| `features/dashboard/views/relationship/**` | Port controller logic, rewrite UI/data fetching | Relationship serialization/filter logic is valuable; Next Link/SWR/server-action pieces must be replaced. |
| `features/dashboard/utils/enhanceFields.ts` | Rewrite around target registry | Preserve contract, but resolve target string `viewsIndex` vs source numeric `viewsIndex`. |
| `features/dashboard/components/Fields.tsx` | Port with UI cleanup | Core conditional field mode/group rendering is portable. |
| `features/dashboard/utils/useInvalidFields.tsx` | Copy/port | Framework agnostic, depends on `Fields.testFilter`. |
| `features/dashboard/utils/useHasChanges.ts` | Copy/port | Framework agnostic except dependency choice (`fast-deep-equal`). |
| `features/dashboard/utils/useCreateItem.ts` | Port pattern, inject mutation/navigation | Currently imports source server action and React Query. |
| `features/dashboard/lib/getGqlNames.ts` | Copy or improve target version | Source uses `pluralize` and Keystone-like `__getNames`; target simplified pluralizer may produce wrong names. |
| `features/dashboard/lib/buildWhereClause.ts` | Copy/port | High-value URL-filter-to-GraphQL builder. Adapt `viewsIndex` mapping and target field kind metadata. |
| `features/dashboard/lib/buildOrderByClause.ts`, `lib/sort.ts` | Copy/port | Small and portable; adapt sort directions if target schema differs. |
| `features/dashboard/lib/keystoneClient.ts` | Rewrite adapter, reuse upload/error ideas | Next cookies/getBaseUrl and graphql-request dependency are not target-native. |
| `features/dashboard/actions/*.ts` | Rewrite as TanStack server functions/loaders/actions | All are Next server actions (`'use server'`), often use Next cache/cookies/redirect. Keep GraphQL query strings/patterns. |
| `features/dashboard/screens/ListPage/**` | Rewrite route component using TanStack loader | Keep data-flow algorithm and UI concepts; replace Next params/search/router. |
| `features/dashboard/screens/ItemPage/**` | Rewrite route component using TanStack loader/action | Keep form lifecycle; replace mutations/navigation/cache. |
| `features/dashboard/screens/CreatePage/**` | Rewrite route component | Keep create lifecycle; replace navigation/actions. |
| `features/dashboard/components/ListTable.tsx` | Rebuild with TanStack/shadcn table | Cell-rendering via `field.views.Cell` and bulk selection/delete are reusable concepts; Next Link/router imports are not. |
| `features/dashboard/components/FilterBar/FilterAdd/FilterList/SortSelection/FieldSelection` | Rebuild URL handling, port controls | UI logic valuable; Next URL/navigation must be replaced with TanStack search state. |
| `features/dashboard/components/DashboardLayout.tsx`, `Sidebar.tsx`, `dual-sidebar/**` | Mostly rewrite | Target already has `DashboardShell`. AI right sidebar can be ported later if desired. |
| `features/dashboard/actions/auth.ts` | Rewrite | Next cookies/redirect/cache; keep GraphQL mutation/query shapes. |
| `app/dashboard/**` | Do not copy | Next App Router-only. Use target `src/routes/dashboard*`. |
| `features/dashboard/hooks/use*.query.ts` | Optional rewrite | If adopting React Query, patterns are useful. Otherwise use TanStack loaders + invalidation. |

## Recommended TanStack-native architecture

### Routes

Recommended target file tree after GraphQL CRUD milestone:

```txt
src/routes/dashboard.tsx                         # shell route, auth/adminMeta loader if global
src/routes/dashboard/index.tsx                   # dashboard home/list cards
src/routes/dashboard/$listKey.tsx                # list page with validated search + loader
src/routes/dashboard/$listKey/create.tsx         # create page
src/routes/dashboard/$listKey/$id.tsx            # item edit/read page
src/routes/dashboard/signin.tsx                  # auth
src/routes/dashboard/signup.tsx                  # optional
src/routes/dashboard/reset.tsx                   # optional
src/routes/dashboard/init.tsx                    # optional initial user
src/routes/dashboard/no-access.tsx               # auth/access denied
src/routes/api/graphql.ts                        # GraphQL Yoga endpoint
```

Route contract:

- `$listKey` should be the list `path` for URLs.
- Loader resolves `{ list }` by path and returns enhanced metadata needed by components.
- List loader reads validated search, builds GraphQL variables, fetches `{ items, count }`.
- Item loader fetches `{ list, item, itemViewMeta/validation }`.
- Create route loader fetches `{ list }`.

### Data/API layer

Proposed modules:

```txt
src/features/dashboard/api/graphql-client.ts      # fetch wrapper, cookies, multipart uploads
src/features/dashboard/api/admin-meta.ts          # fetch/normalize adminMeta
src/features/dashboard/api/list-data.ts           # getListItems, getItem, relationship options
src/features/dashboard/api/mutations.ts           # create/update/delete
src/features/dashboard/api/auth.ts                # signIn/signOut/session/reset/init
src/features/dashboard/lib/gql-names.ts           # Keystone-compatible names
src/features/dashboard/lib/list-query-state.ts    # where/order/selected fields/page from search
src/features/dashboard/lib/field-selections.ts    # controller/type -> GraphQL selection
```

Use TanStack Start `createServerFn` for operations that need server-only cookies/secrets. Use plain shared functions for pure transformations.

### UI/form layer

Proposed modules:

```txt
src/features/dashboard/fields/registry.ts
src/features/dashboard/fields/enhance-fields.ts
src/features/dashboard/fields/Fields.tsx
src/features/dashboard/fields/views/{text,select,...}/index.tsx
src/features/dashboard/forms/use-item-form.ts
src/features/dashboard/forms/use-create-item.ts
src/features/dashboard/forms/use-invalid-fields.ts
src/features/dashboard/forms/use-has-changes.ts
src/features/dashboard/list/ListTable.tsx
src/features/dashboard/list/FilterBar.tsx
src/features/dashboard/list/Pagination.tsx
```

Keep controllers framework-agnostic. Field components can use target shadcn/base UI, but should not import route APIs except via explicit props (`linkTo`, `onNavigate`, etc.).

### Caching/invalidation

Options:

1. TanStack Router only:
   - loaders fetch data,
   - mutations/server functions call GraphQL,
   - after mutation call `router.invalidate()` and navigate.
2. Add React Query:
   - source already uses React Query, but target does not depend on it.
   - useful for relationship option typeahead and background list refetches.

Recommendation: start with Router loaders/actions/server functions for core CRUD. Add React Query only if relationship selects/typeahead need client-side async caching.

## Phased implementation plan after GraphQL milestone

### Phase 0: GraphQL parity prerequisite

Before dashboard rebuild, `/api/graphql` must expose the operations that the dashboard expects:

- `keystone.adminMeta` with list/field shape and preferably `adminMeta.list(key:)` or equivalent item-specific view meta.
- For each list:
  - item query: `${lowerSingular}(where: { id })`,
  - list query: `${lowerPlural}(where, take, skip, orderBy)`,
  - count query: `${lowerPlural}Count(where)`,
  - create/update/delete/deleteMany mutations with Keystone-compatible input names or an adapter that maps to equivalent names.
- Relationship nested selections and count fields.
- Auth mutations/queries if auth is in scope.
- Upload scalar/multipart support before image/file fields.

### Phase 1: Metadata + shell integration

- Replace static `cmsAdminMeta` usage in dashboard routes with loader-fetched adminMeta from `/api/graphql`.
- Normalize list fields to record form for page components.
- Add Keystone-compatible gql names (copy source `getGqlNames` logic or improve target `gql-names.ts`).
- Preserve target `DashboardShell`; add user/profile slot later.

Validation:

- `/dashboard` renders visible lists from GraphQL adminMeta.
- `/dashboard/$path` resolves by `list.path`, not only `list.key`.

### Phase 2: List pages

- Port `buildWhereClause`, `buildOrderByClause`, selected fields logic, pagination.
- Implement `getListItems` through target GraphQL client.
- Build `ListTable` with `field.views.Cell` rendering and item links.
- Implement URL-backed `search`, filters, sort, fields, page/pageSize using TanStack validated search.
- Add bulk delete only after deleteMany mutation exists.

Validation:

- List route fetches correct rows/count.
- Search/filter/sort/page changes update URL and loader variables.
- Initial columns and field selection work.

### Phase 3: Item read/edit pages

- Port/adapt field registry and primitive field views/controllers.
- Implement `Fields`, `useInvalidFields`, `useHasChanges`.
- Loader fetches item with controller-derived GraphQL selections.
- Form deserializes full item through controllers, tracks dirty state, validates, updates via mutation.
- Delete single item and navigate back to list.

Validation:

- Editing text/select/number/checkbox/timestamp/json fields serializes expected GraphQL update input.
- Read/hidden field modes are respected.
- Unsaved changes and validation work.

### Phase 4: Create pages

- Use controller defaults for create state.
- Validate required fields.
- Serialize create input with `serializeValueToOperationItem('create', ...)`.
- Navigate to created item route on success.

Validation:

- Create works for primitive fields.
- Required fields block save and show errors.

### Phase 5: Auth/session/access

- Implement sign-in/sign-out via TanStack server functions and cookies.
- Implement `getAuthenticatedUser` loader/server function.
- Gate dashboard routes based on `role.canAccessDashboard` or target equivalent.
- Add init/reset/signup if required.

Validation:

- Auth cookie persists and is forwarded to GraphQL server calls.
- Unauthenticated users redirect to `/dashboard/signin`.
- No-access state works.

### Phase 6: Relationship fields

- Port relationship controller serialize/deserialize/filter logic.
- Implement basic one/many select using relationship options GraphQL query.
- Add relationship filters.
- Add related item links with TanStack `Link`.
- Add inline create/edit/cards after basic connect/disconnect is stable.

Validation:

- One and many relationships connect/disconnect correctly.
- Relationship option search filters by configured search fields.
- Relationship filters produce valid GraphQL where input.

### Phase 7: Image/file/document

- Implement multipart GraphQL client support.
- Port image field display/upload/delete behavior.
- Decide document editor strategy:
  - port source Slate document tree and dependencies, or
  - implement a simpler editor/renderer compatible with stored document shape, or
  - use Plate if project direction requires it.

Validation:

- Upload variables follow GraphQL multipart spec.
- Image/document data round-trips without corrupting field value shape.

### Phase 8: AI chat/sidebar (optional)

Source has right AI sidebar/chat state in `DashboardLayout`, `components/dual-sidebar/**`, hooks, and `actions/ai-chat.ts`.

- Treat as optional after CRUD. It is not needed for core Keystone dashboard parity.
- If ported, rewrite server actions and state providers for TanStack; target shell already has a sidebar architecture that could host a right panel.
- Source `ai-chat.ts` relies on `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_MAX_TOKENS` and AI SDK-related dependencies. Target lacks these dependencies.

## Key risks and open questions

1. **GraphQL schema parity**: target `/api/graphql` currently only exposes adminMeta. List/item CRUD implementation depends on the GraphQL milestone being complete.
2. **`viewsIndex` mismatch**: source assumes numeric `viewsIndex`; target currently stores string field kind in `viewsIndex`. Decide contract before porting field registry.
3. **Pluralization/name generation**: target `gql-names.ts` has a simplified pluralizer. Keystone-compatible GraphQL names need source/pluralize logic or explicit list plural names.
4. **Auth cookie APIs in TanStack Start**: choose the target-native cookie/session API and ensure server-side GraphQL calls forward `keystonejs-session`.
5. **FieldMeta shape differences**: source controllers assume Keystone fieldMeta details (`validation.length`, `displayMode`, `refLabelField`, `isNullable`, etc.). Target registry must provide equivalent fieldMeta.
6. **Document editor dependency surface**: large and likely incompatible with current target dependencies. Defer until basic CRUD is done.
7. **Uploads**: source multipart logic is valuable, but target GraphQL Yoga version/config must support upload handling.
8. **React Query dependency decision**: source uses it widely; target does not. Avoid adding until necessary, or intentionally add for relationship selects/cache.
9. **Toast/UI components**: source uses `sonner` and source-specific shadcn components not present in target; rebuild UX against target components.
10. **Item deserialization bug risk**: source currently passes only one field root to controllers. Target should pass full item or properly parse controller root selections for complex fields.

## Validation checklist for future implementation

Metadata:

- [ ] `/api/graphql` returns `keystone.adminMeta.lists` with list and field metadata needed by controllers.
- [ ] Lists include `gqlNames`/`graphql.names` matching actual schema operations.
- [ ] `fields` can be consumed as a record keyed by field path.

Routing:

- [ ] `/dashboard` renders shell and list cards.
- [ ] `/dashboard/$listPath` resolves by `list.path`.
- [ ] `/dashboard/$listPath/create` and `/dashboard/$listPath/$id` route correctly.
- [ ] Search params are validated and stable through navigation.

List page:

- [ ] Fetches `items` and `count` using list gql names.
- [ ] Pagination calculates `take`/`skip` correctly.
- [ ] Search uses `initialSearchFields` and ID exact match.
- [ ] Filters produce valid GraphQL `where` for text, numbers, booleans, select, timestamp, relationship.
- [ ] Sort uses initial sort or URL `sortBy`.
- [ ] Field selection changes selected GraphQL fields and table columns.
- [ ] Cells render through field view `Cell` where available.

Item/create forms:

- [ ] Field registry creates controllers for all supported fields.
- [ ] Default values/deserialization/serialization match Keystone input shape.
- [ ] `createView`/`itemView` field modes and groups are respected.
- [ ] Required and custom validation block save/create.
- [ ] Update sends only changed fields except always-required fields.
- [ ] Create sends expected create input and navigates to new item.
- [ ] Delete/deleteMany handle GraphQL errors and invalidate/reload route data.

Auth:

- [ ] Sign-in sets `keystonejs-session` cookie securely.
- [ ] GraphQL client forwards auth cookie on server and uses credentials in browser.
- [ ] Sign-out clears cookie and session.
- [ ] Dashboard access checks authenticated user/role.

Relationship/upload/document:

- [ ] Relationship options query uses foreign list gql names and search fields.
- [ ] Relationship connect/disconnect works for one and many.
- [ ] Image/file upload uses multipart spec and target server accepts it.
- [ ] Document editor decision is validated against stored document JSON shape.

## Bottom-line implementation guidance

Do not copy the Next dashboard wholesale. Rebuild the dashboard around TanStack Router loaders/server functions and the target `DashboardShell`. Port the **contract** and **field-controller model**:

1. adminMeta normalization + gql names,
2. list query state builders (`where`, `orderBy`, selected fields),
3. field registry/controllers/views,
4. form lifecycle (`deserialize -> edit state -> validate -> serialize changed fields -> mutate`),
5. relationship serialization/filter logic,
6. upload support when needed.

Everything that imports `next/*`, uses `'use server'` server actions, `revalidatePath`, `cookies()` from Next, `redirect` from Next, `next/link`, `next/navigation`, React `cache`, SWR/React Query source hooks, or source route layouts should be treated as a reference pattern only and rewritten in TanStack-native form.
