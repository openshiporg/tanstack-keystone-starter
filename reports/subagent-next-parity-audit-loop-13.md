# Thirteenth-loop parity audit (post-fixes): next single concrete gap

## Next fixable parity gap
**Gap:** Pagination page-size dropdown label still diverges from `next-keystone-starter`.

- **Reference** uses dropdown label text **`Page Size`**.
- **Target** still renders **`Rows per page`**.

This is a small but concrete UI parity mismatch that remains after the listed fixes.

---

## Evidence

1. **Reference**
   - `../next-keystone-starter/features/dashboard/components/Pagination.tsx` (around lines 327-336)
   - Shows:
     - `<DropdownMenuLabel ...>Page Size</DropdownMenuLabel>`

2. **Target**
   - `src/components/dashboard/pagination.tsx` (around lines 161-168)
   - Shows:
     - `<DropdownMenuLabel>Rows per page</DropdownMenuLabel>`

---

## Minimal implementation

### File to change
1. `src/components/dashboard/pagination.tsx`

### Exact change
In the page-size dropdown content, change:
- `Rows per page` → `Page Size`

No logic changes needed; text-only parity fix.

---

## Why this is the next best single fix
- Tiny blast radius (one string in one file).
- Deterministic parity with reference UI copy.
- Quick visual verification in pagination dropdown.