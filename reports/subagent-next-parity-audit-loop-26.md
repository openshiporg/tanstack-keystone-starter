# Code Context

## Files Retrieved
1. `src/components/ui/sidebar.tsx` (lines 330-347) - target `SidebarTrigger` implementation; likely remaining parity gap after the side-aware trigger work.
2. `../next-keystone-starter/components/ui/sidebar.tsx` (lines 360-408) - source implementation showing the fuller side-aware `SidebarTrigger` behavior.
3. `src/components/dashboard/page-breadcrumbs.tsx` (lines 1-42) - current left-sidebar trigger usage in target.
4. `src/components/dashboard/page-container.tsx` (lines 1-54) - another current left-sidebar trigger usage in target.
5. `src/components/dashboard/dashboard-shell.tsx` (lines 1-40) - confirms dual-sidebar shell exists in target, so right-side trigger parity matters.
6. `src/components/dashboard/dashboard-providers.tsx` (lines 1-78) - shows the target already provides `SidebarProvider defaultOpen defaultOpenRight={false}`.
7. `src/components/dashboard/filter-bar.tsx` (lines 1-206, 321-439) - confirms enhanced filter controllers, add-filter popover, editable pills, and sort fallback are already present in target.
8. `../next-keystone-starter/features/dashboard/components/FilterBar.tsx` (lines 1-150) - source confirms filter bar parity areas called out in the prompt are already covered.
9. `../next-keystone-starter/features/dashboard/components/FilterAdd.tsx` (lines 1-210) - source reference for add-filter popover behavior.
10. `src/routes/dashboard/init.tsx` (lines 1-109), `src/routes/dashboard/signup.tsx` (lines 1-122), `src/routes/dashboard/reset.tsx` (lines 1-134), `src/routes/dashboard/no-access.tsx` (lines 1-40) - confirms auth-shell parity areas are already implemented in target.

## Key Code

### Remaining gap: `SidebarTrigger` is only partially ported

Source (`../next-keystone-starter/components/ui/sidebar.tsx:372-408`) uses contextual side detection and rotates the icon for right-side triggers:

```tsx
function SidebarTrigger({ className, onClick, side, icon, ...props }: ComponentProps<typeof Button> & { side?: "left" | "right"; icon?: string }) {
  const contextSide = useContext(SidebarInnerContext);
  const targetSide = side || contextSide || "left";
  const { toggleSidebar } = useSidebarWithSide(targetSide);

  const getIconComponent = () => {
    switch (icon) {
      default:
        return (
          <PanelLeftIcon
            className={cn("size-4", {
              "rotate-180": targetSide === "right",
            })}
          />
        );
    }
  };

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      data-side={targetSide}
      variant="ghost"
      size="icon"
      className={cn("size-7", className)}
```

Target (`src/components/ui/sidebar.tsx:330-347`) still hardcodes left defaults and does not rotate the icon:

```tsx
function SidebarTrigger({
  className,
  onClick,
  side = 'left',
  ...props
}: React.ComponentProps<typeof Button> & { side?: SidebarSide }) {
  const { toggleSidebar } = useSidebarWithSide(side)

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon-sm"
      className={cn(className)}
```

and renders:

```tsx
      <PanelLeftIcon />
```

### Why this is the next concrete parity gap
- The prompt says “side-aware `SidebarTrigger`” was fixed, but target still lacks the source’s **context-aware side resolution** and **right-side icon rotation**.
- In the target shell, dual sidebars already exist (`src/components/dashboard/dashboard-shell.tsx:31-39`), so a right trigger can exist now or later.
- The filter-related parity items named in the prompt are already present in target (`src/components/dashboard/filter-bar.tsx`).
- Auth-shell parity items are also already present in target routes.

## Architecture
- `DashboardProviders` wraps the app with `SidebarProvider` and enables both left/right sidebar state: `src/components/dashboard/dashboard-providers.tsx:70-76`.
- `DashboardShell` mounts `DashboardSidebar` on the left and `RightSidebar side="right"` on the right: `src/components/dashboard/dashboard-shell.tsx:31-39`.
- `SidebarTrigger` is the reusable UI primitive that toggles whichever sidebar side it targets.
- In source, `SidebarTrigger` can infer side from a sidebar-local context and also visually flips the icon for right-side usage.
- In target, `SidebarTrigger` accepts a `side` prop but still behaves visually like a left trigger and lacks `SidebarInnerContext` fallback.

## Start Here
Open `src/components/ui/sidebar.tsx` first. That is the smallest, most isolated parity fix and likely requires no route-level changes.

## Next single concrete fixable parity gap
**Implement full side-aware `SidebarTrigger` parity in `src/components/ui/sidebar.tsx`.**

### Minimal implementation
1. Import/use `useContext` if not already in scope for this section.
2. In `SidebarTrigger`, derive:
   - `const contextSide = useContext(SidebarInnerContext)`
   - `const targetSide = side || contextSide || 'left'`
3. Change the toggle hook to `useSidebarWithSide(targetSide)`.
4. Add `data-side={targetSide}` to the trigger button.
5. Render `PanelLeftIcon` with right-side rotation, e.g.:

```tsx
<PanelLeftIcon className={cn('size-4', targetSide === 'right' && 'rotate-180')} />
```

6. Optionally align button sizing/class with source parity:
   - `size="icon"`
   - `className={cn('size-7', className)}`

### Exact file
- `src/components/ui/sidebar.tsx`

### Risk
Low. This is a localized UI primitive update and should not affect list/filter/auth flows.
