Implemented dashboard route parity slice for signup/reset with concrete code edits and lint validation.

## What I changed

1. Added new route: `src/routes/dashboard/signup.tsx`
- New `/dashboard/signup` page with Next-keystone-like auth card UI.
- Includes:
  - logo header
  - name/email/password inputs
  - password show/hide toggle
  - submit + sign-in link
- Uses existing GraphQL pathway (`executeDashboardGraphQL`) and attempts:
  - `mutation DashboardSignUp($data: UserCreateInput!) { createUser(data: $data) { id email } }`
- Includes explicit TODO noting this is scaffolding and needs full public-signup policy/action parity.

2. Added new route: `src/routes/dashboard/reset.tsx`
- New `/dashboard/reset` page with Next-keystone-like reset UI.
- Includes:
  - logo header
  - email input
  - submit button
  - success response copy that does not enumerate account existence
- Uses a temporary async stub and explicit TODO to wire Keystone-compatible reset-link mutation flow.

3. Updated guard/layout routing: `src/routes/dashboard.tsx`
- Added route recognition for:
  - `/dashboard/signup`
  - `/dashboard/reset`
- Guard behavior now treats `signin/signup/reset` as public auth routes:
  - unauthenticated users can access them
  - authenticated users visiting them are redirected back to dashboard (or valid `from`)
- Maintains existing init/no-access semantics.
- Added signup/reset to standalone auth route list so they render outside dashboard shell.

4. Upgraded sign-in page parity: `src/routes/dashboard/signin.tsx`
- Reworked UI to be closer to Next-keystone auth screen:
  - logo
  - “Sign in to your account”
  - signup link
  - password visibility toggle
  - reset link
- Kept existing `authenticateUserWithPassword` mutation flow.

## Validation
- Ran: `npm run lint`
- Result: pass ✅

## Notes / TODOs left explicit in code
- Signup flow currently uses direct `createUser` mutation fallback; needs full Keystone-style public signup gating/policy and dedicated auth action flow.
- Reset page is currently UI + non-enumerating stub; needs real reset-token issuance and redemption mutations wired into auth runtime.
