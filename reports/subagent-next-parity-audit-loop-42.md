# Code Context

## Files Retrieved
1. `src/routes/dashboard/$listKey.$id.tsx` (lines 1-178) - target item page route; currently renders a simple title + message + ID card + generic `ControllerFields` block.
2. `src/components/dashboard/controller-fields.tsx` (lines 1-48) - target shared field layout; always renders a two-column grid and an empty "No sidebar fields." section when no sidebar fields exist.
3. `src/components/dashboard/field-form-layout.tsx` (lines 1-46) - target already has the canonical partitioning logic for `itemView.fieldPosition` / `createView.fieldPosition` and field grouping.
4. `src/routes/dashboard/$listKey.create.tsx` (lines 1-103) - target create page also delegates all layout to `ControllerFields`.
5. `../next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx` (lines 372-559) - upstream item page layout; uses a dedicated sidebar/main split, ID card in sidebar, and only renders sidebar fields when present.
6. `../next-keystone-starter/features/dashboard/screens/CreatePage/CreatePageClient.tsx` (lines 100-188) - upstream create page uses the same explicit sidebar/main page layout shape.
7. `../next-keystone-starter/features/dashboard/components/PageBreadcrumbs.tsx` (lines 1-59) - upstream header actions area has no forced right trigger; useful only as layout comparison context.

## Key Code
Target item page is still structurally flatter than upstream:

```tsx
// src/routes/dashboard/$listKey.$id.tsx
<main className="w-full max-w-5xl space-y-6 p-4 md:p-6">
  <div>
    <h1 className="text-lg font-semibold md:text-2xl">{data.title}</h1>
    <p className="text-sm text-muted-foreground">Edit {data.list.singular.toLowerCase()} fields and save changes.</p>
  </div>
  {message ? <div className="rounded-md border bg-muted/30 p-3 text-sm">{message}</div> : null}
  <Card>...ID...Copy ID...</Card>
  <ControllerFields list={data.list} fields={allVisibleFields} values={draft} view="itemView" ... />
</main>
```

Target shared field renderer always shows a sidebar column, even when empty:

```tsx
// src/components/dashboard/controller-fields.tsx
return (
  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
    <div className="space-y-4">...</div>
    <div className="space-y-4">
      {sidebarGroups.length ? ... : (
        <FieldSection title="Sidebar"><p className="text-sm text-muted-foreground">No sidebar fields.</p></FieldSection>
      )}
    </div>
  </div>
)
```

But upstream item page keeps page chrome outside the field renderer and only mounts sidebar content when it exists:

```tsx
// ../next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx
<main className="w-full max-w-5xl p-4 md:p-6">
  <div className="grid lg:grid-cols-[minmax(240px,2fr)_3fr] gap-6 gap-y-8">
    <aside className="lg:sticky lg:top-24 ...">
      ...title...
      ...ID card + copy button...
      {Object.keys(fieldsSplit.sidebarFields).length > 0 && <Fields ... fields={fieldsSplit.sidebarFields} />}
    </aside>
    <div className="space-y-6">
      ...errors...
      {Object.keys(fieldsSplit.mainFields).length > 0 && <Fields ... fields={fieldsSplit.mainFields} ... />}
    </div>
  </div>
</main>
```

Target already has the needed partition/group primitives:

```ts
// src/components/dashboard/field-form-layout.tsx
if (view.fieldPosition === 'sidebar') sidebar.push(field)
else form.push(field)
```

## Architecture
- `src/features/cms/graphql-client.ts` and runtime metadata already supply `itemView.fieldPosition` / `createView.fieldPosition`.
- `src/components/dashboard/field-form-layout.tsx` already turns those flags into `form` and `sidebar` buckets.
- `src/components/dashboard/controller-fields.tsx` consumes that split, but currently forces a generic two-column renderer for all pages.
- `src/routes/dashboard/$listKey.$id.tsx` and `src/routes/dashboard/$listKey.create.tsx` therefore cannot match upstream page-level composition: title/ID/sidebar chrome beside grouped form fields.

## Start Here
Open `src/components/dashboard/controller-fields.tsx` first. It is the narrowest choke point causing the remaining item/create layout divergence even though field-position metadata already exists.

## Next single concrete fixable parity gap
**Gap:** item/create page field-position parity is still incomplete at the page layout level. The target has the metadata and partitioning logic, but it still renders everything through a generic `ControllerFields` grid with an always-present empty sidebar panel, instead of the upstream sidebar/main page composition.

### Minimal implementation
1. **Expose split sections from the shared field layout helper or shared renderer**
   - File: `src/components/dashboard/controller-fields.tsx`
   - Stop rendering the fallback empty sidebar `FieldSection title="Sidebar"` when `sidebarGroups.length === 0`.
   - Preferably export a small helper/variant that returns `{ formGroups, sidebarGroups }`, or otherwise make `ControllerFields` capable of rendering main-only without reserving the sidebar column.

2. **Mirror upstream item page composition**
   - File: `src/routes/dashboard/$listKey.$id.tsx`
   - Replace the flat `space-y-6` body with the upstream-style grid:
     - left/sticky sidebar: page title, ID/copy block, sidebar-positioned field groups only when present
     - right column: message/error state + form-positioned field groups
   - Reuse `partitionFieldsByPosition` / `groupFields` from `src/components/dashboard/field-form-layout.tsx` instead of recomputing logic ad hoc.

3. **Apply the same pattern to create page**
   - File: `src/routes/dashboard/$listKey.create.tsx`
   - Use the same sidebar/main split so `createView.fieldPosition === 'sidebar'` produces the same page structure as upstream.

### Why this is the next fix
The previously listed contract and data-flow gaps in this area are already closed: `itemView(id)` overrides exist, selected visible fields are controller-backed, create defaults exist, and field position metadata is already available. What still diverges is the actual page composition that makes sidebar-positioned fields behave and look like upstream. This is a self-contained UI parity fix touching only the item/create pages plus the shared layout helper.

### Risk / constraint
- Keep the field controller logic unchanged; this is primarily composition/layout work.
- Avoid duplicating grouping logic in route files; the existing `partitionFieldsByPosition()` and `groupFields()` helpers should remain the single source of truth.
- If you choose not to move full layout into the routes, at minimum remove the forced empty sidebar panel, because it currently creates visible non-upstream chrome even when no sidebar fields exist.
