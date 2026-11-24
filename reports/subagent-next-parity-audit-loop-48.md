# Code Context

## Files Retrieved
1. `src/components/dashboard/dashboard-sidebar.tsx` (lines 1-122) - target sidebar implementation; the Models section is always rendered open and the chevron is hard-coded rotated, so there is no collapsible behavior.
2. `src/components/dashboard/dashboard-shell.tsx` (lines 1-40) - target shell passes visible lists into the sidebar and shows the sidebar is the only place this Models disclosure behavior lives.
3. `../next-keystone-starter/features/dashboard/components/Sidebar.tsx` (lines 1-220) - reference sidebar implementation; wraps the Models section in `Collapsible`, `CollapsibleTrigger`, and `CollapsibleContent` so desktop expanded mode can open/close the group.
4. `src/routes/dashboard/index.tsx` (lines 1-88) - confirms hidden-list/home-card behavior is already filtered in target and is not the next gap.
5. `src/routes/dashboard/$listKey.$id.tsx` (lines 1-207) - confirms singleton delete redirect and Copy ID handling were already touched elsewhere and are not the smallest remaining sidebar parity fix.

## Key Code
Target sidebar currently renders the Models group as permanently expanded:

```tsx
// src/components/dashboard/dashboard-sidebar.tsx
<SidebarMenuItem>
  <SidebarMenuButton>
    <Package className="size-4" />
    <span>Models</span>
    <ChevronRight className="ml-auto rotate-90 transition-transform duration-200" />
  </SidebarMenuButton>
  <SidebarMenuSub>
    {sidebarLinks.map((link) => (
      <SidebarMenuSubItem key={link.href}>
        <SidebarMenuSubButton
          render={<Link to={link.href} onClick={() => setOpenMobile(false)} />}
          isActive={isLinkActive(pathname, link.href)}
        >
          <span>{link.title}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    ))}
  </SidebarMenuSub>
</SidebarMenuItem>
```

Reference Next sidebar uses a real collapsible wrapper:

```tsx
// ../next-keystone-starter/features/dashboard/components/Sidebar.tsx
<Collapsible
  key={dashboardItem.title}
  asChild
  defaultOpen={dashboardItem.isActive}
  className="group/collapsible"
>
  <SidebarMenuItem>
    <CollapsibleTrigger asChild>
      <SidebarMenuButton>
        <dashboardItem.icon className="h-4 w-4" />
        <span>{dashboardItem.title}</span>
        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
      </SidebarMenuButton>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <SidebarMenuSub>
        ...links...
      </SidebarMenuSub>
    </CollapsibleContent>
  </SidebarMenuItem>
</Collapsible>
```

Target shell already constrains the list set before rendering sidebar, so the remaining issue is disclosure behavior, not data sourcing:

```tsx
// src/components/dashboard/dashboard-shell.tsx
<DashboardSidebar lists={data.lists.filter((list) => !list.hideNavigation)} user={data.authenticatedItem} />
```

## Architecture
- `DashboardShell` fetches overview/admin-visible list summaries and passes them into `DashboardSidebar`.
- `DashboardSidebar` is solely responsible for rendering the left-nav Models group in both full and icon-collapsed modes.
- In full desktop mode, target currently skips the disclosure-state layer entirely and always shows the nested model list.
- Reference Next keeps the icon-mode dropdown, but also adds a separate `Collapsible` state for expanded sidebar mode. That means the Models group can be opened/closed, and the chevron rotation reflects actual state.

## Start Here
Open `src/components/dashboard/dashboard-sidebar.tsx` first. It contains the entire parity gap, and the fix should stay isolated there.

## Next single concrete fixable parity gap
**Gap:** the left sidebar Models section is not actually collapsible in the target app.

### Why this is the next fix
- It is a clear remaining UI parity difference versus `next-keystone-starter`.
- It has a very small implementation surface.
- It does not require backend, routing, or list-query changes.
- It is safer and smaller than larger remaining gaps like full auth-flow or relationship-editor parity.

### Minimal implementation
**File to change:** `src/components/dashboard/dashboard-sidebar.tsx`

1. Import the collapsible primitives already used by the reference app:
   - `Collapsible`
   - `CollapsibleTrigger`
   - `CollapsibleContent`

2. Replace the always-open desktop Models block with the same structure the reference uses:
   - wrap `SidebarMenuItem` in `Collapsible asChild`
   - move the header button into `CollapsibleTrigger`
   - move `SidebarMenuSub` into `CollapsibleContent`
   - remove the hard-coded `rotate-90` class from the chevron and use the state-based class:
     - `group-data-[state=open]/collapsible:rotate-90`

3. Keep the existing icon-collapsed dropdown branch unchanged.

### Exact target shape
Conceptually, the desktop block should become:

```tsx
<Collapsible asChild defaultOpen={false} className="group/collapsible">
  <SidebarMenuItem>
    <CollapsibleTrigger asChild>
      <SidebarMenuButton>
        <Package className="size-4" />
        <span>Models</span>
        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
      </SidebarMenuButton>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <SidebarMenuSub>
        ...existing links...
      </SidebarMenuSub>
    </CollapsibleContent>
  </SidebarMenuItem>
</Collapsible>
```

### Why only this file
- `src/components/dashboard/dashboard-shell.tsx` already provides the correct list input.
- Hidden-list filtering is already handled before sidebar rendering.
- The icon-mode dropdown already exists and can stay as-is.
- No route/query/state contract changes are needed.

## Risks / constraints
- Preserve current mobile close behavior by keeping `onClick={() => setOpenMobile(false)}` on each link.
- Do not change the icon-mode dropdown path; parity gap is only the expanded sidebar disclosure behavior.
- Keep active-link highlighting on subitems unchanged.
- If you want exact reference behavior, set `defaultOpen={false}` as in Next’s current sidebar data (`isActive: false`).