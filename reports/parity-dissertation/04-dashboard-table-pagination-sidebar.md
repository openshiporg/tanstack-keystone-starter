## Review
- Correct:
  - `/Users/junaid/code/tanstack-keystone-starter/src/components/dashboard/keystone-list-table.tsx:16-181` is a close port of `/Users/junaid/code/next-keystone-starter/features/dashboard/components/ListTable.tsx:37-387`: both preserve selection across refetches, render sticky-header tables, support sortable headers, show an Actions/View column, and mount a floating pagination/bulk-action bar.
  - `/Users/junaid/code/tanstack-keystone-starter/src/components/dashboard/pagination.tsx:27-200` matches the functional baseline of `/Users/junaid/code/next-keystone-starter/features/dashboard/components/Pagination.tsx:56-360`: prev/next, direct page entry, total-page display, page-size menu, and delete-confirmation mode are all present.
  - `/Users/junaid/code/tanstack-keystone-starter/src/components/dashboard/dashboard-sidebar.tsx:38-132` and `/Users/junaid/code/tanstack-keystone-starter/src/components/dashboard/user-profile.tsx:28-88` match the active Next dashboard sidebar/profile pattern in `/Users/junaid/code/next-keystone-starter/features/dashboard/components/Sidebar.tsx:54-229` and `/Users/junaid/code/next-keystone-starter/features/dashboard/components/UserProfileClient.tsx:45-146` for dashboard home link, models navigation, footer profile trigger, profile deep-link, GraphQL API link, and logout affordance.
  - `/Users/junaid/code/tanstack-keystone-starter/src/routes/dashboard/index.tsx:20-115` matches the rendered Home/Dashboard card behavior in `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/HomePage/index.tsx:83-158` and `app/dashboard/(admin)/page.tsx:1-3`: same “Dashboard / N Models” header, same empty-state copy, and same singleton-vs-collection card branching.
- Blocker:
  - I did **not** write `/Users/junaid/code/tanstack-keystone-starter/reports/parity-dissertation/04-dashboard-table-pagination-sidebar.md` because the task also said **“Read-only; do not edit.”** I escalated the conflict but got no supervisor reply. Per no-edit rules, I left the repo unchanged.
- Note:
  - `/Users/junaid/code/tanstack-keystone-starter/plan.md` does not exist, so only `progress.md` was readable.
  - I found **no tests** covering these dashboard parity surfaces in either repo (`grep` over `**/*.{test,spec}.{ts,tsx}` returned no matches).

### Current-state parity report

#### Inputs checked
- Missing: `/Users/junaid/code/tanstack-keystone-starter/plan.md`
- Read: `/Users/junaid/code/tanstack-keystone-starter/progress.md`

---

### 1) List table parity

#### Matches
- **Selection state preservation across refetches**
  - TanStack: `src/components/dashboard/keystone-list-table.tsx:22-35`
  - Next: `features/dashboard/components/ListTable.tsx:52-75`
  - Both keep a `{ itemsFromServer, selectedItems }` state object and prune selections when the server item set changes.

- **Bulk delete wiring**
  - TanStack: `src/components/dashboard/keystone-list-table.tsx:37-59`
  - Next: `features/dashboard/components/ListTable.tsx:77-118`
  - Both gather selected ids, execute a many-delete mutation/action, clear selection, and invalidate list queries.

- **Sticky header, sortable columns, explicit Actions column**
  - TanStack: `src/components/dashboard/keystone-list-table.tsx:101-168`, `186-224`
  - Next: `features/dashboard/components/ListTable.tsx:235-369`, `260-310`
  - Both render checkboxes, sortable headers with up/down icons, row cells, and a trailing `View` action.

- **No row-click navigation**
  - TanStack rows are passive `<tr>` elements with cell/action links only: `src/components/dashboard/keystone-list-table.tsx:127-165`
  - Next does the same: `features/dashboard/components/ListTable.tsx:317-365`
  - So row interaction parity is currently **matched**: hover state only, no whole-row click.

#### Differences
1. **Empty-state presentation is simpler in TanStack**
   - TanStack uses inline bordered text blocks:
     - `src/components/dashboard/keystone-list-table.tsx:61-91`
   - Next uses a richer `EmptyState` component with icons and action config:
     - `features/dashboard/screens/ListPage/ListPageClient.tsx:43-64`
     - rendered at `231-238`
   - **Gap impact:** functional parity exists, visual/UX parity does not.
   - **Close gap:** port the `EmptyState` component pattern into TanStack list pages, or wrap the current empty branches in a shared empty-state component with icons/action slots.

2. **Bulk delete success/error feedback is weaker in TanStack**
   - TanStack shows only inline error text and no success confirmation:
     - error state `src/components/dashboard/keystone-list-table.tsx:96-100`
   - Next shows toast success and toast error plus inline error badge:
     - `features/dashboard/components/ListTable.tsx:94-115`, `226-233`
   - **Gap impact:** less obvious feedback after destructive actions.
   - **Close gap:** add toast notifications on success/failure around `deleteSelectedItems()` in TanStack, while preserving the inline error block.

3. **TanStack respects `hideDelete`; Next currently does not**
   - TanStack gates selection UI behind `!data.list.hideDelete`:
     - `src/components/dashboard/keystone-list-table.tsx:21`, `106-117`, `133-146`, `177-180`
   - Next always shows selection/delete affordances:
     - `features/dashboard/components/ListTable.tsx:241-258`, `373-385`
   - **Gap impact:** behavior diverges for lists that should not expose delete.
   - **Close gap:** choose one policy. If strict Next parity is desired, remove the TanStack gate. If product correctness matters more, port the same gate into Next and keep TanStack as-is.

4. **Sort affordance visuals are not identical**
   - TanStack active state is mostly icon opacity:
     - `src/components/dashboard/keystone-list-table.tsx:217-218`
   - Next also colors the active sort arrow blue and changes header text color:
     - `features/dashboard/components/ListTable.tsx:269-305`
   - **Gap impact:** minor visual drift only.
   - **Close gap:** mirror the Next active-color classes in `TableHeaderField`.

---

### 2) Pagination + bulk-action bar parity

#### Matches
- **Floating fixed bottom control**
  - TanStack: `src/components/dashboard/pagination.tsx:91-126`
  - Next: `features/dashboard/components/Pagination.tsx:192-247`

- **Delete confirmation mode**
  - TanStack: `src/components/dashboard/pagination.tsx:89-121`
  - Next: `features/dashboard/components/Pagination.tsx:189-243`

- **Page input, prev/next, page-size controls**
  - TanStack: `src/components/dashboard/pagination.tsx:124-199`
  - Next: `features/dashboard/components/Pagination.tsx:245-360`

#### Differences
1. **TanStack’s normal-mode layout is compressed vs Next’s segmented pills**
   - TanStack combines stats and page input in one center region:
     - `src/components/dashboard/pagination.tsx:136-153`
   - Next renders separate page box, stats box, and page-size box:
     - `features/dashboard/components/Pagination.tsx:260-317`
   - **Gap impact:** visual parity only.
   - **Close gap:** split TanStack’s center area into the same three pill segments as Next.

2. **Next’s delete dialog explicitly closes state; TanStack relies on dialog default behavior**
   - TanStack: `src/components/dashboard/pagination.tsx:97-118`
   - Next: `features/dashboard/components/Pagination.tsx:202-239`
   - **Gap impact:** low; behavior should still work.
   - **Close gap:** optional only—track explicit open state if you want 1:1 behavior.

3. **TanStack hides bulk bar when `onDelete` is absent**
   - TanStack: `src/components/dashboard/pagination.tsx:89`
   - Next: `features/dashboard/components/Pagination.tsx:190`
   - Because TanStack passes `onDelete` only when delete is allowed, selection mode is permission-aware.
   - **Close gap:** same decision as above: keep TanStack correctness, or remove permission gating for strict UI parity.

---

### 3) Table cell rendering parity

#### Matches
- **First field / id links to item detail**
  - TanStack: `src/components/dashboard/keystone-list-table.tsx:231-240`, `294`
  - Next: `features/dashboard/components/ListTable.tsx:142-151`
- **Relationship cells link to related records**
  - TanStack: `src/components/dashboard/keystone-list-table.tsx:260-313`
  - Next: `features/dashboard/views/relationship/index.tsx:43-88`
- **Primitive fallbacks / null handling**
  - TanStack: `src/components/dashboard/keystone-list-table.tsx:243-278`
  - Next: `features/dashboard/components/ListTable.tsx:179-206`

#### Major differences
1. **TanStack does not actually use real per-field view modules for list cells**
   - TanStack `getFieldViews()` returns a single generic `Cell` implementation for every kind:
     - `src/components/dashboard/views/registry.tsx:189-259`
   - Next `getFieldViews()` returns the real field implementation module by `viewsIndex`:
     - `features/dashboard/views/registry.ts:166-175`
   - **Gap impact:** this is the biggest parity gap in the table stack. TanStack cannot match field-specific cell formatting/custom behavior from Next/Keystone.
   - **Close gap:** replace TanStack’s generic registry with a real field-type registry like Next’s, importing actual per-kind implementations and resolving by `viewsIndex`.

2. **TanStack list GraphQL selection is too generic for non-scalar field views**
   - TanStack list query selection only special-cases `password` and `relationship`; everything else is `field.path`:
     - `src/features/cms/graphql-client.ts:282-291`
   - TanStack list page fetch uses those selections directly:
     - `src/features/cms/graphql-client.ts:468-494`
   - Next has field-specific GraphQL selections for `document`, `image`, `virtual`, `relationship count`, etc.:
     - `features/dashboard/actions/getListItemsAction.ts:30-78`, `95-129`
   - **Gap impact:** document/image/virtual/custom relationship-display cells cannot achieve parity because the data shape is wrong before rendering even starts.
   - **Close gap:** port Next’s field-selection logic into TanStack `graphQLSelectionForField()`, at minimum for `document`, `image`, `virtual`, and relationship count/display modes.

3. **TanStack lacks real `supportsLinkTo` behavior from field modules**
   - TanStack synthesizes `supportsLinkTo` from kind names:
     - `src/components/dashboard/views/registry.tsx:211-213`, `251-253`
   - Next reads the actual implementation flags from each field view:
     - e.g. `features/dashboard/views/text/index.tsx:363`
     - `features/dashboard/views/document/index.tsx:302`
     - `features/dashboard/views/multiselect/index.tsx:302`
     - `features/dashboard/views/id/index.tsx:181`
   - **Gap impact:** TanStack can drift from field-module intent whenever a field view’s link support differs from simple kind-based rules.
   - **Close gap:** use the actual field view exports and their `Cell.supportsLinkTo` flags.

4. **Relationship count/display-mode parity is missing**
   - Next handles relationship `displayMode === 'count'` in data selection:
     - `features/dashboard/actions/getListItemsAction.ts:39-45`
   - TanStack always selects relationship `{ id label }`:
     - `src/features/cms/graphql-client.ts:285-288`
   - **Gap impact:** count-style relationship list cells are unsupported.
   - **Close gap:** add display-mode-aware GraphQL selection and view rendering.

5. **List preview table is TanStack-only and currently unused**
   - Component exists: `src/components/dashboard/list-preview-table.tsx:19-157`
   - No usages found.
   - No equivalent surfaced in Next’s dashboard path.
   - **Gap impact:** not a parity blocker for the main dashboard, but it is a second formatting path that can drift from `KeystoneListTable`.
   - **Close gap:** either keep it explicitly as a diagnostic-only component, or make it reuse the same field-view/cell formatting pipeline as the main table.

---

### 4) Action links parity

#### Matches
- **Explicit trailing View link exists in both**
  - TanStack: `src/components/dashboard/keystone-list-table.tsx:156-163`
  - Next: `features/dashboard/components/ListTable.tsx:358-364`

- **Primary navigation is still via linked cells**
  - TanStack: `src/components/dashboard/keystone-list-table.tsx:231-240`, `282-287`
  - Next: `features/dashboard/components/ListTable.tsx:142-151`, `162-171`

#### Differences
1. **Minor styling drift**
   - TanStack `View` link underlines on hover:
     - `src/components/dashboard/keystone-list-table.tsx:160`
   - Next `View` link omits underline:
     - `features/dashboard/components/ListTable.tsx:361`
   - **Close gap:** copy the exact class list from Next if pixel parity matters.

---

### 5) User profile / sidebar account-action parity

#### Matches
- **Profile trigger structure**
  - TanStack: `src/components/dashboard/user-profile.tsx:33-53`
  - Next: `features/dashboard/components/UserProfileClient.tsx:56-78`

- **Profile deep-link row**
  - TanStack: `src/components/dashboard/user-profile.tsx:60-71`
  - Next: `features/dashboard/components/UserProfileClient.tsx:85-107`

- **GraphQL API action**
  - TanStack: `src/components/dashboard/user-profile.tsx:73-77`
  - Next: `features/dashboard/components/UserProfileClient.tsx:110-117`

- **Sidebar footer placement**
  - TanStack: `src/components/dashboard/dashboard-sidebar.tsx:129`
  - Next: `features/dashboard/components/Sidebar.tsx:222-224`

#### Differences
1. **TanStack is missing the Theme action**
   - TanStack profile menu has no theme switcher:
     - `src/components/dashboard/user-profile.tsx:54-83`
   - Next includes Theme + `ThemeSwitcher`:
     - `features/dashboard/components/UserProfileClient.tsx:120-133`
   - I also found no `ThemeSwitcher` or theme-switcher component usage in TanStack.
   - **Gap impact:** missing account action vs active Next dashboard.
   - **Close gap:** port the theme-switcher UI and wiring into TanStack’s dropdown.

2. **Logout is less robust in TanStack**
   - TanStack logout:
     - `src/components/dashboard/user-profile.tsx:79`
     - `src/features/cms/dashboard-session.ts:3-5`
   - It calls `endSession` and only redirects after a successful client request.
   - Next logout always clears auth locally and redirects even if server logout fails:
     - `features/dashboard/actions/auth.ts:131-161`
   - **Gap impact:** network failure can strand TanStack users in a stale authenticated state.
   - **Close gap:** move TanStack logout to a server-backed flow or add a fail-safe that always navigates to `/dashboard/signin` and clears client/session state even when GraphQL fails.

3. **Models section is not collapsible in TanStack’s expanded sidebar**
   - TanStack always renders the submenu open and hard-rotates the chevron:
     - `src/components/dashboard/dashboard-sidebar.tsx:77-96`
   - Next uses `Collapsible` with a real trigger/content pair:
     - `features/dashboard/components/Sidebar.tsx:127-170`
   - **Gap impact:** interaction parity differs in the main sidebar.
   - **Close gap:** wrap TanStack’s models block in the same collapsible structure as Next.

4. **Dual-sidebar demo account actions exist in Next but are not the main baseline**
   - Next also has `features/dashboard/components/dual-sidebar/nav-user.tsx:28-102` with Account/Billing/Notifications, but the active admin sidebar comparison target is `UserProfileClient`, not that demo component.
   - **Recommendation:** use `UserProfileClient` as the parity source of truth, not `dual-sidebar/nav-user.tsx`.

---

### 6) Overview / home-card parity

#### Matches
- **Rendered dashboard route is very close**
  - TanStack route card logic:
    - `src/routes/dashboard/index.tsx:57-105`
  - Next home-card logic:
    - `features/dashboard/screens/HomePage/index.tsx:22-69`
  - Same behavior for:
    - collection cards linking to list pages
    - singleton cards showing “Singleton” / “Create singleton”
    - create button only for non-singleton, non-hidden-create lists
    - empty dashboard copy

- **Header parity**
  - TanStack: `src/routes/dashboard/index.tsx:27-31`
  - Next: `features/dashboard/screens/HomePage/index.tsx:114-121`

#### Differences
1. **TanStack has an unused richer list-card component that diverges from the active rendered card**
   - Unused alternate card:
     - `src/components/dashboard/list-card.tsx:16-54`
   - Active rendered card is inline in route:
     - `src/routes/dashboard/index.tsx:57-105`
   - Next’s active card stays minimal:
     - `features/dashboard/screens/HomePage/index.tsx:22-69`
   - **Gap impact:** not a user-visible parity issue today, but it creates internal drift and confusion.
   - **Close gap:** either:
     - keep the route-level inline card and delete/rename the richer component, or
     - intentionally switch to the richer card and port an equivalent to Next if that is the new desired design.

2. **Shared singleton-id limitation exists in both repos**
   - TanStack uses hardcoded `'1'` for singleton detail links:
     - `src/routes/dashboard/index.tsx:64`, `71`
   - Next does too via `/1`:
     - `features/dashboard/screens/HomePage/index.tsx:24`, `49`
   - This is **not** a parity gap, but it is a shared implementation quirk.

---

### Recommended closure order

1. **Highest priority:** real field-view parity
   - `src/components/dashboard/views/registry.tsx`
   - `src/features/cms/graphql-client.ts`
   - Port true per-field implementations + proper GraphQL selections.

2. **High priority:** sidebar account parity
   - `src/components/dashboard/user-profile.tsx`
   - `src/features/cms/dashboard-session.ts`
   - Add Theme action; harden logout.

3. **Medium priority:** sidebar collapsible behavior
   - `src/components/dashboard/dashboard-sidebar.tsx`
   - Port `Collapsible` behavior from Next.

4. **Medium priority:** bulk delete UX polish
   - `src/components/dashboard/keystone-list-table.tsx`
   - Add success/error toasts or equivalent transient feedback.

5. **Low priority:** empty-state and visual polish
   - `src/components/dashboard/keystone-list-table.tsx`
   - `src/components/dashboard/pagination.tsx`

6. **Low priority:** remove parity drift from unused components
   - `src/components/dashboard/list-card.tsx`
   - `src/components/dashboard/list-preview-table.tsx`

If you want, I can reformat this directly into the requested `.md` file content once the no-edit constraint is lifted.