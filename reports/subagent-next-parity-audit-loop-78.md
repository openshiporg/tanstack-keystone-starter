# Code Context

## Files Retrieved
1. `src/features/cms/admin-meta.ts` (lines 31-70) - target admin meta shaping for relationship fields and view metadata.
2. `src/features/cms/graphql-client.ts` (lines 271-287) - target item/list GraphQL selection for relationship labels.
3. `src/features/cms/graphql-client.ts` (lines 560-598) - target relationship option fetching already uses related list `labelField`.
4. `src/components/dashboard/relationship-field-editor.tsx` (lines 12-137) - target relationship editor consumes hydrated labels from fetch helpers.
5. `../next-keystone-starter/features/dashboard/views/relationship/index.tsx` (lines 290-311) - reference relationship controller uses `fieldMeta.refLabelField` when building GraphQL selection.
6. `../next-keystone-starter/features/dashboard/views/relationship/index.tsx` (lines 160-210) - reference filter hydration uses the related list label field rather than generic fallbacks.

## Key Code
Reference app relationship view stores explicit related-list label metadata and always queries it:

```ts
// ../next-keystone-starter/features/dashboard/views/relationship/index.tsx:290-311
const refLabelField = config.fieldMeta.refLabelField;
...
graphqlSelection:
  config.fieldMeta.displayMode === "count"
    ? `${config.path}Count`
    : `${config.path} {
          id
          label: ${refLabelField}
        }`,
```

Target app partially hydrates relationship labels, but derives the label field only from `fieldMeta.ref`:

```ts
// src/features/cms/graphql-client.ts:271-277
const ref = typeof field.fieldMeta.ref === 'string' ? field.fieldMeta.ref : undefined
const refListKey = ref?.split('.')[0]
const refList = adminMeta.lists.find((list) => list.key === refListKey)
const labelField = refList?.labelField ?? 'id'
const hasLabelField = refList?.fields.some((candidate) => candidate.path === labelField)
return hasLabelField ? labelField : 'id'
```

and then uses that for item/list relationship selections:

```ts
// src/features/cms/graphql-client.ts:280-286
if (field.kind === 'relationship') {
  const labelField = labelFieldForRelationship(adminMeta, field)
  return `${field.path} { id label: ${labelField} }`
}
```

Target admin meta only exposes `refListPath`, not the canonical related list key/label field/search metadata:

```ts
// src/features/cms/admin-meta.ts:31-50
function relationshipRefListPath(field: CmsField) {
  const refListKey = typeof field.ref === 'string' ? field.ref.split('.')[0] : undefined
  return refListKey ? cmsLists.find((list) => list.key === refListKey)?.path : undefined
}
...
fieldMeta: {
  kind: field.kind,
  defaultValue: field.defaultValue,
  options: field.options,
  ref: field.ref,
  many: field.many,
  validation: field.validation,
  ...field.fieldMeta,
  ...(refListPath ? { refListPath } : {}),
},
```

Meanwhile the target relationship picker already expects richer related-list metadata indirectly and uses shared fetchers that can honor the real `labelField`:

```ts
// src/components/dashboard/relationship-field-editor.tsx:50-63
const relatedList = adminMeta ? findDashboardListByPath(adminMeta, listPath || listKey) : undefined
const resolvedListKey = relatedList?.path ?? listKey
...
queryFn: () => fetchDashboardRelationshipOptionsByIds({ listKey: resolvedListKey, ids }),
```

Relationship option fetches are fine today because they look up the list first:

```ts
// src/features/cms/graphql-client.ts:560-598
const labelField = list.fields.some((field) => field.path === list.labelField) ? list.labelField : 'id'
...
label: ${labelField}
```

## Architecture
- `src/features/cms/admin-meta.ts` builds the GraphQL `adminMeta` payload used everywhere in the target dashboard.
- `src/features/cms/graphql-client.ts` normalizes that metadata and derives GraphQL selections for list/item/detail reads.
- Relationship labels shown in tables/cards/details depend on `graphQLSelectionForField()` selecting `id` plus a label alias from the related list.
- Relationship search pickers and selected-chip hydration already call dedicated fetch helpers, which correctly query the related list’s `labelField`.
- So the remaining parity weakness is metadata completeness/canonicality for relationships: the target UI infers related list identity from `fieldMeta.ref`, while the reference app carries explicit relationship metadata (`refListKey`, `refLabelField`, `refSearchFields`) in field meta.

## Start Here
Open `src/features/cms/admin-meta.ts` first. That is the narrowest place to add the missing canonical relationship metadata so downstream consumers stop reverse-engineering related list config from `fieldMeta.ref`.

## Next single concrete fixable parity gap
**Gap:** target admin metadata does not expose canonical relationship label metadata (`refListKey`, `refLabelField`, and likely `refSearchFields`), while reference code depends on explicit relationship metadata instead of re-deriving from `ref`. This is a parity gap because label hydration was fixed at query time, but the metadata surface still differs and leaves relationship UI coupled to string parsing + indirect list lookup.

### Why this is the next fix
- The previously-called-out relationship label hydration is mostly fixed for fetched option lists and list/item GraphQL selections.
- But the target still lacks the explicit relationship metadata the reference app exposes, which is the next smallest remaining gap in this area.
- It is low-risk and localized: add metadata in admin-meta shaping, then consume it in one helper.

### Minimal implementation
1. **Augment relationship field meta in `src/features/cms/admin-meta.ts`:**
   - derive `refListKey` from `field.ref`
   - resolve the referenced list from `cmsLists`
   - include in `fieldMeta`:
     - `refListKey`
     - `refLabelField` (fallback to `'id'` if missing/not present in fields)
     - `refSearchFields` (fallback to referenced list’s `initialSearchFields` or `[refLabelField]`)
   - keep existing `refListPath`.

2. **Use canonical metadata in `src/features/cms/graphql-client.ts`:**
   - update `labelFieldForRelationship()` to prefer `field.fieldMeta.refLabelField` before re-deriving from `field.fieldMeta.ref`.
   - optionally prefer `field.fieldMeta.refListKey` over parsing `ref` when resolving the related list.

### Exact files likely needing changes
- `src/features/cms/admin-meta.ts`
- `src/features/cms/graphql-client.ts`

### Risks / constraints
- Ensure `refLabelField` only points to a real field on the related list; otherwise fall back to `id`.
- `fieldMeta` is typed as a generic record in some places, so this should not require broad type churn unless you want to formalize the extra keys in `src/features/cms/types.ts` later.
- This should not affect existing fetched labels negatively because current fetch helpers already honor `list.labelField`; it just makes metadata parity and downstream usage canonical.
