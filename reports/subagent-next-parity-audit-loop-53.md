# Code Context

## Files Retrieved
1. `src/features/cms/graphql-client.ts` (lines 216-229) - target list column fallback now uses first visible non-hidden field when `initialColumns` is empty.
2. `src/components/dashboard/filter-bar.tsx` (lines 306-318) - target `FieldSelection` reset baseline now matches the same fallback logic.
3. `../next-keystone-starter/features/dashboard/hooks/useSelectedFields.ts` (lines 1-31) - Next client-side selected-fields hook still falls back to `Object.keys(list.fields).slice(0, 1)`.
4. `../next-keystone-starter/features/dashboard/components/FieldSelection.tsx` (lines 44-60) - Next clears the `fields` query param only when selection exactly equals `listMeta.initialColumns`, not the effective fallback baseline.
5. `../next-keystone-starter/features/dashboard/screens/ListPage/index.tsx` (lines 72-95) - Next server-side list page still uses a heuristic fallback (`name/title/label/createdAt/updatedAt`) when `initialColumns` is empty.
6. `../next-keystone-starter/features/dashboard/types/index.ts` (lines 88-116, 128-140) - confirms Next field metadata exposes `listView.fieldMode` and list metadata exposes `initialColumns`, so the needed fallback can be computed without schema changes.

## Key Code
Target is now internally consistent:

```ts
// src/features/cms/graphql-client.ts:216-224
const visibleFieldPaths = list.fields
  .filter((field) => field.path !== 'id' && field.listView.fieldMode !== 'hidden')
  .map((field) => field.path)
const defaultPaths = list.initialColumns.length > 0 ? list.initialColumns : visibleFieldPaths.slice(0, 1)
```

```ts
// src/components/dashboard/filter-bar.tsx:306-318
const visibleFieldPaths = list.fields
  .filter((field) => field.path !== 'id' && field.listView.fieldMode !== 'hidden')
  .map((field) => field.path)
const defaultColumnPaths = list.initialColumns.length > 0 ? list.initialColumns : visibleFieldPaths.slice(0, 1)
const initialColumns = ['id', ...defaultColumnPaths]
```

Next still diverges in two places.

Client hook fallback:

```ts
// ../next-keystone-starter/features/dashboard/hooks/useSelectedFields.ts:11-29
if (fieldsFromUrl) {
  selectedFieldsArray = fieldsFromUrl.split(',').filter(field => {
    return field in list.fields
  })
} else {
  selectedFieldsArray = list.initialColumns || []
}

if (selectedFieldsArray.length === 0) {
  selectedFieldsArray = Object.keys(list.fields).slice(0, 1)
}
```

Server list-page fallback:

```ts
// ../next-keystone-starter/features/dashboard/screens/ListPage/index.tsx:82-92
if (list.initialColumns && list.initialColumns.length > 0) {
  selectedFields = [...selectedFields, ...list.initialColumns]
} else if (list.fields) {
  Object.keys(list.fields).forEach(fieldKey => {
    if (['name', 'title', 'label', 'createdAt', 'updatedAt'].includes(fieldKey)) {
      selectedFields.push(fieldKey)
    }
  })
}
```

Next `FieldSelection` also uses the wrong reset baseline:

```ts
// ../next-keystone-starter/features/dashboard/components/FieldSelection.tsx:52-60
const setNewSelectedFields = (fields: string[]) => {
  if (isArrayEqual(fields, listMeta.initialColumns || [])) {
    const otherQueryFields = { ...query }
    delete otherQueryFields.fields
    router.push(`${pathname}?${new URLSearchParams(otherQueryFields)}`)
  } else {
    router.push(`${pathname}?${new URLSearchParams({ ...query, fields: fields.join(',') })}`)
  }
}
```

## Architecture
- In Next, list-page selected columns are computed in two separate paths:
  - server render: `features/dashboard/screens/ListPage/index.tsx`
  - client URL state hook: `features/dashboard/hooks/useSelectedFields.ts`
- The column picker URL-elision logic lives in `features/dashboard/components/FieldSelection.tsx`.
- Target already centralized the effective default to “configured `initialColumns`, otherwise first visible non-hidden field” and uses that same baseline for reset behavior.
- Next still mixes three different baselines:
  1. `initialColumns`
  2. first raw object key from `list.fields`
  3. heuristic `name/title/label/createdAt/updatedAt`
- Because of that, Next can render different default columns between SSR and client state, and can keep a redundant `fields=` query param even after the user returns to the effective default selection.

## Start Here
Open `../next-keystone-starter/features/dashboard/screens/ListPage/index.tsx` first. It contains the most visible divergence because the server-rendered list page still chooses fallback columns via a hard-coded heuristic instead of the target’s first-visible-field rule.

## Next single concrete fixable parity gap
**Next still has inconsistent default selected-column fallback and reset-baseline behavior when a list has no `initialColumns`.**

### Why this is the next gap
- The target already implements the corrected fallback and reset semantics.
- Next still diverges from target in both data loading and URL-state handling.
- This is small, localized, and user-visible on any list without configured `initialColumns`.
- It does not require schema/runtime changes because Next already has `listView.fieldMode` metadata.

## Minimal implementation
1. **Add a tiny shared helper in Next** to compute effective default list columns:
   - candidate location: `../next-keystone-starter/features/dashboard/lib/getDefaultSelectedFields.ts`
   - logic:
     - if `initialColumns.length > 0`, use those
     - else use the first field whose path is not `id` and whose `listView.fieldMode !== 'hidden'`
     - if none exist, fall back to `[]` and let callers still prepend `id`

2. **Use that helper in `../next-keystone-starter/features/dashboard/screens/ListPage/index.tsx`**
   - replace the `name/title/label/createdAt/updatedAt` heuristic with the helper result.

3. **Use the same helper in `../next-keystone-starter/features/dashboard/hooks/useSelectedFields.ts`**
   - replace `Object.keys(list.fields).slice(0, 1)` with the same effective fallback.

4. **Update `../next-keystone-starter/features/dashboard/components/FieldSelection.tsx`**
   - compare against the helper-derived effective default selection, not only `listMeta.initialColumns`.
   - preserve the existing behavior of deleting the `fields` query param when the user is back at defaults.

### Minimal shape
```ts
function getDefaultSelectedFieldPaths(list: ListMeta): string[] {
  if (list.initialColumns?.length) return list.initialColumns

  return Object.entries(list.fields)
    .filter(([path, field]) => path !== 'id' && field.listView?.fieldMode !== 'hidden')
    .map(([path]) => path)
    .slice(0, 1)
}
```

Then:
- `ListPage/index.tsx`: `selectedFields = ['id', ...getDefaultSelectedFieldPaths(list)]`
- `useSelectedFields.ts`: when no URL fields exist, use helper output
- `FieldSelection.tsx`: clear `fields` when selection equals `['id', ...getDefaultSelectedFieldPaths(listMeta)]` or the same UI-equivalent array expected there

## Constraints / risks
- Keep `id` always included internally.
- Do not reintroduce hidden fields into the fallback.
- Avoid the current `Object.keys(list.fields)` fallback because it can pick hidden or structurally-first fields instead of a visible list column.
- Avoid the current heuristic fallback because it can select multiple fields and differ from the client hook.
- This is a Next-only parity cleanup; target does not need edits for this gap.