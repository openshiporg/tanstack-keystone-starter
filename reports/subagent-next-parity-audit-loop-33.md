# Code Context

## Files Retrieved
1. `src/routes/dashboard/$listKey.tsx` (lines 1-117) - target list route wiring and list page composition.
2. `src/components/dashboard/page-container.tsx` (lines 1-53) - target page header now includes the right sidebar trigger, confirming that parity item is already fixed.
3. `src/components/dashboard/page-breadcrumbs.tsx` (lines 1-47) - target item/create header also includes the right sidebar trigger, confirming that parity item is already fixed there too.
4. `src/components/dashboard/dashboard-shell.tsx` (lines 1-46) - target already has the floating AI button and right sidebar shell wiring.
5. `src/features/cms/graphql-client.ts` (lines 200-263, 305-382) - target list field selection and initialSort fallback logic; confirms initialSort parity is already implemented.
6. `src/components/dashboard/keystone-list-table.tsx` (lines 1-317) - target list cell rendering is still custom/manual and does not use view `Cell` components.
7. `../next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx` (lines 1-224) - reference list page composition in next starter.
8. `../next-keystone-starter/features/dashboard/components/ListTable.tsx` (lines 1-391) - reference implementation uses field view `Cell` components and `supportsLinkTo` for richer per-field rendering.
9. `../next-keystone-starter/features/dashboard/components/PageContainer.tsx` (lines 1-75) - reference page container with right header trigger, confirming this gap is already closed in target.
10. `../next-keystone-starter/features/dashboard/lib/buildOrderByClause.ts` (lines 1-9) and `../next-keystone-starter/features/dashboard/hooks/useSort.ts` (lines 1-21) - reference initial sort path; target now has stronger initialSort support.

## Key Code

### Confirmed fixed parity items in target

Target already has the right header trigger in both page container styles:

- `src/components/dashboard/page-container.tsx` lines 43-45
- `src/components/dashboard/page-breadcrumbs.tsx` lines 41-44

Target already has floating AI shell wiring:

- `src/components/dashboard/dashboard-shell.tsx` lines 12-27, 36-45

Target already applies configured initial sort server-side:

- `src/features/cms/graphql-client.ts` lines 240-263
- `src/features/cms/graphql-client.ts` lines 353-382

### Remaining parity gap: list cells still use manual rendering in target

Target list table renders a small set of kinds manually and falls back to primitive/object placeholders:

`src/components/dashboard/keystone-list-table.tsx` lines 214-261:
```tsx
function CellContent({ listPath, item, field, isFirstField }: { listPath: string; item: DashboardListItem; field: DashboardField; isFirstField: boolean }) {
  const value = item[field.path]

  if (field.path === 'id' || isFirstField) {
    return (
      <Link ...>
        {valueToLabel(field, value)}
      </Link>
    )
  }

  if (value === null || value === undefined) {
    return <div ...>null</div>
  }

  if (field.kind === 'checkbox') {
    ...
  }

  if (field.kind === 'select') {
    ...
  }

  if (field.kind === 'multiselect' && Array.isArray(value)) {
    ...
  }

  if (field.kind === 'relationship') {
    ...
  }

  if (field.kind === 'password' && typeof value === 'object') {
    ...
  }

  if (typeof value === 'object') return <span ...>Complex data</span>

  return <span className="select-text">{String(value)}</span>
}
```

This means list cells for richer field types still miss the per-view rendering behavior that exists in the reference app.

Reference next starter list table uses the field view registry and `Cell` component for each field:

`../next-keystone-starter/features/dashboard/components/ListTable.tsx` lines 145-168:
```tsx
if (field.viewsIndex !== undefined) {
  try {
    const fieldViews = getFieldViews(field.viewsIndex);
    const CellComponent = fieldViews.Cell;

    if (CellComponent) {
      const linkTo = (CellComponent as any).supportsLinkTo ? {
        href: `${basePath}/${list.path}/${encodeURIComponent(item.id)}`
      } : undefined;

      return (
        <CellComponent 
          field={field} 
          item={item} 
          linkTo={linkTo}
        />
      );
    }
  } catch (err) {
    console.warn(`Failed to render cell for field ${fieldKey}:`, err);
  }
}
```

The target app already has the same view-registry ingredients available elsewhere:

- `../next-keystone-starter/features/dashboard/views/registry.ts` shows the registry concept.
- target has `components/dashboard/views/registry.tsx` and field controllers already wired for forms.

So the next fixable parity gap is not routing/header/auth/create/item anymore; it is **list cell rendering parity**.

## Architecture

- `src/routes/dashboard/$listKey.tsx` loads list page data through `fetchDashboardListPage()` and renders `KeystoneListTable`.
- `fetchDashboardListPage()` in `src/features/cms/graphql-client.ts` already resolves selected fields and GraphQL selections for list queries.
- `KeystoneListTable` receives `data.selectedFields` and `data.items`, but renders cells through its own `CellContent` function rather than delegating to field view `Cell` renderers.
- In the next starter, `ListTable` uses the field view registry (`getFieldViews(field.viewsIndex)`) to render per-field cells, passing `field`, `item`, and optional `linkTo` when supported.
- Because the target list table bypasses view `Cell` components, list-page display remains less faithful for complex field kinds even though item/create pages are now controller-backed.

## Start Here

Open `src/components/dashboard/keystone-list-table.tsx` first.

That is the smallest, most self-contained place to close the next parity gap: replace or augment `CellContent()` so it uses the field view registry `Cell` component when available, then keep the current manual logic only as fallback.

## Recommended next single concrete fix

### Gap
List-page field rendering is still custom/manual in the target, while next-keystone-starter uses per-field view `Cell` components.

### Minimal implementation
1. Update `src/components/dashboard/keystone-list-table.tsx`:
   - import the field view registry helper (the target equivalent of `getFieldViews`)
   - in `CellContent()`, before manual kind checks, resolve the field’s `Cell` renderer from `field.viewsIndex`
   - if the `Cell` exists, render it with `{ field, item, linkTo }`
   - only fall back to the current manual rendering when no `Cell` exists or lookup fails
2. Reuse current link behavior by passing a route/link prop only when the resolved `Cell` supports links, matching the reference pattern.

### Exact files
- `src/components/dashboard/keystone-list-table.tsx`
- likely import source: `src/components/dashboard/views/registry.tsx`

### Why this is next
All parity items named in the task prompt appear already closed in target:
- create-page seed/controller defaults: present
- item renders all visible fields: present
- controller-backed create/item: present
- header right trigger: present
- initialSort: present
- floating AI: present
- auth parity: present

The next concrete gap visible from code comparison is list-cell rendering parity.