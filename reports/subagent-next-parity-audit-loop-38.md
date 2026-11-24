# Code Context

## Files Retrieved
1. `src/components/dashboard/keystone-list-table.tsx` (lines 275-281) - target list cell linking logic; decides when to pass `linkTo` into field Cell components.
2. `src/components/dashboard/views/registry.tsx` (lines 117-137) - target shared Cell implementation; currently advertises `supportsLinkTo = true` for all field kinds.
3. `../next-keystone-starter/features/dashboard/components/ListTable.tsx` (lines 154-170) - source list table logic; only passes `linkTo` when the concrete field view says it supports links.
4. `../next-keystone-starter/features/dashboard/views/text/index.tsx` (lines 362-363) - source text Cell is explicitly linkable.
5. `../next-keystone-starter/features/dashboard/views/select/index.tsx` (lines 377-377) - source select Cell is explicitly non-linkable.
6. `../next-keystone-starter/features/dashboard/views/relationship/index.tsx` (lines 516-516) - source relationship Cell is explicitly linkable.

## Key Code
Target currently treats every registry-backed field Cell as link-capable:

```tsx
// src/components/dashboard/views/registry.tsx:117-137
function Cell({ field, item, linkTo }: CellProps) {
  // ...renders content...
  if (!linkTo) return content
  // wraps content in row link
}
Cell.supportsLinkTo = true
```

And the table uses that flag directly:

```tsx
// src/components/dashboard/keystone-list-table.tsx:275-281
const CellComponent = fieldViews.Cell
const shouldLinkToRow = field.kind !== 'relationship' && (
  (CellComponent as { supportsLinkTo?: boolean }).supportsLinkTo ||
  field.path === 'id' ||
  isFirstField
)
const linkTo = shouldLinkToRow ? { href: `/dashboard/${listPath}/${encodeURIComponent(item.id)}` } : undefined
return <CellComponent field={field} item={item} linkTo={linkTo} />
```

In source, link support is per field type, not global:

```tsx
// ../next-keystone-starter/features/dashboard/views/text/index.tsx:362-363
Cell.supportsLinkTo = true

// ../next-keystone-starter/features/dashboard/views/select/index.tsx:377
Cell.supportsLinkTo = false

// ../next-keystone-starter/features/dashboard/views/relationship/index.tsx:516
Cell.supportsLinkTo = true
```

## Architecture
- `KeystoneListTable` asks `getFieldViews()` for the field implementation and reads `Cell.supportsLinkTo`.
- In the source app, each field module exports its own `Cell` and sets `supportsLinkTo` individually.
- In the target app, `src/components/dashboard/views/registry.tsx` centralizes rendering into one generic `Cell`, so its single `supportsLinkTo` value applies to every field kind.
- That means non-linkable cells such as `select`, `integer`, `float`, etc. are currently treated as linkable whenever they are not the first column, which diverges from source behavior.

## Start Here
Open `src/components/dashboard/views/registry.tsx` first, because the parity gap comes from the shared `Cell.supportsLinkTo = true` contract being too coarse for all field kinds.

## Next single concrete fixable parity gap
**Gap:** The target registry marks all cells as `supportsLinkTo = true`, but the source sets that flag per field type. As a result, non-linkable field kinds in list rows still receive row links in the target.

**Minimal implementation:**
1. In `src/components/dashboard/views/registry.tsx`, replace the global `Cell.supportsLinkTo = true` behavior with a kind-aware value.
2. Minimal safe parity mapping based on the source behavior already inspected:
   - `true`: `text`, `id`, `relationship`, `document`, `multiselect`
   - `false`: `select`, `timestamp`, `integer`, `float`, `json`, `checkbox`, `password`, `bigInt`, `decimal`
3. Expose that through the returned field views so `KeystoneListTable` reads the correct flag for each field.

**Smallest likely code shape:**
- In `getFieldViews(...)` or alongside the shared `Cell`, assign `Cell.supportsLinkTo` from a per-kind lookup using `field.kind` before returning the view object.
- Leave `src/components/dashboard/keystone-list-table.tsx` unchanged; it already consumes `supportsLinkTo` the same way as source.

**Why this is the next fix:**
- It is a direct source/target behavior mismatch.
- It is isolated to the list cell linking contract.
- It avoids broader refactors and builds on the recent relationship-cell fix rather than undoing it.

## Risks / constraints
- Because the target uses one shared registry Cell, setting a static property once at module scope is insufficient; it must vary by the current field kind.
- If `getFieldViews()` caches or reuses objects, mutating a shared `Cell.supportsLinkTo` property may bleed between field kinds. Safer is to return a shallow-cloned view object with a wrapped `Cell` or a per-call assigned property.
