# Twelfth-loop parity audit (post-fixes): next single concrete gap

## Next fixable parity gap
**Gap:** `/dashboard/signup` still diverges from `next-keystone-starter` auth form contract: it does **not** use explicit action-state formData echo (submitted values preserved via returned state), while reference does.

This is now the next concrete parity gap after the listed fixes (signin/reset action-state echo, FilterBar SortSelection/FieldSelection, Keystone-like no-access signout, side-aware right sidebar, sortBy contract, public signup gate, pagination dropdown, destructive dialogs, filtered-empty reset).

---

## Evidence (reference vs target)

1. **Reference signup uses action-state and echoes submitted form data**
   - `../next-keystone-starter/features/dashboard/screens/SignUpPage/SignUpForm.tsx` (lines 16-27, 30-41, 64-88, 95-101)
   - Uses `useActionState(signUp, initialState)` and renders:
     - `defaultValue={state.formData.email}`
     - `defaultValue={state.formData.password}`
   - This preserves attempted values after failed submit through server action state.

2. **Target signup remains local-state + direct GraphQL submit**
   - `src/routes/dashboard/signup.tsx` (lines 33-41, 43-76, 99-126)
   - Uses `useState` for `email/password`, imperative submit, and `error` string only.
   - No explicit `{ message, formData }` action-state payload contract matching reference semantics.

3. **Scope check:** public signup gate itself is already parity-aligned
   - `src/routes/dashboard.tsx` (lines 6-7, 24-29)
   - `src/routes/dashboard/signup.tsx` (lines 12-20)
   - Gate behavior exists; remaining mismatch is the form interaction contract.

---

## Minimal implementation to close parity gap

### Files to change
1. `src/routes/dashboard/signup.tsx`
2. (optional shared helper) `src/features/cms/dashboard-auth.forms.ts`

### Concrete minimal change
1. Introduce a signup form-state type aligned to reference pattern:
   - `type FormState = { message: string | null; formData: { email: string; password: string } }`
2. Route submit path should always return/update that state with submitted `formData` on failure.
3. Render signup inputs from state-backed defaults/values sourced from `formData` echo.
4. Keep existing GraphQL mutations and redirect behavior; only normalize submission state contract.

---

## Why this is the next best single gap
- Very small blast radius (single route file).
- Same parity class as signin/reset contract, now remaining specifically on signup.
- Easy verification: submit invalid/duplicate signup and confirm values persist exactly via action-state contract behavior.