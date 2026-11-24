# Tenth-loop parity audit (post-fixes): next single concrete gap

## Next fixable parity gap
**Gap:** `/dashboard/no-access` behavior/content is still non-parity with `next-keystone-starter` Keystone no-access page.

After the listed fixes (right-sidebar side-aware state, `sortBy` `field`/`-field` URL contract, public signup gate, signin/reset/layout, pagination dropdown, signup auth union, destructive dialogs, filtered-empty reset), this is the next isolated parity mismatch.

---

## Evidence (reference vs target)

1. **Reference no-access page is Keystone-provided and minimal**
   - `../next-keystone-starter/.keystone/admin/pages/no-access.js` (lines 1-3)
   - It directly exports Keystone internal no-access page:
   ```js
   import { getNoAccessPage } from '@keystone-6/core/___internal-do-not-use-will-break-in-patch/admin-ui/pages/NoAccessPage';
   export default getNoAccessPage({"sessionsEnabled":true})
   ```

2. **Built output confirms reference UX semantics**
   - `../next-keystone-starter/.keystone/admin/.next/static/chunks/pages/no-access-4323d5c652a43f93.js` (single-line bundle; decoded segment)
   - Rendered text includes:
     - `"You don't have access to this page."`
     - Conditional auth action when sessions are enabled (`n ? <...> : null`) consistent with Keystone signout/session affordance.

3. **Target route is custom and diverges in actions/copy/layout**
   - `src/routes/dashboard/no-access.tsx` (lines 1-47)
   - Uses custom card with:
     - Heading `Access Denied`
     - Long explanatory paragraph
     - Actions: `Go Back` (`router.history.back()`) and `Home` (`router.navigate({ to: '/' })`)
   - No Keystone-like session/logout affordance.

---

## Minimal implementation to close parity gap

### File to change
1. `src/routes/dashboard/no-access.tsx`

### Concrete minimal change
Replace custom no-access screen with a Keystone-parity minimal screen:
- Primary message text should match Keystone semantics: **"You don't have access to this page."**
- Remove `Go Back` and `Home` actions.
- Show a **Sign out** action when sessions are enabled (this starter has sessions enabled).
  - Wire to existing dashboard signout mechanism if one exists (preferred).
  - If no shared helper exists, implement a local GraphQL signout call and redirect to `/dashboard/signin`.

This keeps scope very small (single route file) and aligns user-facing auth/access behavior with Keystone Admin.

---

## Why this is the next best single gap
- User-facing auth/access parity issue on a dedicated system page.
- Highly isolated (one file, low blast radius).
- Resolves behavior mismatch (navigation buttons vs auth/session action) rather than cosmetic-only styling drift.
