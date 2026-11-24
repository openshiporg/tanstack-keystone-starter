# Seventh-loop parity audit (post-fixes): next single concrete gap

## Next fixable parity gap
**Gap:** `/dashboard/signup` is still missing the **public-signup gate** that exists in `next-keystone-starter`.

The target now handles signup auth union and UI parity, but behavior parity is still incomplete:
- **Reference:** signup page checks `PUBLIC_SIGNUPS_ALLOWED` and redirects to `/dashboard/signin` when disabled.
- **Target:** signup route is always accessible and always attempts `createUser`.

This is now the next concrete, isolated parity gap after the listed fixes.

---

## Exact files

### Reference
1. `../next-keystone-starter/features/dashboard/screens/SignUpPage/index.tsx` (entire file)
   - Contains:
   ```ts
   const publicSignUpsAllowed = process.env.PUBLIC_SIGNUPS_ALLOWED === 'true';
   if (!publicSignUpsAllowed) {
     redirect('/dashboard/signin');
   }
   ```

### Target
2. `src/routes/dashboard/signup.tsx` (route component + submit flow)
   - No env/config gate before rendering/submitting signup form.

3. `src/routes/dashboard.tsx` (optional consistency touchpoint)
   - Currently treats `/dashboard/signup` as public auth route unconditionally.

---

## Minimal implementation (no refactor required)

Change only `src/routes/dashboard/signup.tsx` (and optionally one small guard alignment in `src/routes/dashboard.tsx`):

1. Add a route-level gate in `SignUpRoute` (or route `beforeLoad`) that checks a public-signup flag (env-backed), matching reference semantics:
   - If disabled, navigate/redirect to `/dashboard/signin`.
2. Keep existing signup mutation/auth-union logic unchanged.
3. (Optional hardening) In `src/routes/dashboard.tsx`, keep `/dashboard/signup` public **only when** the same flag is enabled, otherwise treat it like signin redirect behavior.

No backend schema changes required for this parity step.

---

## Why this is the next best gap
- Single-route behavior mismatch that is directly visible and easy to verify.
- Small blast radius and low risk.
- Brings signup flow policy in line with Next reference without requiring auth subsystem redesign.