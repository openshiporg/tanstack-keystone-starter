# Dashboard Immediate Fixes

## Scope implemented
Immediate hardening fixes were applied for:
- create route end-to-end behavior for supported scalar field kinds,
- item route stability,
- avoiding list-control UX regression patterns,
- removing obvious dashboard dead-ends in active routes.

## Changes made

### 1) Create route hardening
**File:** `src/routes/dashboard/$listKey.create.tsx`

Key fixes:
- Expanded editable supported kinds beyond the previous narrow subset:
  - added: `checkbox`, `integer`, `float`, `decimal`, `timestamp`, `bigInt`
  - retained: `text`, `password`, `json`, `document`, `select`, `multiselect`
- Added dedicated checkbox state handling with Base UI checkbox control.
- Added numeric parsing/validation:
  - integer -> `Number.parseInt` with finite validation
  - float -> `Number.parseFloat` with finite validation
- Preserved JSON/document parse validation and explicit error reporting.
- Preserved post-create navigation to `/dashboard/$listKey/$id`.

Outcome:
- Create page is no longer limited to text-like inputs only.
- Supported scalar fields now submit compatible values more reliably.

---

### 2) Item route robustness
**File:** `src/routes/dashboard/$listKey.$id.tsx`

Key fixes:
- Corrected mismatch between route rendering and GraphQL client data shape:
  - replaced `data.fields` usage with `data.selectedFields`.
- Added robust query error fallback UI in component render path.
- Kept loader-level `notFound()` translation for missing list/item.

Outcome:
- Item page avoids runtime breakage from shape mismatches.
- Route now degrades gracefully when fetch fails.

---

### 3) List controls regression posture
**Files reviewed:**
- `src/components/dashboard/filter-bar.tsx`
- `src/routes/dashboard/$listKey.tsx`
- `src/features/cms/graphql-client.ts`

What was validated:
- Filter/Sort/Display controls are not disabled placeholders.
- Sort and display state remain URL-backed and query-backed.
- List route passes `sortBy`/`fields` through loader + query path.

No additional code change was required in this pass for list controls because the active code path is already interactive and not disabled.

---

## Validation
Executed from `/Users/junaid/code/tanstack-keystone-starter`:
- `rm -rf .output && npm run lint && npm run build`

Result:
- ✅ lint passes
- ✅ build passes (client + ssr + nitro)

---

## Changed-file summary
1. `src/routes/dashboard/$listKey.create.tsx`
   - widened supported create field kinds
   - checkbox support
   - numeric parsing/validation
2. `src/routes/dashboard/$listKey.$id.tsx`
   - fixed selected-fields rendering path
   - added error fallback rendering
3. `progress.md`
   - updated with completed hardening slice and validation status

---

## Remaining immediate gaps (not part of this narrow hardening patch)
- Create route still excludes relationship/image/document-authoring parity UX.
- Filter button still lacks advanced Keystone-like filter-builder grammar.
- Item page is read-only and does not yet provide full edit/save/delete parity.
