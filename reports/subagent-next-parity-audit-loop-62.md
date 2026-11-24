# Next parity audit loop 62

## Finding: relationship field editor still exposes create navigation even when target list hideCreate is true

This is the next concrete target-only parity gap after the recently fixed areas.

### Why this is a real gap

The target correctly enforces `hideCreate` at the route level for normal list create pages:

- `src/routes/dashboard/$listKey.create.tsx:12-22` redirects away when `list.hideCreate` is true.

However, the relationship field editor still always renders a **Create related** link whenever a relationship has a resolved target list key/path:

- `src/components/dashboard/relationship-field-editor.tsx:87-98`

That means request-aware `AdminMeta.hideCreate` is functionally respected on the main list UI and create route, but **not** in the relationship-picker UI. Users can still see and click a create affordance for a related list that is supposed to have create hidden. The route redirect prevents actual creation, but Keystone semantics and starter parity expect the UI affordance itself to be hidden.

This matches the reference starter’s behavior, where relationship create affordances are gated by a hide-create flag on the field config:

- `../next-keystone-starter/features/dashboard/views/relationship/client/Field.tsx:206-224`

The official Keystone expectation is UI consistency with `hideCreate`: if creation is hidden for the target list, create actions should not be offered from related-item controls either.

## Exact target files

1. `src/components/dashboard/relationship-field-editor.tsx` (lines 12-19, 37-47, 87-98)
   - Computes related list key/path, fetches relationship options, and unconditionally shows the create link.
2. `src/features/cms/graphql-client.ts` (lines 499-521)
   - Already fetches request-aware admin meta and can resolve the related list, so it has enough metadata available for a minimal fix if the component is taught to read it.
3. `src/routes/dashboard/$listKey.create.tsx` (lines 12-22)
   - Confirms the intended invariant: hidden-create lists must redirect away from create routes.

## Minimal implementation

### Preferred minimal fix

Update `src/components/dashboard/relationship-field-editor.tsx` so the **Create related** link is only rendered when the related list’s request-aware admin meta says `hideCreate === false`.

Concretely:

1. Fetch admin meta in the component with the same query cache key already used elsewhere:
   - `dashboardQueryKeys.adminMeta`
   - `fetchKeystoneAdminMeta()`
2. Resolve the related list by `listKey`/`listPath` using `findDashboardListByPath(...)`.
3. Derive:
   - `const relatedList = ...`
   - `const canCreateRelated = Boolean(relatedList && !relatedList.hideCreate)`
4. Change the footer rendering so:
   - the wrapper can still render **View related details** when one id is selected
   - the **Create related** link only appears when `canCreateRelated` is true
   - use `relatedList?.singular ?? listKey` for the label if desired

### Smallest shape of change

In `src/components/dashboard/relationship-field-editor.tsx`:

- extend imports from `@/features/cms/graphql-client` to include:
  - `fetchKeystoneAdminMeta`
  - `findDashboardListByPath`
- add a second `useQuery` for admin meta
- compute `relatedList`
- replace the unconditional create link with a conditional one based on `relatedList.hideCreate`

## Why this should be fixed next

- It is a user-visible parity hole in the target only.
- It directly concerns one of the audited areas: **request-aware `AdminMeta.hideCreate` functional UI flags**.
- The fix is isolated to one component and does not require backend or schema changes.
- It does **not** require any edits to `../next-keystone-starter`.

## Notes / risk

- The component currently derives target identity from field metadata:
  - `refListPath` first, otherwise list key from `ref`
- Because `fetchKeystoneAdminMeta()` is request-aware, this UI gating will respect the current user/session the same way the create route already does.
- Avoid hard-coding create visibility from field metadata alone; list-level admin meta is the canonical source for this parity point.
