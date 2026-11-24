# Sixth-loop parity audit (post-fixes): next single concrete gap

## Next fixable parity gap
**Gap:** `Pagination` page-size controls are still simplified in target vs `next-keystone-starter`.

After the noted fixes (reset layout parity, signup auth union handling, no-access, destructive dialogs, filtered-empty reset), the next concrete UI/behavior gap is:

- **Reference (Next):** page-size uses a dropdown menu with preset options **plus inline +/- steppers and direct numeric input**, and keeps pagination state handling integrated in that control.
- **Target (TanStack):** page-size is currently a plain `<select>` with fixed options only.

This is a small, isolated, implementation-ready parity delta.

---

## Exact files

### Reference
- `../next-keystone-starter/features/dashboard/components/Pagination.tsx`
  - Page-size menu uses `DropdownMenu`, preset sizes `[5,10,25,50,100]`, plus custom controls (`Minus`, `Input`, `Plus`) to decrement/increment/enter size.

### Target
- `src/components/dashboard/pagination.tsx`
  - Current page-size UI is:
    ```tsx
    <select value={pageSize} onChange={...} ...>
      {[10, 25, 50, 100].map(...)}
    </select>
    ```

---

## Minimal implementation (no refactor required)

Change only `src/components/dashboard/pagination.tsx`:

1. Replace the `<select>` page-size control with the same pattern already present in Next:
   - `DropdownMenu` trigger showing current `pageSize` + "per page"
   - menu items for preset sizes (include 5)
   - bottom row with:
     - decrement button (`pageSize - 5`, min 1)
     - numeric `Input` for direct entry
     - increment button (`pageSize + 5`)
2. Reuse existing `handlePageSizeChange(newSize)` so URL/search behavior remains unchanged (`pageSize`, `page: 1`).
3. Add small icon imports used by the menu controls (`ChevronDown`, `Plus`, `Minus`) and dropdown primitives.

No API changes, no route changes, and no backend changes needed.

---

## Why this is the next best gap
- It is **single-file**, **low risk**, and directly measurable against the reference component.
- It improves parity in a user-visible control that remains materially different after the prior loop’s fixes.
- It does not depend on unresolved auth/field-architecture work.