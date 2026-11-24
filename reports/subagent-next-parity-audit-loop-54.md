# Code Context

## Files Retrieved
1. `src/features/cms/graphql-client.ts` (lines 220-240, 304-314, 485-509) - target list field selection, list/search where construction, and relationship options query logic.
2. `src/components/dashboard/relationship-field-editor.tsx` (lines 1-95) - target relationship picker UI that consumes `fetchDashboardRelationshipOptions`.
3. `../next-keystone-starter/features/dashboard/views/relationship/client/components/RelationshipSelect.tsx` (lines 46-67, 80-120) - reference implementation for relationship option search semantics.
4. `../next-keystone-starter/features/dashboard/actions/relationship.ts` (lines 1-38) - reference server query for relationship options.
5. `src/routes/dashboard/$listKey.tsx` (lines 1-107) - confirms list page already passes filters/search through shared list-page fetch path.
6. `src/routes/dashboard/$listKey.$id.tsx` (lines 1-280) - confirms singleton/item fixes mentioned in the task are already present and not the next gap.

## Key Code
### Target gap
In the target, relationship option fetching does **not** preserve list-level `initialFilter`, and its search semantics are weaker than the app’s own list search builder.

Target code:

```ts
// src/features/cms/graphql-client.ts:493-500
const searchable = list.initialSearchFields
  .map((fieldPath) => list.fields.find((field) => field.path === fieldPath))
  .filter((field): field is DashboardField => Boolean(field))
  .filter((field) => field.isFilterable && ['text', 'select'].includes(field.kind))
const trimmed = search.trim()
const where = trimmed && searchable.length
  ? { OR: searchable.map((field) => ({ [field.path]: { contains: trimmed } })) }
  : undefined
```

That means the relationship picker can surface items that should be excluded by `initialFilter`.

By contrast, the target’s main list page already composes `initialFilter` into its shared where-builder:

```ts
// src/features/cms/graphql-client.ts:304-314
function buildWhere(list: DashboardList, search: string, filters: Record<string, unknown> = {}) {
  const conditions: Array<Record<string, unknown>> = []
  if (isNonEmptyWhereObject(list.initialFilter)) conditions.push(list.initialFilter)
  ...
  const searchConditions: Array<Record<string, unknown>> = [{ id: { equals: trimmed } }]
  searchConditions.push(...searchableFields.map((field) => ({ [field.path]: { contains: trimmed } })))
  conditions.push({ OR: searchConditions })
```

So the target is internally inconsistent: list pages respect `initialFilter`, relationship pickers do not.

### Reference behavior
The reference relationship UI builds a `where` clause and sends it through the relationship options action:

```ts
// ../next-keystone-starter/features/dashboard/views/relationship/client/components/RelationshipSelect.tsx:47-67
function createFilterConditions(search: string, list: any, searchFields: string[]) {
  if (!search.length || !list) return { OR: [] };

  const idFieldKind = list.fields?.id?.controller?.idFieldKind;
  const trimmedSearch = search.trim();
  const isValidId = idFieldKind && idValidators[idFieldKind]?.(trimmedSearch);

  const conditions = [];
  if (isValidId) {
    conditions.push({ id: { equals: trimmedSearch } });
  }

  for (const fieldKey of searchFields) {
    const field = list.fields?.[fieldKey];
    if (field) {
      conditions.push({
        [field.path]: {
          contains: trimmedSearch,
          mode: field.search === "insensitive" ? "insensitive" : undefined,
        },
      });
    }
  }
```

And sends that directly to GraphQL:

```ts
// ../next-keystone-starter/features/dashboard/actions/relationship.ts:17-31
query GetOptions($where: ${gqlNames.whereInputName}!, $take: Int!, $skip: Int!) {
  items: ${gqlNames.listQueryName}(where: $where, take: $take, skip: $skip) {
    id
    ${labelField}
    ${extraSelection}
  }
  count: ${gqlNames.listQueryCountName}(where: $where)
}
```

Even if the reference does not itself merge `initialFilter` here, official Keystone semantics are that admin queries should respect list-level access/filters consistently, and in this target codebase `initialFilter` has already been adopted as part of dashboard query semantics. The relationship picker is the next concrete place where parity is still missing.

## Architecture
- `src/components/dashboard/relationship-field-editor.tsx` is the only consumer found for `fetchDashboardRelationshipOptions`.
- `fetchDashboardRelationshipOptions()` in `src/features/cms/graphql-client.ts` independently builds a GraphQL `where` clause instead of reusing the same `buildWhere()` path used by list pages.
- Because of that forked logic, relationship searching currently misses:
  - `list.initialFilter`
  - ID exact-match fallback used by list search
  - any future filter behavior improvements centralized in `buildWhere()`
- The result is a semantic mismatch: the list page and relationship picker can disagree about which records “exist” for admin selection.

## Start Here
Open `src/features/cms/graphql-client.ts` first. The minimal parity fix is isolated there and does not require edits to `../next-keystone-starter`.

## Finding: next single concrete fixable gap
**Gap:** Relationship option queries ignore `initialFilter` and duplicate weaker search logic instead of reusing the dashboard’s canonical where-builder.

### Why this is the next fix
- It is target-only.
- It is concrete and small.
- It affects visible admin behavior.
- It is a real semantic inconsistency with the target’s own list-page behavior and expected Keystone-style filtering consistency.

## Minimal implementation
In `src/features/cms/graphql-client.ts`, change `fetchDashboardRelationshipOptions()` to reuse `buildWhere()`:

### Current
```ts
const searchable = list.initialSearchFields
  .map((fieldPath) => list.fields.find((field) => field.path === fieldPath))
  .filter((field): field is DashboardField => Boolean(field))
  .filter((field) => field.isFilterable && ['text', 'select'].includes(field.kind))
const trimmed = search.trim()
const where = trimmed && searchable.length
  ? { OR: searchable.map((field) => ({ [field.path]: { contains: trimmed } })) }
  : undefined
```

### Replace with
```ts
const where = buildWhere(list, search)
```

### Result
This will automatically:
- preserve `initialFilter`
- include the existing exact-ID search path already used by list pages
- keep relationship search behavior aligned with dashboard list behavior
- reduce future parity drift by centralizing filter semantics

## Risks / notes
- `buildWhere()` currently adds `{ id: { equals: trimmed } }` for any non-empty search string, which is already the target’s existing list-page behavior; reusing it here improves consistency rather than introducing a new rule.
- If later you want exact Keystone ID validation before adding the ID clause, that should be a separate parity pass. The concrete fix here is simply to stop relationship options from bypassing `initialFilter` and shared search behavior.
