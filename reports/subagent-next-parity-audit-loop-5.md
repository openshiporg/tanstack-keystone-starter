# Fifth-loop parity audit (post-fixes): next single concrete gap

## Finding
After validating the previously-called-out areas (signup, error boundary, destructive dialogs, filtered-empty reset, no-access actions), the **next concrete parity gap** is in the **signup submission contract**:

**TanStack signup does not handle the authentication result union and can redirect to `/dashboard` even when post-signup sign-in fails.**

This is a user-visible behavior mismatch vs `next-keystone-starter` where signup is routed through a single server action contract that returns structured error state instead of optimistic redirect.

## Exact file evidence

1. **Target (gap location)**  
   `src/routes/dashboard/signup.tsx` (lines 27-51)
   - Runs `createUser` mutation, then runs `authenticateUserWithPassword` mutation.
   - The auth mutation response is not typed/checked for success vs failure.
   - Code always executes `await navigate({ to: '/dashboard' })` after the second mutation call if no transport exception is thrown.

2. **Reference flow shape**  
   `../next-keystone-starter/features/dashboard/screens/SignUpPage/SignUpForm.tsx` (lines 1-133)
   - Uses `useActionState(signUp, initialState)` and renders returned `state.message` + preserved `state.formData`.
   - Redirect is controlled by action outcome, not unconditional client navigate.

## Why this is the next best gap
- `no-access` action parity appears already fixed and now matches reference CTA set/behavior.
- This signup issue is isolated to one route file and is directly fixable without schema changes.
- It affects correctness (possible false-success redirect), not just styling.

## Minimal implementation (no broad refactor)

Update only:
- `src/routes/dashboard/signup.tsx`

Minimal changes:
1. Add a typed result for the auth mutation union:
   - success branch with `sessionToken`/`item`
   - failure branch with `message`
2. Store the auth mutation response and gate navigation:
   - navigate to `/dashboard` **only** when success branch is returned.
   - otherwise surface failure `message` in existing `error` state and keep user on signup form.
3. Keep existing UI and `Badge` error rendering; just wire it to union failure messages.

This yields immediate behavioral parity improvement with minimal code churn.