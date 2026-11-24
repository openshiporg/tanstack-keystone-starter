# Eleventh-loop parity audit (post-fixes): next single concrete gap

## Next fixable parity gap
**Gap:** Sign-in/reset form submission UX still diverges from `next-keystone-starter` in one concrete way: **failed submissions do not preserve submitted form values via action-state contract** (reference keeps attempted values through server-action state; target uses controlled client state and clears/changes semantics differently across navigations).

This remains a concrete parity mismatch after the listed fixes (no-access signout, side-aware right sidebar, sortBy contract, public signup gate, signin/reset/layout baseline, pagination dropdown, signup auth union, destructive dialogs, filtered-empty reset).

---

## Evidence (reference vs target)

1. **Reference SignIn/Reset forms use action-state with formData echo**
   - `../next-keystone-starter/features/dashboard/screens/SignInPage/SignInForm.tsx` (lines 13-24, 44-63, 69-90)
   - `../next-keystone-starter/features/dashboard/screens/ResetPage/ResetForm.tsx` (lines 17-31, 46-63, 74-113)
   - Both forms render inputs with `defaultValue={state.formData.email/password}` so failed submissions re-render with submitted values from action result.

2. **Target signin/reset do not follow that action-state contract**
   - `src/routes/dashboard/signin.tsx` (lines 30-67, 88-116)
   - `src/routes/dashboard/reset.tsx` (lines 20-58, 82-127)
   - They use local `useState` and direct GraphQL calls. Errors are shown, but there is no shared action-state payload contract (`{ message/success, formData }`) matching reference behavior.

3. **Why this matters for parity**
   - Reference behavior is stable across server action round-trips and is the baseline interaction contract for auth forms in that starter.
   - Target currently achieves similar visuals, but interaction semantics differ (especially around how submitted values are sourced/restored after failed submit and route-driven resets).

---

## Minimal implementation to close parity gap

### Files to change
1. `src/routes/dashboard/signin.tsx`
2. `src/routes/dashboard/reset.tsx`
3. (optional helper extraction) `src/features/cms/dashboard-auth.forms.ts` (new)

### Concrete minimal change
1. **Adopt an explicit action-state shape in both routes**:
   - `type FormState = { message: string | null; success?: string | null; formData: { email: string; password: string } }`
2. **On submit failure/success, always write back submitted values into `formData`** and render inputs from that state (reference parity behavior).
3. Keep existing GraphQL mutations and route structure; only normalize state contract and input value sourcing so both forms match reference UX semantics.

This is a small, isolated auth-UX parity patch (no schema/runtime refactor).

---

## Why this is the next best single gap
- Limited blast radius (2 route files).
- Directly within the scoped auth parity area.
- Behavioral parity improvement (not just styling), and easy to verify with invalid credentials / invalid reset token flows.
