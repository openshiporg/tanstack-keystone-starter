# Code Context

## Files Retrieved
1. `src/components/dashboard/keystone-list-table.tsx` (lines 220-319) - target list table decides whether to pass `linkTo` into a field `Cell`, which affects row-item linking behavior.
2. `src/components/dashboard/views/registry.tsx` (lines 1-184) - target field Cell registry implementation; currently uses one generic `Cell` for all field kinds and sets `Cell.supportsLinkTo = true` globally.
3. `../next-keystone-starter/features/dashboard/components/ListTable.tsx` (lines 1-390) - reference list table behavior for linkable cells and `supportsLinkTo` usage.
4. `../next-keystone-starter/features/dashboard/views/relationship/index.tsx` (lines 1-98) - reference relationship cell implementation; it links to related items and does not advertise row-item `supportsLinkTo` behavior.
5. `src/routes/dashboard/$listKey.tsx` (lines 1-106) - confirms recent list-page parity fixes are present and not the next gap.
6. `src/components/dashboard/filter-bar.tsx` (lines 1-260) - confirms filter guard and filter-state parity fixes are present.
7. `src/components/dashboard/enhance-fields.tsx` (lines 1-74) - confirms custom view merge parity fix is present.
8. `src/features/cms/graphql-client.ts` (lines 213-381) - confirms selected fields, `!filters`, and effective sort token work is present.

## Key Code

### Target: row-item link is injected for every registry Cell
`src/components/dashboard/keystone-list-table.tsx` (lines 272-283):
```tsx
const fieldViews = getFieldViews(field.viewsIndex, field)
const CellComponent = fieldViews.Cell
const linkTo = (CellComponent as { supportsLinkTo?: boolean }).supportsLinkTo || field.path === 'id' || isFirstField
  ? { href: `/dashboard/${listPath}/${encodeURIComponent(item.id)}` }
  : undefined
return <CellComponent field={field} item={item} linkTo={linkTo} />
```

### Target registry marks the generic Cell as linkable for all field kinds
`src/components/dashboard/views/registry.tsx` (lines 112-139):
```tsx
function Cell({ field, item, linkTo }: CellProps) {
  const value = item[field.path]
  let content: React.ReactNode
  if (value === null || value === undefined) content = <div ...>null</div>
  else if (field.kind === 'relationship') content = <RelationshipCellValue field={field} value={value} />
  ...

  if (!linkTo) return content
  ...
  return (
    <Link to="/dashboard/$listKey/$id" ...>
      {content}
    </Link>
  )
}
Cell.supportsLinkTo = true
```

### Target relationship content already renders related-item links
`src/components/dashboard/views/registry.tsx` (lines 141-167):
```tsx
function RelationshipCellValue({ field, value }: { field: DashboardField; value: unknown }) {
  if (Array.isArray(value)) {
    ...
    return (
      <span className="inline-flex max-w-md flex-wrap gap-1 select-text">
        {value.map((entry, index) => (
          <span key={relationshipKey(entry)}>
            {index ? ', ' : ''}<RelationshipLink field={field} value={entry} />
          </span>
        ))}
      </span>
    )
  }
  return <RelationshipLink field={field} value={value} />
}
```

### Reference: relationship Cell links related items directly, not the row item
`../next-keystone-starter/features/dashboard/views/relationship/index.tsx` (lines 54-88):
```tsx
export const Cell = ({ field, item }: { field: any; item: any }) => {
  ...
  return (
    <CellContainer>
      {displayItems.map((item: any, index: number) => (
        <Fragment key={item.id}>
          {!!index ? ", " : ""}
          <Link href={`${basePath}/${list?.path || ''}/${item.id}`}>
            {item.label || item.id}
          </Link>
        </Fragment>
      ))}
      ...
    </CellContainer>
  )
}
```

## Architecture
- The target app’s list page (`src/routes/dashboard/$listKey.tsx`) fetches list data and renders `KeystoneListTable`.
- `KeystoneListTable` delegates cell rendering to the field view registry via `getFieldViews(field.viewsIndex, field)`.
- The target registry currently provides a single generic `Cell` implementation for every field type.
- Because that generic `Cell` has `supportsLinkTo = true`, the table injects a row-item `linkTo` prop even for relationship fields.
- But relationship field content already renders its own links to related records.
- Result: relationship cells are wrapped in the row item link while containing inner related-item links, creating incorrect behavior and likely nested-anchor invalid HTML.
- In the reference app, relationship cells own their own related-item links and are not treated as row-linkable cells.

## Start Here
Open `src/components/dashboard/views/registry.tsx` first. The parity gap is localized there: the generic registry Cell is marked linkable for all field kinds even though relationship cells already render related-item links.

## Next single concrete parity gap
**Gap:** In the target app, relationship list cells still inherit row-item linking through the generic registry `Cell.supportsLinkTo = true`, unlike the reference implementation where relationship cells link only to the related records.

### Why this is the next fixable gap
The previously requested areas appear present in target now:
- list-page query key includes stable search state including `!filters`
- no-filterable guard exists
- enhanceFields custom merge exists
- effective sort token / `initialSort` flow exists
- no-access/auth/sidebar plumbing exists

The remaining mismatch I found is more specific and directly user-visible: clicking a relationship cell can route to the current row item instead of behaving like the reference’s related-record links.

### Minimal implementation
**Primary file:** `src/components/dashboard/views/registry.tsx`

Change the registry so relationship cells do **not** advertise row-item link support. Minimal safe approaches:

1. **Preferred:** make `supportsLinkTo` conditional by field kind in `getFieldViews(...)`.
   - Return a `Cell` component with `supportsLinkTo = field?.kind !== 'relationship'`.

2. **Alternative:** guard in `src/components/dashboard/keystone-list-table.tsx` when computing `linkTo`:
   - do not pass `linkTo` when `field.kind === 'relationship'`.

### Smallest likely code change
In `src/components/dashboard/keystone-list-table.tsx`, adjust:
```tsx
const linkTo = (CellComponent as { supportsLinkTo?: boolean }).supportsLinkTo || field.path === 'id' || isFirstField
```
into logic that excludes relationship fields, e.g. only row-link first-field/id cases for non-relationship cells, or requires `supportsLinkTo` without overriding relationship behavior.

### Risk / constraint
- Be careful not to regress first-column linking for normal scalar fields.
- Relationship cells already render correct related-item links, so the fix should only remove the outer row-item link for `relationship` fields.
- Avoid nested links; that is the parity and validity issue here.