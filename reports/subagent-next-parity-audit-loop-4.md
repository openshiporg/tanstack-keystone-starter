# Fourth-loop parity audit (post-fixes): next single concrete gap

## Finding
After the noted fixes (signup, route error boundary, alert-dialog destructive flows, and filtered-empty reset hard reset), the next concrete parity gap is:

**`/dashboard/no-access` action parity mismatch**.

- **Reference (next-keystone)** shows two recovery actions: **Go Back** and **Home**.
- **Target (tanstack)** only shows a single action: **Sign in with another account**.

This is user-visible and narrowly fixable in one file.

## Exact file evidence

1. **Target (needs parity update)**  
   `src/routes/dashboard/no-access.tsx` (lines 1-31)
   - Renders card with only one CTA link:
   - `Link to="/dashboard/signin"` with label “Sign in with another account”

2. **Reference behavior**  
   `../next-keystone-starter/features/dashboard/screens/NoAccessPage/index.tsx` (lines 1-53)
   - Renders two buttons:
   - `router.back()` labeled “Go Back”
   - `router.push('/')` labeled “Home”

## Minimal implementation

Update only:
- `src/routes/dashboard/no-access.tsx`

Minimal change set:
1. Add `useNavigate` (and/or browser history back handling) to support a **Go Back** button.
2. Replace single sign-in CTA with two CTAs matching reference intent:
   - **Go Back** → navigate to prior page (history back fallback to `/dashboard` if no history)
   - **Home** → navigate to `/`
3. Keep existing card shell/style unless needed; parity target here is action behavior/availability.

## Why this is the next best gap
- It is isolated (single route file).
- No backend/schema risk.
- Directly user-visible parity regression in an auth edge flow.
- Can be completed quickly without touching broader dashboard architecture.
