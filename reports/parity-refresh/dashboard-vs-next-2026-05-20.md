# Dashboard vs Next parity refresh — 2026-05-20

Compared:
- Target: `/Users/junaid/code/tanstack-keystone-starter`
- Reference: `/Users/junaid/code/next-keystone-starter`

Audit inputs used as starting context, then re-validated directly against code:
- `reports/parity-dissertation/01-dashboard-shell-auth-ai.md`
- `02-dashboard-list-filters-sort.md`
- `03-dashboard-create-item-controllers.md`
- `04-dashboard-table-pagination-sidebar.md`
- `05-dashboard-relationships-singletons-navigation.md`
- `10-validation-acceptance-matrix.md`

This refresh is intentionally **code-first**. Earlier audits were helpful, but several findings are now stale because the target has moved.

---

## 1) Current honest parity status

## Overall verdict

The TanStack target is now at **solid functional parity for the dashboard shell, auth route surface, list/table/pagination basics, singleton routing basics, and a real `/api/completion` route exists**. It is **not yet at real Next parity** for the full admin/dashboard experience because the remaining gaps cluster around:

1. **AI assistant depth**: target now has a real route, but it is still a simple prompt-response helper, not the streaming/tool-based CRUD assistant in Next.
2. **Create/item controller architecture**: target improved beyond older audits, but still uses a simplified registry/editor stack rather than Next’s full field-view/controller ecosystem.
3. **Field-specific fidelity**: list cells, form fields, document/image/relationship/controller semantics, and some UX affordances remain simplified.
4. **Shell/provider polish**: target still lacks dashboard theme/toast parity and some shared-provider composition from Next.

## Status by area

| Area | Honest status |
|---|---|
| Dashboard shell/layout | **Partial-high** |
| Auth screens + gating | **High** |
| AI assistant | **Partial-low** |
| List route/search/filter/sort/columns | **Partial-high** |
| List table + pagination + bulk delete | **High** |
| Sidebar + user menu | **Partial-high** |
| Create page | **Partial-medium** |
| Item page | **Partial-medium** |
| Relationship editor/filter | **Partial-medium** |
| Singleton behavior/navigation | **High** |
| Validation / acceptance coverage | **Still incomplete** |

---

## 2) Stale findings that are now closed

These were materially true in prior audits, but are no longer accurate in the current target.

### Closed: there is now a real `/api/completion` route
Earlier audit 01 treated `/api/completion` as missing. That is now stale.

**Target evidence**
- `src/routes/api/completion.ts:1-18` defines `createFileRoute('/api/completion')` with a real POST handler.
- `src/features/cms/dashboard-completion.ts:1-73` implements request handling and dashboard-auth checks.
- `src/components/dashboard/chat-mode.tsx:54-69` posts real requests to `completionEndpoint`.

**But** parity is still incomplete because the implementation is much simpler than Next’s streaming/tool-based route; see remaining gaps.

### Closed: AI is no longer a pure local stub
Earlier audit 01 described the assistant as effectively stubbed. That is stale.

**Target evidence**
- `src/components/dashboard/chat-mode.tsx:53-69` performs a real fetch to `/api/completion`.
- `src/features/cms/dashboard-completion.ts:27-73` returns contextual responses based on auth state, visible lists, and prompt intent.

**Reality now**
- The target assistant is real, authenticated, and backend-backed.
- It is still far behind Next’s assistant in capability.

### Closed: missing-singleton rendering is no longer blocked by an undefined component
Earlier audit 05 flagged a broken `MissingSingletonItem` reference. That is stale.

**Target evidence**
- `src/routes/dashboard/$listKey.$id.tsx:155-163` now handles missing singleton/non-singleton branches inline.
- `src/routes/dashboard/$listKey.$id.tsx:243-360` defines `MissingSingletonMessage` and `SingletonCreateForm` locally.
- Grep for `MissingSingletonItem` in `src` returns no matches.

### Closed: list empty-state filter detection now matches Next’s simpler behavior
Earlier audit 02 described target `isFiltered` as considering `!filters`; that is stale.

**Target evidence**
- `src/routes/dashboard/$listKey.tsx:67-68` sets `isFiltered = Boolean(search.search.trim())`.
- This matches Next’s `ListPageClient`, where `hasFilters` / `isFiltered` is driven only by `searchString`: `features/dashboard/screens/ListPage/ListPageClient.tsx:210-211`.

### Closed: filter-pill edit now removes sibling filters for the same field
Earlier audit 02 flagged divergence here. That is stale.

**Target evidence**
- `src/components/dashboard/filter-bar.tsx:84-91` defines `removeSiblingFieldFilters(...)`.
- `src/components/dashboard/filter-bar.tsx:108-117` uses it in `updateFilter(...)` before saving the edited pill.
- This mirrors Next `FilterList` behavior: `features/dashboard/components/FilterList.tsx:240-252`.

### Closed: several filter operator mismatches identified earlier have already been fixed
Examples from older audit 02 that are now stale:
- checkbox now uses `is/not` in target: `src/components/dashboard/views/registry.tsx:167-172`, `src/features/cms/graphql-client.ts:257-268, 340-345`
- integer/float now include `empty/not_empty`: `src/components/dashboard/views/registry.tsx:154-166`, `src/features/cms/graphql-client.ts:257-268, 346-353`
- multiselect now uses `matches/not_matches`: `src/components/dashboard/views/registry.tsx:173`, `src/features/cms/graphql-client.ts:257-268, 354-357`
- document filters now exist: `src/components/dashboard/views/registry.tsx:174`, `src/features/cms/graphql-client.ts:257-268, 286-291`

### Closed: relationship option loading now honors field-specific label/search metadata
Earlier audit 05 flagged loss of `refLabelField` / `refSearchFields`. That is stale.

**Target evidence**
- relationship field editor derives `labelField` and `searchFields`: `src/components/dashboard/relationship-field-editor.tsx:37-40`
- relationship filter input does the same: `src/components/dashboard/views/relationship-filter-input.tsx:24-27`
- both pass `config` into option fetchers: editor `:53-57, 61-64`; filter input `:44-48, 50-53`
- data layer honors those values: `src/features/cms/graphql-client.ts:562-585`, `587-602`

### Closed: many-relationship filter edit corruption is fixed
Earlier audit 05 said pill edit flattened arrays into one string. That is stale.

**Target evidence**
- `formatEditableFilterValue(...)` now preserves parsed arrays rather than coercing to comma-joined strings: `src/components/dashboard/filter-bar.tsx:417-424`
- relationship filter input preserves arrays for `some/not_some`: `src/components/dashboard/views/relationship-filter-input.tsx:33-34, 64-66`

---

## 3) Remaining gaps

## High gaps

### H1. AI assistant is still far behind Next’s real dashboard assistant
**Why high:** this is the single largest capability delta remaining in the dashboard shell.

**Target**
- simple request/response route: `src/routes/api/completion.ts:1-18`
- prompt handler is rule-based/contextual, not model-streaming: `src/features/cms/dashboard-completion.ts:27-73`
- chat client stores plain `{ id, role, text }` messages and expects one JSON response: `src/components/dashboard/chat-mode.tsx:5-17, 34-69`
- sidebar renders plain text bubbles only: `src/components/dashboard/ai-chat-sidebar.tsx:11-17, 43-101`

**Next**
- streaming UI via `useChat` and `DefaultChatTransport`: `features/dashboard/components/dual-sidebar/ai-chat-sidebar.tsx:4-5, 73-90`
- markdown rendering and richer message part handling: `features/dashboard/components/dual-sidebar/ai-chat-sidebar.tsx:6-8, 151-199`
- CRUD tool detection invalidates all queries on finish: `features/dashboard/components/dual-sidebar/ai-chat-sidebar.tsx:45-71, 81-89`
- API route integrates OpenRouter + MCP tools + streaming: `app/api/completion/route.ts:1-293`

**Practical delta**
- no streaming
- no MCP tools
- no AI CRUD
- no local/shared key modes
- no model/maxTokens config UX
- no markdown/tool-call transcript rendering

### H2. Dashboard root still lacks theme/toast parity
**Target**
- root shell has no `ThemeProvider` or `Toaster`: `src/routes/__root.tsx:38-58`
- grep in `src` found no theme/toast usage

**Next**
- dashboard layout wraps with `ThemeProvider` and `Toaster`: `app/dashboard/layout.tsx:1-24`
- item page uses `toast` heavily for save/delete/copy feedback: `features/dashboard/screens/ItemPage/ItemPageClient.tsx:26, 69-79, 292-346`
- list table also uses success/error toast semantics in older audit reference

**Impact**
- target still relies on inline messages in places where Next uses global feedback
- no theme action parity in user dropdown because there is no corresponding root theme plumbing

### H3. Create/item still do not use Next’s full field-view/controller ecosystem
The target has improved from the older “generic manual editor” story, but parity is still not full.

**Target**
- now uses `enhanceFields(...)` and `EnhancedFormFields`: `src/routes/dashboard/$listKey.create.tsx:35-45, 94-114`; `src/routes/dashboard/$listKey.$id.tsx:63-87, 219-238`
- `EnhancedFormFields` evaluates conditional field modes and per-field validation markers: `src/components/dashboard/enhanced-form-fields.tsx:47-66, 105-140`
- but field registry still maps every kind through one simplified `RegistryField` / `FieldValueEditor` path: `src/components/dashboard/views/registry.tsx:191-217, 251-259`
- `FieldValueEditor` still handles document/image/file/json via generic textarea / generic file editor patterns, not Next field modules: `src/components/dashboard/field-value-editor.tsx:139-201`

**Next**
- `Fields` renders true per-view modules: `features/dashboard/components/Fields.tsx:57-114`
- registry resolves real field implementations by `viewsIndex`: `features/dashboard/views/registry.ts` (see earlier audit source inventory)
- create/item rely on controller contracts and field modules, not one generic editor path: `features/dashboard/screens/CreatePage/CreatePageClient.tsx:48-57, 158-185`; `features/dashboard/screens/ItemPage/ItemPageClient.tsx:255-301, 505-547`

**Impact**
- target can now do much more than older audits suggested
- but still cannot claim true parity for rich field-specific create/item behavior

### H4. List/table cell rendering still uses a simplified registry instead of real field modules
**Target**
- `getFieldViews(...)` always returns a local generic `Cell` implementation plus `RegistryField`: `src/components/dashboard/views/registry.tsx:251-259`
- list table tries to use `getFieldViews(...)`, but it still resolves to the simplified local cell stack: `src/components/dashboard/keystone-list-table.tsx:250-263`

**Next**
- registry maps to real per-kind field implementations under `features/dashboard/views/**`
- list rendering benefits from field-specific `Cell.supportsLinkTo`, selection, and formatting conventions

**Impact**
- text/select/multiselect/relationship basics are decent
- richer field fidelity remains behind for document/image/virtual/custom behaviors

## Medium gaps

### M1. Provider composition still lighter than Next
**Target**
- `DashboardProviders` includes `DashboardProvider`, `AiConfigProvider`, `ChatModeProvider`, `SidebarProvider`: `src/components/dashboard/dashboard-providers.tsx:26-34`
- overview data is fetched inside shell: `src/components/dashboard/dashboard-shell.tsx:7-16`

**Next**
- `DashboardLayout` includes `ErrorBoundary`, `QueryProvider`, `DashboardProvider`, `AdminMetaProvider`, `AiConfigProvider`, `ChatModeProvider`, `SidebarProvider`: `features/dashboard/components/DashboardLayout.tsx:109-137`
- server admin layout prefetches adminMeta + user and passes them into the client layout: `app/dashboard/(admin)/layout.tsx:5-20`

**Impact**
- target works, but composition is less aligned and less reusable than Next

### M2. Sidebar/user menu are close, but still missing theme action parity and collapsible Models section
**Target**
- user profile includes profile link, GraphQL API, logout: `src/components/dashboard/user-profile.tsx:30-78`
- no theme action
- desktop Models group is always expanded with a hard-rotated chevron: `src/components/dashboard/dashboard-sidebar.tsx:63-86`

**Next**
- user menu includes theme switcher: `features/dashboard/components/UserProfileClient.tsx:16-24, 111-133`
- Models uses real `Collapsible`: `features/dashboard/components/Sidebar.tsx:20-24, 108-151`

### M3. AI config is still much smaller than Next’s persisted AI settings model
**Target**
- `AiKeyMode = 'server'` only: `src/components/dashboard/ai-config.tsx:3`
- config shape is just `enabled`, `completionEndpoint`, `keyMode`: `src/components/dashboard/ai-config.tsx:5-9`

**Next**
- richer config hook with env/local key modes and client persistence semantics: `features/dashboard/hooks/use-ai-config.tsx` (see earlier audit and file inventory)
- chat sidebar branches on `local` mode and shared keys flow: `features/dashboard/components/dual-sidebar/ai-chat-sidebar.tsx:92-136`

### M4. Save/delete/create feedback is still mostly inline instead of toast-driven
**Target**
- item page uses `message` banner strings for save/reset/delete/copy: `src/routes/dashboard/$listKey.$id.tsx:53-56, 89-150, 223-236`
- create page uses inline error block only: `src/routes/dashboard/$listKey.create.tsx:31-33, 98-113`

**Next**
- item page uses toast feedback on save/delete/copy failures and successes: `features/dashboard/screens/ItemPage/ItemPageClient.tsx:69-79, 292-346`

### M5. AI invalidation is narrower than Next
**Target**
- dashboard providers invalidate only admin/list-area queries via a predicate around `dashboardQueryKeys.adminMeta[0]`: `src/components/dashboard/dashboard-providers.tsx:14-20`
- current completion path almost never requests invalidation anyway: `src/features/cms/dashboard-completion.ts:59-64`

**Next**
- AI sidebar invalidates all queries when CRUD tools were used: `features/dashboard/components/dual-sidebar/ai-chat-sidebar.tsx:81-89`

### M6. Item/list GraphQL selection is improved but still not fully controller-driven
**Target**
- `graphQLSelectionForField(...)` supports explicit `fieldMeta.graphqlSelection`, password, relationship label selection, and otherwise falls back to field path: `src/features/cms/graphql-client.ts:238-248`
- item/list fetches use that helper: `src/features/cms/graphql-client.ts:486-487, 504-505`

**Next**
- field selection is designed around controller requirements and richer per-field modules, including helpers like `getRootGraphQLFieldsFromFieldController`: `features/dashboard/lib/getRootGraphQLFieldsFromFieldController.ts:1-19`

**Impact**
- target is no longer as hardcoded as older audits claimed
- still not fully equivalent to Next’s field-module-driven data requirements

## Low gaps

### L1. Sort UX/labels differ slightly
- target trigger says `SORT` / `COLUMNS`: `src/components/dashboard/filter-bar.tsx:251-266, 317-353`
- Next uses similar semantics but different button labels/structure (`Display`, wrapped trigger composition): `features/dashboard/components/FilterBar.tsx:102-141`

### L2. Home/list empty states are simpler than Next’s richer EmptyState component language
- target uses custom inline empty blocks: `src/routes/dashboard/index.tsx:110-120`; `src/components/dashboard/keystone-list-table.tsx:60-90`
- Next uses a shared EmptyState component in list flows: `features/dashboard/screens/ListPage/ListPageClient.tsx:31-53, 214-238`

### L3. Logout robustness may still differ from Next server-action semantics
- target client logout entry point: `src/components/dashboard/user-profile.tsx:11-12, 76-78`
- Next uses server action form submission: `features/dashboard/components/UserProfileClient.tsx:135-140`

### L4. Validation/acceptance coverage is still below parity-signoff quality
The earlier validation matrix remains directionally correct here.
- no dashboard browser acceptance suite was found in current target review
- no theme/toast/browser-level parity coverage
- current report is code-evidence only, not behaviorally re-run

---

## 4) Easiest copy/adapt opportunities from the Next implementation

These are the highest leverage imports/pattern ports because they map cleanly onto current target structure.

### Opportunity 1: shell theme/toast parity
**Copy/adapt from**
- `app/dashboard/layout.tsx:1-24`
- `features/dashboard/components/UserProfileClient.tsx:16-24, 111-133`

**Why easy**
- isolated shell concern
- no deep data-model coupling
- unblocks theme action parity and toast-based feedback patterns

### Opportunity 2: user-menu theme row and sidebar collapsible Models behavior
**Copy/adapt from**
- `features/dashboard/components/UserProfileClient.tsx:111-133`
- `features/dashboard/components/Sidebar.tsx:108-151`

**Why easy**
- current target structure is already very close
- mostly UI composition work

### Opportunity 3: AI chat rendering layer
**Copy/adapt from**
- `features/dashboard/components/dual-sidebar/ai-chat-sidebar.tsx:73-225`

**Why easy/medium**
- target already has right sidebar shell and chat area
- the biggest lift is transport/API capability, but the UI shell can be adapted incrementally

### Opportunity 4: dashboard provider composition
**Copy/adapt from**
- `features/dashboard/components/DashboardLayout.tsx:109-137`
- `app/dashboard/(admin)/layout.tsx:5-20`

**Why easy/medium**
- target composition is already close in concept
- can be tightened without changing page routes much

### Opportunity 5: richer item-page success/error handling
**Copy/adapt from**
- `features/dashboard/screens/ItemPage/ItemPageClient.tsx:69-79, 292-346`

**Why easy/medium**
- target item page already has equivalent mutation points
- mostly replace inline message banners with toast + detail dialogs

### Opportunity 6: deeper field-module parity for list/create/item
**Copy/adapt from**
- `features/dashboard/views/**`
- `features/dashboard/components/Fields.tsx:57-114`
- `features/dashboard/utils/enhanceFields.ts:1-82`

**Why medium/hard**
- biggest behavior win after AI
- but requires deeper registry/controller alignment than simple shell changes

---

## 5) Exact target files likely to change

If the goal is real parity, these are the most likely target touchpoints.

## AI + shell
- `src/routes/__root.tsx`
- `src/components/dashboard/dashboard-providers.tsx`
- `src/components/dashboard/dashboard-layout.tsx`
- `src/components/dashboard/ai-config.tsx`
- `src/components/dashboard/chat-mode.tsx`
- `src/components/dashboard/ai-chat-sidebar.tsx`
- `src/routes/api/completion.ts`
- `src/features/cms/dashboard-completion.ts`
- potentially new target equivalents for theme/toaster/settings UI under `src/components/ui/` and `src/components/dashboard/`

## Sidebar / user menu
- `src/components/dashboard/dashboard-sidebar.tsx`
- `src/components/dashboard/user-profile.tsx`

## List/table parity
- `src/components/dashboard/filter-bar.tsx`
- `src/components/dashboard/keystone-list-table.tsx`
- `src/components/dashboard/pagination.tsx`
- `src/components/dashboard/views/registry.tsx`
- `src/features/cms/graphql-client.ts`

## Create/item/controller fidelity
- `src/components/dashboard/enhance-fields.tsx`
- `src/components/dashboard/enhanced-form-fields.tsx`
- `src/components/dashboard/field-value-editor.tsx`
- `src/components/dashboard/relationship-field-editor.tsx`
- `src/components/dashboard/views/relationship-filter-input.tsx`
- `src/routes/dashboard/$listKey.create.tsx`
- `src/routes/dashboard/$listKey.$id.tsx`

## Acceptance coverage
- likely new tests under `tests/` for dashboard/browser/API transport parity

---

## 6) Top 10 implementation actions required to reach real parity

1. **Replace the simple AI completion flow with a streaming/tool-based transport**
   - Bring target `/api/completion` closer to `app/api/completion/route.ts:1-293`.
   - Add real model-backed assistant behavior, not just contextual canned replies.

2. **Expand AI config beyond `server` mode only**
   - Port/adapt Next AI config semantics for shared/local keys and persisted settings.
   - Current blocker: `src/components/dashboard/ai-config.tsx:3-22` is too small.

3. **Upgrade `AiChatSidebar` to render streaming/markdown/tool-aware messages**
   - Current target sidebar is plain text only: `src/components/dashboard/ai-chat-sidebar.tsx:11-17, 43-101`.
   - Use Next’s chat UI patterns as the reference.

4. **Add dashboard `ThemeProvider` + `Toaster` at app shell level**
   - Required to match Next shell behavior and unlock theme action parity.

5. **Add theme switcher parity to the user dropdown and make Models truly collapsible**
   - `src/components/dashboard/user-profile.tsx`
   - `src/components/dashboard/dashboard-sidebar.tsx`

6. **Move target field registry closer to real per-kind field modules**
   - Current simplified registry is the main reason create/item/list fidelity is still behind.
   - Start with highest-impact field kinds: relationship, document, image, select/multiselect, password.

7. **Make list/item/create GraphQL selection fully controller-driven**
   - Build on current `graphQLSelectionForField(...)` instead of stopping at field path / simple special cases.
   - Needed for field-module parity.

8. **Replace inline save/delete/create feedback with toast + richer error details**
   - Especially on item route and bulk delete flows.
   - Align target UX with Next item/list behavior.

9. **Tighten provider/layout composition to match Next’s dashboard-scoped architecture**
   - Add explicit dashboard-level provider stack and preloaded admin/user layout data seams.

10. **Add acceptance coverage for dashboard routes, list flows, item/create flows, and HTTP/AI transport**
   - Without this, parity claims will remain fragile even after implementation work.

---

## Appendix: evidence highlights by area

### Shell/auth areas already close
- Dashboard guard behavior: `src/routes/dashboard.tsx:17-38`
- Home dashboard cards and singleton links: `src/routes/dashboard/index.tsx:49-107`
- Auth routes present and functional:
  - signin `src/routes/dashboard/signin.tsx:1-114`
  - signup `src/routes/dashboard/signup.tsx:1-116`
  - reset `src/routes/dashboard/reset.tsx:1-123`
  - init `src/routes/dashboard/init.tsx:1-110`
  - no-access `src/routes/dashboard/no-access.tsx:1-38`

### List/table basics already close
- list route data loading and canonical path handling: `src/routes/dashboard/$listKey.tsx:18-43`
- filter/search/sort/field controls: `src/components/dashboard/filter-bar.tsx:21-224`
- table, selection, bulk delete, actions: `src/components/dashboard/keystone-list-table.tsx:14-190`
- pagination control: `src/components/dashboard/pagination.tsx:1-198`

### Create/item have improved substantially from older audits
- create route now uses enhanced fields + validation set: `src/routes/dashboard/$listKey.create.tsx:35-68`
- item route now overlays runtime `itemView` metadata and uses enhanced fields: `src/routes/dashboard/$listKey.$id.tsx:59-87`
- conditional field mode resolution exists: `src/components/dashboard/field-value-editor.tsx:41-52`
- requiredness uses runtime view metadata in validation path: `src/components/dashboard/enhanced-form-fields.tsx:55-66, 111-140`

### But Next still remains deeper and richer
- dashboard provider/layout composition: `features/dashboard/components/DashboardLayout.tsx:109-137`
- server layout prefetch: `app/dashboard/(admin)/layout.tsx:5-20`
- shell theme/toast: `app/dashboard/layout.tsx:1-24`
- streaming AI sidebar: `features/dashboard/components/dual-sidebar/ai-chat-sidebar.tsx:73-225`
- full completion route: `app/api/completion/route.ts:1-293`
- richer field rendering stack: `features/dashboard/components/Fields.tsx:57-114`

---

## Bottom line

The target repo has advanced enough that some earlier audits are now too pessimistic. In particular, **AI route existence, filter semantics, relationship metadata handling, and singleton missing-item handling have improved and several earlier red flags are closed**.

However, the target is **still not at true dashboard/admin UI parity with the Next reference**. The biggest remaining work is not basic routing or list CRUD scaffolding anymore; it is the **depth and polish layer**:
- real streaming AI + tool execution
- richer shell provider/theme/toast behavior
- field-module/controller fidelity across list/create/item
- stronger acceptance coverage

That is the honest parity picture as of 2026-05-20.
