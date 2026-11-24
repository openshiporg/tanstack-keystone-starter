# Code Context

## Files Retrieved
1. `src/routes/dashboard/$listKey.$id.tsx` (lines 226-271) - singleton create form implementation; after creation it still navigates to the database id instead of the canonical singleton route `/1`.
2. `src/routes/dashboard/$listKey.$id.tsx` (lines 157-158) - singleton missing-item flow is explicitly keyed off `params.id === '1'`, confirming `/1` is the intended canonical singleton route in target.
3. `src/routes/dashboard/$listKey.create.tsx` (lines 20-22, 30-78) - non-singleton create route already redirects singletons away and uses created ids only for normal lists, so the gap is isolated to singleton create success handling.
4. `src/routes/dashboard/index.tsx` (lines 58-80) - dashboard cards now link singleton lists to `/dashboard/$listKey/1`, establishing canonical singleton navigation elsewhere in target.
5. `src/components/dashboard/relationship-field-editor.tsx` (lines 108-121) - “Create related” for singleton relationships also links to `/dashboard/$listKey/1`, reinforcing that singleton navigation is intended to be canonicalized to `/1`.
6. `src/features/cms/graphql-client.ts` (lines 30-30, 232-232) - overview data carries `singletonItemId`, but route consumers are already choosing canonical `/1` links rather than real ids.
7. `../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx` (lines 20-23) - reference app also treats singleton list navigation specially rather than exposing arbitrary item ids.

## Key Code
Target singleton create currently breaks canonical singleton routing immediately after success:

```ts
// src/routes/dashboard/$listKey.$id.tsx:261-269
const result = await executeDashboardGraphQL<Record<string, { id: string }>>(
  `mutation DashboardCreateSingleton($data: ${data.list.gqlNames.createInputName}!) { ${mutationName}(data: $data) { id } }`,
  { data: createData },
)
const created = result[mutationName]
if (!created?.id) throw new Error('Create succeeded but no item id was returned.')
...
await navigate({ to: '/dashboard/$listKey/$id', params: { listKey: data.list.path, id: created.id } })
```

But the same file uses `/1` as the singleton sentinel route:

```ts
// src/routes/dashboard/$listKey.$id.tsx:157-158
if (missingItem && data.list.isSingleton && params.id === '1') {
  return data.list.hideCreate ? <MissingSingletonMessage data={data} /> : <SingletonCreateForm data={data} />
}
```

And other target entry points already link singletons canonically:

```ts
// src/routes/dashboard/index.tsx:62-79
{isSingleton ? (
  list.singletonItemId ? (
    <Link to="/dashboard/$listKey/$id" params={{ listKey: list.path, id: '1' }} ...>
```

```ts
// src/components/dashboard/relationship-field-editor.tsx:114-118
relatedList?.isSingleton ? (
  <Link to="/dashboard/$listKey/$id" params={{ listKey: resolvedListKey, id: '1' }} ...>
```

Reference app also special-cases singleton destinations in overview navigation:

```ts
// ../next-keystone-starter/features/dashboard/screens/HomePage/index.tsx:22-23
const isSingleton = list.isSingleton || false
const href = `/dashboard/${list.path}${isSingleton ? '/1' : ''}`
```

## Architecture
- Target has adopted a canonical singleton route convention: `/dashboard/<listPath>/1`.
- That convention is now used by dashboard overview cards and relationship “create related” actions.
- The item route also depends on that sentinel path to render the in-place singleton create form when the singleton record does not yet exist.
- However, once the singleton is created, `SingletonCreateForm` navigates to the actual created item id instead of `/1`.
- This creates an internal parity inconsistency:
  - entry points send users to `/1`
  - post-create sends them to `/<real-id>`
  - future singleton interactions no longer stay on the canonical singleton URL.

## Start Here
Open `src/routes/dashboard/$listKey.$id.tsx` first. The remaining parity gap is localized to `SingletonCreateForm` success navigation.

## Findings
### Next single concrete fixable parity gap
**Singleton create success still redirects to the created database id instead of the canonical `/1` singleton route.**

This is the next small, concrete target-only parity gap after the listed fixes.

### Minimal implementation
Change the success navigation in `SingletonCreateForm`:

- File: `src/routes/dashboard/$listKey.$id.tsx`
- Current behavior:
  - `await navigate({ to: '/dashboard/$listKey/$id', params: { listKey: data.list.path, id: created.id } })`
- Minimal fix:
  - navigate to `id: '1'` instead.

Suggested implementation shape:

```ts
await navigate({
  to: '/dashboard/$listKey/$id',
  params: { listKey: data.list.path, id: '1' },
})
```

### Why this is the right next fix
- It matches the already-fixed canonical singleton card links.
- It matches the singleton relationship create links.
- It preserves the target route’s special singleton create/missing-item behavior keyed on `/1`.
- It is isolated to one line in one file and does not require backend changes.

### Risk / note
Very low risk. The route already fetches the real singleton item through normal item-page loading; `/1` is acting as a stable singleton dashboard URL, not the persisted record id.