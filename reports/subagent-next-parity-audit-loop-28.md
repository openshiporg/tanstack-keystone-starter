# Code Context

## Files Retrieved
1. `src/components/dashboard/enhance-fields.tsx` (lines 1-84) - target currently hardcodes a minimal filter-controller layer by `field.kind`, instead of building Keystone-style controllers from admin-meta view modules.
2. `src/components/dashboard/filter-bar.tsx` (lines 1-205, 215-260, 361-445) - target add/edit/remove filter UI depends entirely on `enhanceFields()` output, so any controller parity gap surfaces here.
3. `src/features/cms/graphql-client.ts` (lines 124-145) - confirms target admin meta already includes the raw inputs needed for parity (`fieldMeta`, `viewsIndex`, `customViewsIndex`, `list.key`/`path`, view modes).
4. `../next-keystone-starter/features/dashboard/utils/enhanceFields.ts` (lines 1-81) - reference implementation builds enhanced fields from real field view exports and controller factories, including custom view overrides.
5. `../next-keystone-starter/features/dashboard/components/FilterAdd.tsx` (lines 34-57, 66-84, 114-189) - reference filter-add flow uses the controller-generated `filter.types` and `filter.Filter` components from `enhanceFields()`.
6. `../next-keystone-starter/features/dashboard/components/FilterList.tsx` (lines 41-118, 147-278) - reference active-filter pills and edit popovers also rely on those controller-generated `Filter` and `Label` implementations.

## Key Code

### Target gap: handcrafted filter controllers
`src/components/dashboard/enhance-fields.tsx:18-73`
```ts
export function enhanceFields(fields: DashboardField[]) {
  return Object.fromEntries(fields.map((field) => [field.path, { ...field, controller: { filter: filterControllerForField(field) } }]))
}
```
This only synthesizes very small filter support from `field.kind`, with text inputs / checkbox selects.

### Reference behavior: use real field view controllers
`../next-keystone-starter/features/dashboard/utils/enhanceFields.ts:10-80`
```ts
export function enhanceFields(rawFields: Record<string, any>, listKey: string) {
  ...
  const views = { ...getFieldViews(field.viewsIndex) }
  ...
  enhancedFields[fieldPath] = {
    ...field,
    ...
    controller: (views as any).controller({
      listKey,
      fieldMeta: field.fieldMeta,
      label: field.label,
      description: field.description,
      path: field.path,
      customViews,
    }),
  }
}
```
This is what gives Next parity for per-field filter UIs and labels.

### The target UI is already wired to consume richer controllers
`src/components/dashboard/filter-bar.tsx:72-79`
```ts
const enhancedFields = useMemo(() => enhanceFields(list.fields), [list.fields])
const filterableFields = useMemo(() => Object.values(enhancedFields).filter((field) => field.isFilterable && field.controller.filter), [enhancedFields])
const activeFilterTypes = activeFilterField?.controller.filter
  ? Object.entries(activeFilterField.controller.filter.types).map(([type, meta]) => ({ type, ...meta }))
  : []
const ActiveFilterInput = activeFilterField?.controller.filter?.Filter
```
So the missing parity is not in the popover shell; it is in the data/controller source.

### Admin meta already carries the view metadata needed
`src/features/cms/graphql-client.ts:128-145`
```ts
const fields = list.fields.map((field) => {
  ...
  return {
    ...field,
    kind: String(field.fieldMeta.kind || field.viewsIndex),
    ...
  }
})
```
`adminMetaGraphQLQuery` already requests `fieldMeta`, `viewsIndex`, and `customViewsIndex`.

## Architecture
- Route `src/routes/dashboard/$listKey.tsx` loads a normalized `DashboardList`.
- `FilterBar` receives that list and calls `enhanceFields(list.fields)`.
- Every filter affordance in the target app (`add filter`, active filter pills, edit popover labels/inputs) is derived from `field.controller.filter`.
- In Next, `field.controller.filter` comes from the actual Keystone field view/controller modules.
- In target, `field.controller.filter` is reconstructed from a generic `kind` switch, which loses field-specific filter behavior, custom views, and Keystone-compatible labeling semantics.

## Start Here
Open `src/components/dashboard/enhance-fields.tsx` first. It is the narrowest parity choke-point: one implementation there feeds both add-filter and edit-filter behavior throughout the dashboard.

## Next single concrete fixable parity gap
**Gap:** enhanced filter controllers are still not parity-complete. The target dashboard does not derive filter behavior from actual field view controllers the way `next-keystone-starter` does.

This remains after the listed fixes because:
- sort fallback / initialSort parity is already present,
- floating AI chat button parity is already present,
- signup/reset/init/no-access route parity has already been addressed,
- side-aware `SidebarTrigger` is already present,
- dashboard provider stack is already present,
- but filter-controller parity is still structurally simplified.

### Why this is the next best fix
It is:
- **concrete**: limited to the field-enhancement/filter layer,
- **high leverage**: fixes both add-filter and edit-filter UX across all lists,
- **verifiable**: compare field-specific filter widgets/labels before and after,
- **smaller than item-page parity**: does not require rewriting route/data architecture.

## Minimal implementation
1. Replace the handcrafted `enhanceFields()` in `src/components/dashboard/enhance-fields.tsx` with a Keystone-style enhancer modeled on:
   - `../next-keystone-starter/features/dashboard/utils/enhanceFields.ts`.
2. Adapt it to the target data shape:
   - accept `fields: DashboardField[]` **and** `listKey: string`;
   - index fields by `field.path` internally;
   - use `viewsIndex`, `customViewsIndex`, `fieldMeta`, `label`, `description`, `path` already present in target admin meta.
3. Provide a target-side `getFieldViews()` source for dashboard field view modules, then call each view’s exported `controller()` to populate `field.controller`.
4. Update callers in `src/components/dashboard/filter-bar.tsx` to pass `list.key` into `enhanceFields(list.fields, list.key)`.
5. Keep the existing `FilterBar` / `FilterPill` shells, but let them render controller-provided `filter.types`, `filter.Filter`, and `filter.Label` from the real field controllers.

## Exact files likely to change
- `src/components/dashboard/enhance-fields.tsx`
- `src/components/dashboard/filter-bar.tsx`
- likely one new helper/registry file to resolve field views in the target dashboard, analogous in purpose to Next’s `features/dashboard/views/registry`

## Risk / constraint
The only meaningful constraint is availability of target-side field-view controller modules. If some field views are not yet exposed through a registry, parity can still be improved incrementally by:
- first adding a registry for the currently supported dashboard field kinds,
- then falling back to the current handcrafted behavior only when a controller module is unavailable.

That fallback should be treated as compatibility glue, not the primary path.