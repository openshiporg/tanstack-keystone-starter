# Code Context

## Files Retrieved
1. `src/routes/dashboard/$listKey.create.tsx` (lines 1-109) - target create route; shows current create page actions only include the primary Create button.
2. `src/components/dashboard/page-container.tsx` (lines 1-52) - target page header wrapper already has right-side trigger parity, so not the next gap.
3. `src/components/dashboard/filter-bar.tsx` (lines 1-280) - target list toolbar already includes sort, field selection, and create affordance.
4. `src/features/cms/graphql-client.ts` (lines 297-379) - target already applies `initialSort` fallback when no explicit `sortBy` is present.
5. `../next-keystone-starter/features/dashboard/screens/CreatePage/CreatePageClient.tsx` (lines 1-176) - source create page includes a cancel flow and defines `handleCancel`, matching item-page action patterns.
6. `../next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx` (lines 360-479) - source item page shows the shared header action pattern with multiple controls, establishing expected action-bar behavior.

## Key Code
Target create route currently renders only a primary action in the breadcrumb/header bar:

```tsx
// src/routes/dashboard/$listKey.create.tsx
<PageBreadcrumbs
  items={[
    { type: 'link', label: 'Dashboard', href: '/dashboard' },
    { type: 'model', label: list.label, href: `/dashboard/${list.path}` },
    { type: 'page', label: 'Create' },
  ]}
  actions={
    <Button size="sm" className="text-xs sm:text-sm" onClick={onCreate} disabled={saving}>
      Create {list.singular}
      <Check className="ml-1 stroke-[1.5px]" width="8" height="8" />
    </Button>
  }
/>
```

Source create page has explicit cancel navigation support:

```tsx
// ../next-keystone-starter/features/dashboard/screens/CreatePage/CreatePageClient.tsx
const handleCancel = useCallback(() => {
  router.push(`${basePath}/${list.path}`)
}, [router, basePath, list])
```

It also defines a dedicated cancel button component for the create header flow:

```tsx
function CancelButton({ onCancel, isDesktop = true }: { onCancel: () => void; isDesktop?: boolean }) {
  return (
    <Button variant="outline" size="sm" className="text-xs" onClick={onCancel}>
      <X className="size-3 shrink-0" />
      {isDesktop ? 'Cancel' : <span className="hidden sm:inline">Cancel</span>}
    </Button>
  )
}
```

## Architecture
- Target create-page flow is implemented entirely in `src/routes/dashboard/$listKey.create.tsx`.
- Header actions are passed through `PageBreadcrumbs`, so create-page action parity is a route-level concern, not a shared layout concern.
- Navigation is already available through `const navigate = Route.useNavigate()`, so adding cancel behavior is low-risk and localized.
- Since list-page, header-right trigger, empty-state filtering, and initial sort fallback are already present in target, this is the next smallest missing parity behavior still visible in the source implementation.

## Start Here
Open `src/routes/dashboard/$listKey.create.tsx` first. It contains the full target create-page action bar and can be fixed without touching shared infrastructure.

## Single Next Parity Gap
**Gap:** The target create page lacks the secondary **Cancel** action that exists in the source create experience.

This is a concrete, fixable parity gap because:
- source create flow defines `handleCancel` and a cancel button,
- target create flow currently offers only submit/create,
- the fix is isolated to one route file.

## Minimal Implementation
In `src/routes/dashboard/$listKey.create.tsx`:
1. import an `X` icon (or similar) alongside `Check`.
2. wrap header actions in a small flex container.
3. add a secondary outline button before the Create button.
4. wire it to navigate back to the list route:

```tsx
<Button
  variant="outline"
  size="sm"
  className="text-xs sm:text-sm"
  onClick={() => void navigate({ to: '/dashboard/$listKey', params: { listKey: list.path } })}
  disabled={saving}
>
  <X className="size-3.5" />
  Cancel
</Button>
```

No other files should be required.

## Risks / Notes
- Keep this scoped to the create route; shared breadcrumb or page container changes are unnecessary.
- Match existing target button sizing/classes to avoid introducing style drift.
- This is distinct from the already-fixed filtered-empty-state issue and should not repeat loop-35’s report.
