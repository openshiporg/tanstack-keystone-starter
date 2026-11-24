# Code Context

## Files Retrieved
1. `src/components/dashboard/enhance-fields.tsx` (lines 1-39) - target field enhancement path used by filter UI and controller wiring.
2. `src/components/dashboard/filter-bar.tsx` (lines 69-76, 260-342, 400-422) - target filter UI consumes `enhanceFields(...).controller.filter` for add/edit popovers.
3. `src/features/cms/graphql-client.ts` (lines 297-320, 321-379) - target initial sort pipeline already resolves effective sort token from explicit sort, `initialSort`, then fallback and returns that token to UI.
4. `../next-keystone-starter/features/dashboard/utils/enhanceFields.ts` (lines 1-72) - reference implementation for field enhancement, including custom view export handling and controller construction.
5. `../next-keystone-starter/features/dashboard/lib/sort.ts` (lines 1-49) - reference sort fallback behavior.
6. `../next-keystone-starter/features/dashboard/components/SortSelection.tsx` (lines 1-164) - reference sort UI consuming effective token semantics.
7. `src/components/dashboard/dashboard-shell.tsx` (lines 1-45) - target sidebar/floating chat implementation; checked for parity area.
8. `src/routes/dashboard/no-access.tsx` (lines 1-36) - target no-access route; checked for parity area.
9. `src/components/ui/sidebar.tsx` (lines 90-205) - target sidebar provider defaults/state path; checked for parity area.
10. `src/components/ui/popover.tsx` (lines 1-23) - target shared popover primitive; checked for parity area.
11. `../next-keystone-starter/features/dashboard/screens/NoAccessPage/index.tsx` (lines 1-49) - reference no-access screen.
12. `../next-keystone-starter/features/dashboard/components/FilterAdd.tsx` (lines 80-150) and `../next-keystone-starter/features/dashboard/components/FilterList.tsx` (lines 160-240) - reference add/edit filter popover behavior.

## Key Code

### Already matched / not the next gap
- **Initial sort token exposed to UI** is already implemented in target:
  - `src/features/cms/graphql-client.ts:297-320` resolves the effective token from URL sort, then `initialSort`, then fallback.
  - `src/features/cms/graphql-client.ts:379` returns `sortBy: resolveEffectiveSortToken(list, sortBy)` to the UI.
- **Sidebar / floating chat / no-access / popovers** looked materially aligned enough for this pass:
  - `src/components/dashboard/dashboard-shell.tsx:13-28` mirrors reference floating-button logic.
  - `src/routes/dashboard/no-access.tsx:10-35` is effectively parity with reference no-access UX.
  - `src/components/ui/popover.tsx:6-18` provides the shared portal/popup wrapper used by filter popovers.

### Next concrete parity gap
The next fixable gap is **`enhanceFields` not matching the reference registry/controller merge behavior for custom views and normalized field view metadata**.

#### Target today
`src/components/dashboard/enhance-fields.tsx:13-39`
```ts
export function enhanceFields(fields: DashboardField[], listKey: string) {
  return Object.fromEntries(
    fields.map((field) => {
      try {
        const views = { ...getFieldViews(field.viewsIndex, field) }
        const customViews: Record<string, unknown> = {}
        if (typeof field.customViewsIndex === 'number') Object.assign(customViews, getFieldViews(field.customViewsIndex, field))
        const controller = views.controller({
          listKey,
          fieldMeta: field.fieldMeta,
          label: field.label,
          description: field.description,
          path: field.path,
          customViews,
        })
        return [field.path, { ...field, controller }]
      } catch {
        const controller = getFieldViews(field.viewsIndex, field).controller({ ... })
        return [field.path, { ...field, controller }]
      }
    }),
  ) as Record<string, EnhancedDashboardField>
}
```

Problems versus reference:
- It passes **all custom-view exports wholesale** into `customViews` instead of filtering by `allowedExportsOnCustomViews`.
- It does **not override `Field`/`controller` exports** from custom views when reference logic allows that.
- It does **not normalize** `createView`, `itemView`, `listView`, and `graphql.isNonNull` on enhanced fields.
- It swallows errors and retries, which can hide malformed view modules instead of producing the same shaped result/reference expectations.

#### Reference behavior
`../next-keystone-starter/features/dashboard/utils/enhanceFields.ts:7-68`
```ts
const expectedExports = new Set(['Field', 'controller'])

for (const exportName of expectedExports) {
  const fieldViews = getFieldViews(field.viewsIndex)
  if ((fieldViews as any)[exportName] === undefined) {
    throw new Error(...)
  }
}

const views = { ...getFieldViews(field.viewsIndex) }
const customViews: Record<string, any> = {}

if (field.customViewsIndex !== null && field.customViewsIndex !== undefined) {
  const customViewsSource = getFieldViews(field.customViewsIndex) as any
  const allowedExportsOnCustomViews = new Set((views as any).allowedExportsOnCustomViews || [])

  for (const exportName in customViewsSource) {
    if (allowedExportsOnCustomViews.has(exportName)) {
      customViews[exportName] = customViewsSource[exportName]
    } else if (expectedExports.has(exportName)) {
      ;(views as any)[exportName] = customViewsSource[exportName]
    }
  }
}

enhancedFields[fieldPath] = {
  ...field,
  createView: { ... },
  itemView: { ... },
  listView: { ... },
  graphql: { isNonNull: field.isNonNull || [] },
  views,
  controller: (views as any).controller({ ... customViews })
}
```

## Architecture
- List page/filter UI in target uses `enhanceFields()` as the bridge from raw admin-meta field records into runtime field controllers.
- `src/components/dashboard/filter-bar.tsx:72-76` memoizes `enhanceFields(list.fields, list.key)`.
- Add-filter and edit-filter popovers then rely on `field.controller.filter.types`, `field.controller.filter.Filter`, and `field.controller.filter.Label` from those enhanced fields:
  - `src/components/dashboard/filter-bar.tsx:74-76`
  - `src/components/dashboard/filter-bar.tsx:145-165`
  - `src/components/dashboard/filter-bar.tsx:370-422`
- Because this controller path is central, any missing custom view export merge or metadata normalization causes subtle parity failures across filter/edit/create/item experiences, even though the sort pipeline itself is already correct.

## Start Here
Open `src/components/dashboard/enhance-fields.tsx` first.

It is the smallest, highest-leverage parity fix left in the audited scope: one helper feeds the filter/controller/view runtime, and its behavior is still behind the reference implementation.

## Minimal implementation
Update only:
- `src/components/dashboard/enhance-fields.tsx`

Minimal change set:
1. Add `expectedExports = new Set(['Field', 'controller'])`.
2. Iterate fields into an object/record rather than `Object.fromEntries(fields.map(...))`, so invalid fields can be skipped cleanly if needed.
3. Validate base view exports from `getFieldViews(field.viewsIndex, field)`.
4. Build `views` from base views.
5. If `customViewsIndex` exists:
   - load custom view exports,
   - copy only exports named in `views.allowedExportsOnCustomViews` into `customViews`,
   - if custom view exports `Field` or `controller`, override those on `views`.
6. Return/store enhanced fields with normalized shapes:
   - `createView: { fieldMode, isRequired }`
   - `itemView: { fieldMode, fieldPosition, isRequired }`
   - `listView: { fieldMode }`
   - `graphql: { isNonNull: field.isNonNull || [] }`
   - `views`
   - `controller: views.controller({... customViews })`

## Recommended exact fix
Replace target helper behavior with the reference logic adapted to array-backed `DashboardField[]` input.

Pseudo-shape of the target adaptation:
```ts
const expectedExports = new Set(['Field', 'controller'])

export function enhanceFields(fields: DashboardField[], listKey: string) {
  const enhancedFields: Record<string, EnhancedDashboardField> = {}

  for (const field of fields) {
    if (typeof field.viewsIndex !== 'number') continue

    const baseViews = getFieldViews(field.viewsIndex, field)
    for (const exportName of expectedExports) {
      if ((baseViews as any)[exportName] === undefined) {
        throw new Error(`The view for the field at ${listKey}.${field.path} is missing the ${exportName} export`)
      }
    }

    const views = { ...baseViews }
    const customViews: Record<string, unknown> = {}

    if (typeof field.customViewsIndex === 'number') {
      const customViewsSource = getFieldViews(field.customViewsIndex, field) as Record<string, unknown>
      const allowed = new Set((views as any).allowedExportsOnCustomViews || [])
      for (const exportName in customViewsSource) {
        if (allowed.has(exportName)) customViews[exportName] = customViewsSource[exportName]
        else if (expectedExports.has(exportName)) (views as any)[exportName] = customViewsSource[exportName]
      }
    }

    enhancedFields[field.path] = {
      ...field,
      createView: {
        fieldMode: field.createView?.fieldMode ?? null,
        isRequired: field.createView?.isRequired ?? false,
      },
      itemView: {
        fieldMode: field.itemView?.fieldMode ?? null,
        fieldPosition: field.itemView?.fieldPosition ?? null,
        isRequired: field.itemView?.isRequired ?? false,
      },
      listView: {
        fieldMode: field.listView?.fieldMode ?? null,
      },
      graphql: {
        isNonNull: (field as any).isNonNull || [],
      },
      views,
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

  return enhancedFields
}
```

## Why this is the next best gap
- The sort-token/initial-sort parity item called out in the task is already fixed in target.
- This remaining helper gap is still directly within the task’s audited scope: **enhanceFields registry/controller path**.
- It is isolated to one file and unlocks downstream parity across filter/controller-driven UI without broad refactors.
- It is more concrete and lower risk than reworking sidebar/popover/auth shell paths, which already looked close in this comparison pass.
