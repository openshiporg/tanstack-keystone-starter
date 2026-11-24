# Dashboard shell/nav hostile audit

## Scope
Compared local dashboard home/sidebar/nav/AI right sidebar/user profile in `tanstack-keystone-starter` against upstream `next-keystone-starter/features/dashboard` components only.

## Findings

### 1. Local sidebar flattened the models navigation and dropped the grouped/collapsible nav structure
- **Local** renders one flat `SidebarMenu` containing the dashboard home item followed by every list item directly. There is no `SidebarGroup`, `SidebarGroupLabel`, `Collapsible`, `SidebarMenuSub`, or icon-mode dropdown for models: `src/components/dashboard/dashboard-sidebar.tsx:37-79`.
- **Upstream** explicitly separates dashboard home from a labeled **Models** section, then renders model links inside a collapsible submenu in expanded mode and a dropdown in icon-collapsed mode: `../next-keystone-starter/features/dashboard/components/Sidebar.tsx:112-219`.
- **Impact:** local loses the upstream IA entirely. In collapsed/icon mode, upstream preserves access to model links via a dropdown; local just hides labels and leaves a long ungrouped list of anonymous-ish entries. That is a substantial shell/navigation regression, not a styling nit.

### 2. Local sidebar omitted upstream icon-collapsed navigation fallback
- **Local** uses `collapsible="icon"` but provides no alternative navigation UI when the sidebar is collapsed; every list remains a plain `SidebarMenuButton` with text only: `src/components/dashboard/dashboard-sidebar.tsx:38-79`.
- **Upstream** adds a dedicated icon-mode `DropdownMenu` so collapsed sidebars still expose the models list with active-state indication: `../next-keystone-starter/features/dashboard/components/Sidebar.tsx:173-216`.
- **Impact:** local collapsed navigation is materially weaker. Upstream supports discoverability and selection while collapsed; local effectively expects users to expand the rail to navigate lists.

### 3. Local sidebar removed model-section labeling and hierarchy
- **Local** has no label like “Models”; it renders all list links at the same level as Dashboard home: `src/components/dashboard/dashboard-sidebar.tsx:52-74`.
- **Upstream** labels the section with `SidebarGroupLabel>{dashboardItem.title}</SidebarGroupLabel>` where `dashboardItem.title` is `"Models"`: `../next-keystone-starter/features/dashboard/components/Sidebar.tsx:87-95,129-148`.
- **Impact:** local degrades information scent. Users cannot distinguish shell-level navigation from data-model navigation.

### 4. Local shell has no right sidebar wired into the dashboard layout
- **Local** `DashboardLayout` renders only `DashboardSidebar` and `SidebarInset`; there is no `RightSidebar` mounted anywhere: `src/components/dashboard/dashboard-layout.tsx:16-20`.
- **Local** does define a `RightSidebar` component, but it is orphaned: `src/components/dashboard/right-sidebar.tsx:7-15`.
- **Upstream reference set** includes a right-sidebar component wrapping `AiChatSidebar`: `../next-keystone-starter/features/dashboard/components/dual-sidebar/right-sidebar.tsx:7-15`.
- **Impact:** the local dashboard has AI sidebar code on disk but not in the shell. From a shell audit standpoint, this is dead feature surface, not parity.

### 5. Local AI sidebar is a stripped-down rewrite, not an upstream-equivalent port
- **Local** chat UI is driven by a custom `useChatMode()` hook with simple `messages`, `sendMessage`, `sending`, and a local enable/disable toggle: `src/components/dashboard/ai-chat-sidebar.tsx:23-35,44-56`.
- **Upstream** uses `useChat` from `@ai-sdk/react`, streams through `DefaultChatTransport`, checks returned tool invocations for CRUD actions, and invalidates queries after mutating responses: `../next-keystone-starter/features/dashboard/components/dual-sidebar/ai-chat-sidebar.tsx:4-6,50-76,86-96`.
- **Impact:** local dropped the upstream mutation-awareness loop. Upstream can refresh dashboard data after AI-assisted create/update/delete; local shows no equivalent invalidation path in this component.

### 6. Local AI sidebar dropped upstream model/key-mode controls
- **Local** footer offers only a send button and a coarse enable/disable switch: `src/components/dashboard/ai-chat-sidebar.tsx:44-52,83-102`.
- **Upstream** includes `ModeSplitButton`, supports local/shared key modes via `useAiConfig`, and fetches shared keys with `getSharedKeys()`: `../next-keystone-starter/features/dashboard/components/dual-sidebar/ai-chat-sidebar.tsx:20,23-25,106-142,235-247`.
- **Impact:** local AI sidebar is operationally reduced. The upstream component supports model/key selection and shared-key fallback; local removed those capabilities from the dashboard shell.

### 7. Local AI message rendering is downgraded from markdown/tool-aware content to plain text bubbles
- **Local** always renders assistant message text inside `<p>` with no markdown handling: `src/components/dashboard/ai-chat-sidebar.tsx:12-20,68-70`.
- **Upstream** extracts text parts from multi-part AI messages and renders assistant output through `ReactMarkdown` with GFM/breaks and custom code/list formatting: `../next-keystone-starter/features/dashboard/components/dual-sidebar/ai-chat-sidebar.tsx:52-58,170-205`.
- **Impact:** local removes rich response rendering, code formatting, and better structured AI output handling.

### 8. Local AI empty/error states are different and materially simpler than upstream
- **Local** shows a bespoke dashed empty-state card plus a dismissible bordered error box: `src/components/dashboard/ai-chat-sidebar.tsx:61-79`.
- **Upstream** delegates empty-state UX to `ChatEmptyState`, includes scroll anchoring/scroll button infrastructure, and exposes transport errors inline as `Error: {error.message}`: `../next-keystone-starter/features/dashboard/components/dual-sidebar/ai-chat-sidebar.tsx:10-15,24,167-168,210-220`.
- **Impact:** local has a lighter implementation but also lacks the upstream chat ergonomics like anchored scrolling and quick return-to-bottom behavior.

### 9. Local home route is client-query based; upstream home screen is server-fetched
- **Local** dashboard home uses a route loader plus `useSuspenseQuery(fetchDashboardOverview)` in the client component: `src/routes/dashboard/index.tsx:11-24`.
- **Upstream** `HomePage` is an async server component that calls `getAdminMetaAction()` and then `getListCounts()` on the server: `../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx:83-112`.
- **Impact:** the shell/home data path diverges sharply. This may be intentional due to framework differences, but it is still a concrete architectural delta from upstream’s dashboard home.

### 10. Local home cards hardcode singleton route param `id: '1'`
- **Local** links singleton cards to `/dashboard/$listKey/$id` with `id: '1'` regardless of actual singleton item id, even when `list.singletonItemId` exists: `src/routes/dashboard/index.tsx:62-76`.
- **Upstream** computes `href` from `list.path` and also uses `/1` for singleton navigation, but it separately derives `singletonItemId` from count data and uses it to decide whether the singleton is missing: `../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx:22-25,33-39,145-150`.
- **Impact:** both codebases still route singleton detail to `/1`, so this is not a regression relative to upstream routing, but local’s route contract remains brittle and coupled to fake singleton ids.

### 11. Local home list filtering is narrower than upstream’s hidden-list guard
- **Local** filters only on `!list.hideNavigation`: `src/routes/dashboard/index.tsx:26` and `src/components/dashboard/dashboard-layout.tsx:18`.
- **Upstream** filters on `!(list.hideNavigation ?? list.isHidden)`: `../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx:103` and `../next-keystone-starter/features/dashboard/components/Sidebar.tsx:58-60`.
- **Impact:** if upstream metadata still exposes `isHidden` without `hideNavigation`, local can leak lists into home/sidebar that upstream suppresses.

### 12. Local shell redundantly refetches dashboard overview in both shell and home route
- **Local shell** fetches overview in `DashboardShell`: `src/components/dashboard/dashboard-shell.tsx:7-15`.
- **Local home route** also ensures and then queries the exact same overview payload: `src/routes/dashboard/index.tsx:11-24`.
- **Upstream** home screen fetches its own server-side data once inside `HomePage`: `../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx:83-112`.
- **Impact:** local shell/home composition is noisier and more coupled than upstream. It may be acceptable with query caching, but it is still unnecessary duplicated shell-level data wiring.

### 13. User profile is close to upstream, but local still diverges in implementation details and behavior surface
- **Local** profile dropdown uses inline theme buttons wired to `useTheme()` and logs out through `signOutDashboard(queryClient)`: `src/components/dashboard/user-profile.tsx:31-35,83-104`.
- **Upstream** profile dropdown uses a dedicated `ThemeSwitcher` component and submits a form action `signOut`: `../next-keystone-starter/features/dashboard/components/UserProfileClient.tsx:32-33,120-140`.
- **Impact:** parity is approximate, not exact. The visible menu is similar, but the implementation and sign-out mechanism have diverged.

### 14. User profile dropdown width behavior regressed from upstream
- **Local** dropdown content only specifies `min-w-56`: `src/components/dashboard/user-profile.tsx:58-63`.
- **Upstream** ties width to trigger width via `w-[--radix-dropdown-menu-trigger-width] min-w-56`: `../next-keystone-starter/features/dashboard/components/UserProfileClient.tsx:79-84`.
- **Impact:** local can produce a narrower/floating menu disconnected from the trigger width, especially with short user names.

### 15. One area is basically parity: right-sidebar wrapper structure
- **Local** `RightSidebar` is effectively the same wrapper structure as upstream: `src/components/dashboard/right-sidebar.tsx:7-15`.
- **Upstream** matches that same minimal composition: `../next-keystone-starter/features/dashboard/components/dual-sidebar/right-sidebar.tsx:7-15`.
- **Reality check:** this is only structural parity on paper because local does not appear to mount it in `DashboardLayout`.

## Bottom line
The biggest shell-level misses are not cosmetic:
1. **Sidebar/nav architecture regressed** from grouped/collapsible/icon-safe models navigation to a flat list.
2. **AI right sidebar exists but is not integrated into the dashboard shell.**
3. **AI sidebar behavior is materially downgraded** versus upstream: no streamed/tool-aware chat path, no mode selector, no query invalidation after CRUD-like tool usage, no markdown rendering, no scroll helpers.
4. **Home/sidebar hidden-list filtering is weaker** and may expose entries upstream suppresses.
5. **User profile is near-parity visually but still implementation-diverged**, with smaller width/behavior mismatches.
