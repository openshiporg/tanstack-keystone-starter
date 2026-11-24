# Next parity audit loop 20

## Next single concrete fixable parity gap

The remaining parity gap is in the **active filter pill editor interaction**:

- **Reference (`next-keystone-starter`)** opens the active filter pill editor with a **Popover**.
- **Target (`tanstack-keystone-starter`)** still opens that editor with a **DropdownMenu**.

This is a real parity mismatch even after the add-filter popover work landed.

## Why this is the next fix

This is the smallest still-visible dashboard list-controls delta in the filter flow:

1. add-filter already matches the reference direction with a popover-style editor
2. filter pills are still implemented differently in the target
3. the fix is isolated to one component file and does not require route/data changes

## Reference evidence

### `../next-keystone-starter/features/dashboard/components/FilterList.tsx`
- lines 151-209: `FilterPill` uses `Popover`, `PopoverTrigger`, and `PopoverContent` for editing an active filter pill
- lines 211-261: `FilterWrapper` renders the field controller filter input inside that popover
- lines 263-320: `EditDialog` saves the edited filter back into URL params

Relevant behavior:
- clicking the pill opens a popover editor
- clicking the X button removes the filter separately
- editing happens inline in a popover, not in a dropdown menu

## Target evidence

### `src/components/dashboard/filter-bar.tsx`
- lines 17-17: imports `Popover`, `PopoverContent`, `PopoverTrigger`
- lines 184-199: active filters render through `FilterPill`
- lines 344-430: `FilterPill` uses **`DropdownMenu`**, `DropdownMenuTrigger`, and `DropdownMenuContent` instead of a popover

Current target behavior:
- remove button is separate, which is good
- but the editable pill still opens a dropdown menu shell rather than a popover shell

## Minimal implementation

### File to change
- `src/components/dashboard/filter-bar.tsx`

### Minimal change
Replace the active-pill editor wrapper from `DropdownMenu` to `Popover`:

1. **Imports**
   - remove `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent` usage for `FilterPill`
   - reuse the existing `Popover`, `PopoverTrigger`, `PopoverContent` already imported at the file top

2. **In `FilterPill`**
   - replace:
     - `<DropdownMenu open={open} onOpenChange={setOpen}>`
     - `<DropdownMenuTrigger ...>`
     - `<DropdownMenuContent ...>`
   - with:
     - `<Popover open={open} onOpenChange={setOpen}>`
     - `<PopoverTrigger asChild>` wrapping the trigger button
     - `<PopoverContent align="start" className="w-72 p-3">`

3. **Keep existing inner edit UI unchanged**
   - preserve `draftValue` state
   - preserve `save()`
   - preserve the remove button and current filter input rendering

## Suggested patch shape

Inside `FilterPill`, keep this structure:

- left remove `<Button ... onClick={onRemove}>`
- right trigger button wrapped with `PopoverTrigger asChild`
- edit panel rendered in `PopoverContent`

That yields parity without changing URL state, filter parsing, or controller integration.

## Scope/risk

Low risk:
- isolated to one file
- no data model or routing changes
- no dependency changes
- behavior already proven in the reference app

Potential minor adjustment:
- because `PopoverTrigger` typically expects `asChild`, the trigger should likely become a `Button` or a single trigger element instead of a raw dropdown trigger component.

## Exact files reviewed

1. `../next-keystone-starter/features/dashboard/components/FilterList.tsx` (lines 1-320)
2. `../next-keystone-starter/features/dashboard/components/FilterBar.tsx` (lines 1-240)
3. `src/components/dashboard/filter-bar.tsx` (lines 1-430)
4. `src/components/ui/sidebar.tsx` (lines 1-180) — checked only to confirm already-fixed sidebar parity items are present
5. `src/components/dashboard/dashboard-shell.tsx` (lines 1-44) — checked only to confirm `DashboardProvider`/right-sidebar wiring is already present
