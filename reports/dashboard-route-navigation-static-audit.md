# Code Context

## Files Retrieved
1. `src/routeTree.gen.ts` (lines 11-284) - generated TanStack file-route mapping, parent/child nesting, path/id/fullPath truth.
2. `src/routes/dashboard.tsx` (lines 1-61) - `beforeLoad` auth/redirect guard behavior for dashboard subtree.
3. `src/routes/dashboard/$listKey.tsx` (lines 1-108) - list page route, loader, and table mount point.
4. `src/routes/dashboard/$listKey.create.tsx` (lines 1-189) - create item route and post-create navigation.
5. `src/routes/dashboard/$listKey.$id.tsx` (lines 1-8) - item route currently placeholder (major parity gap).
6. `src/routes/dashboard/index.tsx` (lines 11-82) - dashboard cards + create affordance behavior.
7. `src/components/dashboard/keystone-list-table.tsx` (lines 14-260) - first-cell + View links, row click navigation, item-route targeting.
8. `src/components/dashboard/filter-bar.tsx` (lines 46-202) - list-page create button link semantics.
9. `src/components/dashboard/list-card.tsx` (lines 1-54) - reusable list-card create/open navigation.
10. `src/components/dashboard/relationship-field-editor.tsx` (lines 11-104) - relationship create/view links and listKey derivation.
11. `src/components/dashboard/page-breadcrumbs.tsx` (lines 1-52) - breadcrumb link rendering via TanStack `Link`.
12. `src/components/dashboard/page-container.tsx` (lines 1-55) - list/index breadcrumb wrapper behavior.
13. `src/components/ui/button.tsx` (lines 1-59) - Base UI button API, button-as-link semantics check.
14. Next reference: `app/dashboard/(admin)/[listKey]/create/page.tsx`, `app/dashboard/(admin)/[listKey]/[id]/page.tsx`, `features/dashboard/components/ListTable.tsx`, `features/dashboard/components/PageBreadcrumbs.tsx` - expected route parity shape and link targets.

## Key Code
- **Route tree is structurally correct for create/item child routes despite filename dot notation**:
  - `src/routeTree.gen.ts` maps `src/routes/dashboard/$listKey.create.tsx` to full path `/dashboard/$listKey/create` and `$listKey.$id.tsx` to `/dashboard/$listKey/$id` (lines 22-23, 76-85, 104-105, 263-273).
  - Conclusion: no current generator mismatch from `$listKey.create.tsx` naming.

- **Primary missing page**:
  - `src/routes/dashboard/$listKey.$id.tsx` is placeholder only:
    ```tsx
    export const Route = createFileRoute('/dashboard/$listKey/$id')({ component: RouteComponent })
    function RouteComponent() { return <div>Hello "/dashboard/$listKey/$id"!</div> }
    ```
  - This is the largest parity break vs Next `app/dashboard/(admin)/[listKey]/[id]/page.tsx` -> `ItemPage`.

- **Create route exists and post-create navigation is wired**:
  - `src/routes/dashboard/$listKey.create.tsx` line 77 navigates to `/dashboard/$listKey/$id` with created id.

- **Table navigation mostly points to correct item route**:
  - first-cell link, actions View link, relationship links, row click all target `/dashboard/$listKey/$id` in `keystone-list-table.tsx` (lines 109, 135, 204, 256).

- **Potential broken listKey derivation in relationship editor**:
  - `relationship-field-editor.tsx` transforms ref list key using `relationshipPath()` (lines 23-29) and uses that for route params (lines 91, 96).
  - This can diverge from actual Keystone `list.path` (e.g., irregular/pluralization/custom path), causing navigation to notFound.

- **Create CTA behavior gaps**:
  - Empty state in `KeystoneListTable` has no create link/button (lines 55-60), unlike Next behavior where list/create actions are accessible contextually.
  - `filter-bar.tsx` create button checks only `!list.hideCreate` (line 130), not singleton state; may expose invalid create for singleton lists.

- **Button-as-link semantics**:
  - Base UI `Button` supports render/native polymorphism via `ButtonPrimitive.Props` (ui/button.tsx lines 44-55).
  - In route files that use old API style (`nativeButton={false}`, `render=...`) there is inconsistency risk depending on actual Base UI prop compatibility; current project compiles, but dashboard has mixed patterns: direct `<Link className={buttonVariants(...)}` and wrapped `<Button render={<Link .../>}>`.

## Architecture
- Dashboard is rooted at file route `src/routes/dashboard.tsx` with SSR-only `beforeLoad` auth gate.
- Child routes:
  - index: `/dashboard/`
  - list: `/dashboard/$listKey`
  - create: `/dashboard/$listKey/create`
  - item: `/dashboard/$listKey/$id`
- Listing flow: `$listKey.tsx` loader fetches list+items -> renders `FilterBar` and `KeystoneListTable`.
- Create flow: `$listKey.create.tsx` fetches adminMeta/list schema, submits GraphQL mutation, navigates to item route.
- Navigation touchpoints to audit/fix are distributed across:
  - dashboard index cards
  - list cards and filter bar create buttons
  - table row/first cell/action links
  - relationship editor links
  - breadcrumbs on create/item pages.

## Start Here
Open `src/routes/dashboard/$listKey.$id.tsx` first.
- It is the top missing parity page and the destination for nearly all dashboard deep links.
- Until this route is implemented, many “broken navigation” symptoms are downstream side effects.

## Exact Fix Checklist (static audit)
1. **Implement item route parity page**
   - Replace placeholder in `src/routes/dashboard/$listKey.$id.tsx` with full item screen equivalent to Next `ItemPage`.
   - Include loader/query wiring, field editors, save/delete actions, and breadcrumbs/actions parity.

2. **Harden relationship route params against list-path mismatch**
   - In `src/components/dashboard/relationship-field-editor.tsx`, stop deriving route param via `relationshipPath()` heuristic.
   - Use canonical list path from admin metadata (or a deterministic map key->path) before linking to `/dashboard/$listKey/create` and `/dashboard/$listKey/$id`.

3. **Normalize create-action visibility rules**
   - In `src/components/dashboard/filter-bar.tsx`, gate create CTA by `!list.hideCreate && !list.isSingleton` (or equivalent capability flag) to match Next semantics.

4. **Add create affordance in empty list state**
   - In `src/components/dashboard/keystone-list-table.tsx` empty state block (lines 55-60), add link/button to `/dashboard/$listKey/create` when create is allowed.

5. **Audit button-as-link usage for one consistent pattern**
   - Standardize either:
     - `Link` with `className={buttonVariants(...)}`, or
     - `Button` polymorphic render prop.
   - Remove mixed nesting patterns that can create invalid interactive nesting and click propagation inconsistencies.

6. **Breadcrumb parity on item page once implemented**
   - Ensure item page uses `PageBreadcrumbs` with:
     - Dashboard -> list -> current item label/id
     - right-side actions (save/delete) consistent with create page pattern.

7. **Keep route filename/path as-is unless generator bug reproduced**
   - Current `routeTree.gen.ts` confirms `$listKey.create.tsx` correctly resolves to `/dashboard/$listKey/create`.
   - No rename required now; only revisit if future route generation changes.

8. **Regression checks after fixes (static targets)**
   - Verify all `to="/dashboard/$listKey/$id"` links pass `{ listKey, id }` non-empty.
   - Verify all `to="/dashboard/$listKey/create"` links pass canonical `listKey` path.
   - Recheck `beforeLoad` redirect interplay for item/create pages while signed out/no-access.

## Supervisor coordination
No blocking decisions required for this static audit. No code changes were made.