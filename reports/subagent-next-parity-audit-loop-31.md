# Thirty-first-loop parity audit: next single parity gap

## Gap
`src/components/dashboard/filter-bar.tsx` still crashes for lists that have **no filterable fields with controller.filter support**.

The current TanStack implementation computes:
- `const activeFilterField = filterableFields.find(...) ?? filterableFields.at(0)`
- `const activeFilterType = ... ?? activeFilterTypes.at(0)`

but then unconditionally renders:
- `value={activeFilterField.path}`
- `value={activeFilterType.type}`
- `activeFilterField.controller.filter?.types[...]`

So for a list where `filterableFields.length === 0`, opening the filter popover will throw during render.

## Why this is the next parity gap
The recently-fixed areas listed in the task are already present in target:
- effective sort token is already normalized/exposed in `src/features/cms/graphql-client.ts`
- initialSort pipeline already exists in `src/features/cms/config.ts`, `src/features/cms/admin-meta.ts`, and GraphQL/runtime metadata
- no-access/auth-shell routing exists
- field/controller registry/export work is already wired enough to support list/item/create rendering

This remaining gap is a concrete user-facing parity hole in list controls: Keystone/next-keystone-starter does **not** hard-crash when a list lacks usable filters, but target currently can.

## Exact files
### Target
- `src/components/dashboard/filter-bar.tsx`

### Reference
- `../next-keystone-starter/features/dashboard/components/FilterBar.tsx`
- `../next-keystone-starter/features/dashboard/components/FilterAdd.tsx`

## Evidence
### Target unsafe dereferences
In `src/components/dashboard/filter-bar.tsx`:
- around lines 74-78: derives possibly-undefined `activeFilterField` / `activeFilterType`
- around lines 150-163: dereferences them unconditionally in JSX

Relevant code shape:
```ts
const filterableFields = useMemo(() => Object.values(enhancedFields).filter((field) => field.isFilterable && field.controller.filter), [enhancedFields])
const activeFilterField = filterableFields.find((field) => field.path === filterField) ?? filterableFields.at(0)
const activeFilterTypes = activeFilterField?.controller.filter ? Object.entries(activeFilterField.controller.filter.types).map(([type, meta]) => ({ type, ...meta })) : []
const activeFilterType = activeFilterTypes.find((entry) => entry.type === filterType) ?? activeFilterTypes.at(0)
```

and later:
```tsx
<select ... value={activeFilterField.path} ...>
<select ... value={activeFilterType.type} ...>
{ActiveFilterInput ? <ActiveFilterInput ... type={activeFilterType.type} field={activeFilterField} ... /> : ...}
```

### Reference behavior
`../next-keystone-starter/features/dashboard/components/FilterBar.tsx` delegates filter creation to `FilterAdd.tsx`, and `FilterAdd.tsx` only renders field/type/value controls after state transitions that require an actual selected field. It never unconditionally dereferences a nonexistent active filter field in the top-level bar.

## Minimal implementation
Update `src/components/dashboard/filter-bar.tsx` to guard the filter popover UI when no filterable fields exist.

### Minimal change outline
1. Add a boolean:
```ts
const hasFilterableFields = filterableFields.length > 0
```

2. Disable or hide the filter trigger when `!hasFilterableFields`.
   - Smallest parity-safe choice: keep button visible but disabled.

3. Inside `PopoverContent`, branch:
   - if `!hasFilterableFields`, render a small empty/help state like “No filters available for this list.”
   - else render the existing field/condition/value controls.

4. Ensure all JSX dereferences are guarded:
   - use `activeFilterField ? ... : null`
   - use `activeFilterType ? ... : null`

5. Keep `addFilter()` as-is or early-return (already does).

## Suggested patch target
Only `src/components/dashboard/filter-bar.tsx` needs editing.

## Expected result
- Lists with zero filter-capable fields render normally.
- Opening the filter control no longer crashes.
- Behavior aligns with the safer next-keystone-starter pattern where filter UI only materializes when a valid field/filter exists.
