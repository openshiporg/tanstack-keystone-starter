# Code Context

## Files Retrieved
1. `src/components/dashboard/dashboard-shell.tsx` (lines 32-46) - shell passes `data.lists` directly into the sidebar, so hidden lists still appear in navigation.
2. `src/components/dashboard/dashboard-sidebar.tsx` (lines 38-126) - sidebar renders every received list into the Models menu with no `isHidden` filtering.
3. `src/features/cms/graphql-client.ts` (lines 185-200) - overview query returns all admin-meta lists with counts; it does not remove hidden lists before consumers render them.
4. `src/routes/dashboard/index.tsx` (lines 23-42) - target home/dashboard page already filters hidden lists, so sidebar behavior is inconsistent with the page grid.
5. `../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx` (lines 94-112) - reference home page filters hidden lists before rendering.
6. `../next-keystone-starter/features/dashboard/components/Sidebar.tsx` (lines 49-76, 82-90, 128-170) - reference sidebar builds links from admin meta and likewise does not independently reintroduce hidden lists; parity expectation is that hidden lists are excluded from navigation inputs.
7. `src/routes/dashboard.tsx` (lines 17-50) - confirms auth/no-access parity is already enforced at route level, so the next concrete gap is not auth gating.
8. `src/routes/dashboard/no-access.tsx` (lines 1-40) and `../next-keystone-starter/features/dashboard/screens/NoAccessPage/index.tsx` (lines 1-42) - no-access screen already matches closely.
9. `src/routes/dashboard/$listKey.tsx` (lines 19-41, 56-68) - list page query key and filters wiring now include the audited parity fixes, so this area is no longer the best next gap.

## Key Code

Target shell currently passes all overview lists into sidebar navigation:

`src/components/dashboard/dashboard-shell.tsx:32-46`
```tsx
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data } = useSuspenseQuery({
    queryKey: dashboardQueryKeys.overview,
    queryFn: () => fetchDashboardOverview(),
  })

  return (
    <DashboardProviders user={data.authenticatedItem}>
      <DashboardSidebar lists={data.lists} user={data.authenticatedItem} />
```

Target sidebar renders every received list:

`src/components/dashboard/dashboard-sidebar.tsx:38-42`
```tsx
export function DashboardSidebar({ lists, user }: { lists: DashboardListSummary[]; user?: DashboardUser | null }) {
  const { isMobile, setOpenMobile } = useSidebar()
  const location = useLocation()
  const pathname = location.pathname
  const sidebarLinks = lists.map((list) => ({ title: list.label, href: `/dashboard/${list.path}` }))
```

But the target dashboard home already excludes hidden lists:

`src/routes/dashboard/index.tsx:23-27`
```tsx
  const lists = data.lists.filter((list) => !list.isHidden)
```

Overview data itself still includes hidden lists:

`src/features/cms/graphql-client.ts:185-200`
```ts
export async function fetchDashboardOverview(options: DashboardGraphQLOptions = {}) {
  const [adminMeta, authState] = await Promise.all([
    fetchKeystoneAdminMeta(options),
    fetchDashboardAuthState(options).catch(() => ({ authenticatedItem: null, redirectToInit: false })),
  ])
  ...
  return {
    authenticatedItem: authState.authenticatedItem,
    lists: adminMeta.lists.map((list) => ({ ...list, count: counts[`count_${list.key}`] ?? 0 })),
  }
}
```

Reference home page shows the intended hidden-list behavior:

`../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx:94-98`
```tsx
  const adminMeta = adminMetaResponse.data
  const lists = adminMeta?.lists || []
  const enhancedLists = lists.filter((list: any) => !list.isHidden)
```

## Architecture

- `fetchDashboardOverview()` is the shared top-level dashboard data source. It combines admin meta, auth state, and list counts into `DashboardListSummary[]`.
- `DashboardShell` consumes that overview query and passes `data.lists` into `DashboardSidebar`.
- `DashboardSidebar` turns those lists directly into navigation links.
- Separately, `routes/dashboard/index.tsx` also consumes overview data but locally filters `!list.isHidden` before rendering cards.

So the current target has an internal parity split:
- homepage/cards honor `isHidden`
- sidebar navigation does not

That means a hidden list can be invisible on the dashboard landing page but still visible and clickable in the left nav. This is a straightforward remaining parity gap within the audited “sidebar parity” scope.

## Start Here

Open `src/components/dashboard/dashboard-shell.tsx` first.

That is the narrowest place to fix the inconsistency because it controls what list set the sidebar receives. A one-line filtered pass-through there likely resolves the visible parity gap without changing query structures or auth behavior.

## Minimal Implementation

**Gap:** Hidden lists are still shown in the target sidebar even though the homepage already filters them out.

### Preferred minimal fix
1. In `src/components/dashboard/dashboard-shell.tsx`, pass only visible lists to the sidebar:
```tsx
<DashboardSidebar lists={data.lists.filter((list) => !list.isHidden)} user={data.authenticatedItem} />
```

### Optional defensive follow-up
2. Also harden `src/components/dashboard/dashboard-sidebar.tsx` by filtering before mapping, so future callers cannot accidentally reintroduce hidden lists:
```tsx
const sidebarLinks = lists
  .filter((list) => !list.isHidden)
  .map((list) => ({ title: list.label, href: `/dashboard/${list.path}` }))
```

If you want the absolute smallest change, step 1 alone is enough.

## Why this is the next best parity fix

The previously audited gaps in this loop’s checklist appear already landed:
- list page query key / `!filters`
- effective sort token UI
- `initialSort`
- relationship cell linking / row wrapper behavior
- registry `supportsLinkTo`
- list cell registry path
- no-filterable guard
- `enhanceFields` custom merge
- auth/no-access page flow

What remains from the explicit checklist is **sidebar parity**, and this hidden-list leak is concrete, user-visible, and localized.

## Risks / Constraints

- Filtering only in `dashboard-shell.tsx` fixes runtime navigation, but other future sidebar callers could still pass hidden lists. Filtering in both shell and sidebar is safer.
- Do **not** filter hidden lists inside `fetchDashboardOverview()` unless you verify no other consumer needs the full list set plus counts. That function is broader shared data, while the shell/sidebar layer is presentation-specific.
- This gap is independent of auth gating; `src/routes/dashboard.tsx:17-50` already handles signin/init/no-access redirects.