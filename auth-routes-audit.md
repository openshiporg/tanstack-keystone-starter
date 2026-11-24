# Dashboard auth routes hostile audit

Scope: dashboard-only audit of local TanStack routes against upstream Next `features/dashboard/screens` and `features/dashboard/actions/auth.ts`.

## Verdict
Local routes are visually close, but they are **not behaviorally equivalent** to upstream. The biggest regressions are:
- local `signin`, `signup`, and `init` bypass upstream server actions/cookie handling and reimplement auth in the browser,
- local `signup` and `init` assume GraphQL auth side effects that upstream explicitly implements itself,
- local `reset` changes success/failure semantics and prefill behavior,
- local `signin` fixes an upstream open-redirect bug, but otherwise diverges from the upstream action contract.

---

## 1) `signin`: local route skips upstream server action and its cookie write path

### Local
- `src/routes/dashboard/signin.tsx:37-68` performs the auth mutation directly inside `useActionState`, calling `executeDashboardGraphQL(...)` in the client.
- `src/routes/dashboard/signin.tsx:58-61` treats GraphQL success as enough, then does `window.location.assign(safeDashboardRedirectPath(search.from))`.
- `src/routes/dashboard/signin.tsx:11` imports `safeDashboardRedirectPath`, and `:60` uses it.

### Upstream
- `features/dashboard/screens/SignInPage/SignInForm.tsx:53-60` wires the form to the shared server action `signIn`.
- `features/dashboard/actions/auth.ts:21-90` executes auth on the server, writes the `keystonejs-session` cookie at `:70-78`, and redirects at `:89`.
- `features/dashboard/actions/auth.ts:24` reads `from` from the form, but `:86-89` contains only a comment about validation and then blindly `redirect(from)`.

### Difference
- **Local replaced upstream’s server-side sign-in contract with a client-side GraphQL mutation.** Upstream’s actual login behavior depends on `cookies().set(...)` in `features/dashboard/actions/auth.ts:70-78`; local `src/routes/dashboard/signin.tsx:42-57` never sets a cookie itself.
- That means parity depends on `executeDashboardGraphQL` somehow causing browser cookie state to change as a side effect. The route code shown here does not prove that. Upstream’s behavior is explicit; local’s is implicit and therefore brittle.
- Local also changed redirect mechanics from upstream `redirect(from)` (`features/dashboard/actions/auth.ts:89`) to `window.location.assign(...)` (`src/routes/dashboard/signin.tsx:60`). That is a full browser navigation rather than the upstream server redirect path.
- **One improvement:** local sanitizes the return target with `safeDashboardRedirectPath(...)` (`src/routes/dashboard/signin.tsx:11,60`), while upstream leaves an open redirect hole by accepting raw `from` and `redirect(from)` after a TODO comment (`features/dashboard/actions/auth.ts:24,86-89`).

### Risk
- If `executeDashboardGraphQL` does not persist the Keystone session cookie in exactly the same way as upstream server actions, local sign-in can report success and redirect without creating a durable authenticated session.

---

## 2) `signup`: local route duplicates auth flow in-browser and drops upstream server-action semantics

### Local
- `src/routes/dashboard/signup.tsx:17-22` guards the page with a TanStack `beforeLoad` redirect.
- `src/routes/dashboard/signup.tsx:42-73` performs signup logic inline in the route action state.
- `src/routes/dashboard/signup.tsx:47-52` runs `createUser` directly.
- `src/routes/dashboard/signup.tsx:54-65` then runs a second direct `authenticateUserWithPassword` mutation and navigates to `/dashboard`.
- `src/routes/dashboard/signup.tsx:13-15` allows either `process.env.PUBLIC_SIGNUPS_ALLOWED` or `import.meta.env.PUBLIC_SIGNUPS_ALLOWED`.

### Upstream
- `features/dashboard/screens/SignUpPage/index.tsx:4-11` checks only `process.env.PUBLIC_SIGNUPS_ALLOWED === 'true'` and redirects server-side if false.
- `features/dashboard/screens/SignUpPage/SignUpForm.tsx:51-53,74-125` delegates submission to the shared `signUp` server action.
- `features/dashboard/actions/auth.ts:92-129` defines `signUp`, which creates the user at `:98-116` and then calls `signIn(...)` at `:118-119`.
- Upstream `signIn(...)` then performs the real cookie write and redirect at `features/dashboard/actions/auth.ts:70-89`.

### Difference
- **Local bypasses the shared upstream auth action stack entirely.** Upstream signup behavior is not just `createUser`; it is `createUser -> signIn server action -> cookie write -> redirect` (`features/dashboard/actions/auth.ts:92-129`, especially `:118-119` and `:70-89`).
- Local instead assumes that calling `authenticateUserWithPassword` from the browser is enough (`src/routes/dashboard/signup.tsx:54-65`). Again, no explicit cookie write path is visible in the route.
- Local uses `Route.useNavigate()` and `await navigate({ to: '/dashboard' })` (`src/routes/dashboard/signup.tsx:40,65`) instead of upstream’s server redirect via `signIn` (`features/dashboard/actions/auth.ts:118-119` -> `:89`).
- Env handling differs: local accepts `import.meta.env.PUBLIC_SIGNUPS_ALLOWED` in addition to `process.env` (`src/routes/dashboard/signup.tsx:13-15`), while upstream only checks `process.env` (`features/dashboard/screens/SignUpPage/index.tsx:5-8`). That is a deliberate platform adaptation, but it is still a behavioral difference.

### Risk
- Same session persistence risk as sign-in, plus local signup is now coupled to route code rather than the shared auth action API that upstream screens use.

---

## 3) `reset`: local route changes semantics for both request and redeem flows

### Local
- `src/routes/dashboard/reset.tsx:13-18` parses both `token` and `email` from search.
- `src/routes/dashboard/reset.tsx:71` seeds initial form state with `email: search.email`.
- Redeem branch: `src/routes/dashboard/reset.tsx:39-53` calls `redeemUserPasswordResetToken(...)`, and **any returned `message` is treated as an error** at `:51`.
- Request branch: `src/routes/dashboard/reset.tsx:55-63` ignores the returned boolean and always reports success if the mutation call itself does not throw.
- Local request success text is: `If an account exists for this email, a reset link has been sent.` at `:63`.

### Upstream
- `features/dashboard/screens/ResetPage/index.tsx:9-15` only parses `token`; no email prefill support.
- `features/dashboard/screens/ResetPage/ResetForm.tsx:76-81` initializes state with empty email/password only.
- `features/dashboard/screens/ResetPage/ResetForm.tsx:56-73` appends the token into `FormData` and delegates to `resetPassword(...)`.
- `features/dashboard/actions/auth.ts:206-289` defines the actual semantics:
  - redeem mode treats a returned `code` as failure, not merely a `message` (`:236-241`);
  - request mode checks `sendUserPasswordResetLink === true` before declaring success (`:271-280`);
  - request success text is `Password reset link has been sent to your email.` (`:271-275`).

### Difference
- **Local redeem logic is wrong relative to upstream action semantics.** Upstream expects a result object with both `code` and `message`, and only treats presence of `code` as failure (`features/dashboard/actions/auth.ts:236-241`). Local throws on any `message` (`src/routes/dashboard/reset.tsx:51`). If Keystone returns a non-error informational message alongside success, local will falsely fail.
- **Local request logic is also looser than upstream.** Upstream checks the boolean response and emits an error if it is not `true` (`features/dashboard/actions/auth.ts:261-280`); local ignores the mutation result payload entirely (`src/routes/dashboard/reset.tsx:55-63`) and returns success so long as the request did not throw.
- Local adds email prefill from query string (`src/routes/dashboard/reset.tsx:14-17,71`); upstream has no such behavior (`features/dashboard/screens/ResetPage/index.tsx:9-15`, `features/dashboard/screens/ResetPage/ResetForm.tsx:29-36`).
- Success copy differs between implementations: local uses account-enumeration-safe language (`src/routes/dashboard/reset.tsx:63`), upstream uses blunt “has been sent” language (`features/dashboard/actions/auth.ts:273-274`).
- UI implementation differs slightly too: local success badge uses plain `Badge` classes (`src/routes/dashboard/reset.tsx:113-119`), upstream uses `Badge color="emerald"` (`features/dashboard/screens/ResetPage/ResetForm.tsx:148-154`). Minor, but not identical.

### Risk
- Local can report reset-link success when upstream would report failure.
- Local can report redeem failure in cases upstream would consider success.

---

## 4) `init`: local assumes `createInitialUser` authenticates by itself; upstream explicitly chains sign-in

### Local
- `src/routes/dashboard/init.tsx:34-61` performs `createInitialUser` inline with `executeDashboardGraphQL`.
- `src/routes/dashboard/init.tsx:40-53` expects `createInitialUser` to return `sessionToken` and `item`.
- `src/routes/dashboard/init.tsx:54` immediately redirects to `/dashboard` after the mutation.

### Upstream
- `features/dashboard/screens/InitPage/index.tsx:54-90` delegates to `createInitialUser(...)`, then explicitly calls `signIn(...)` on success at `:69-79`.
- `features/dashboard/actions/auth.ts:164-204` defines `createInitialUser`, which requests only `item { id }` from `createInitialUser` (`:170-179`) and returns data without writing cookies.
- Upstream relies on `signIn(...)` to establish session state after init (`features/dashboard/screens/InitPage/index.tsx:69-79` + `features/dashboard/actions/auth.ts:21-90`).

### Difference
- **This is a major contract mismatch.** Upstream treats `createInitialUser` as insufficient for login and compensates by explicitly calling `signIn(...)` after success (`features/dashboard/screens/InitPage/index.tsx:69-79`).
- Local does the opposite: it assumes `createInitialUser` itself returns `sessionToken` and therefore is enough to redirect immediately (`src/routes/dashboard/init.tsx:22-30,40-55`).
- That is not even the same GraphQL shape upstream uses. Upstream action asks only for `item { id }` on `createInitialUser` (`features/dashboard/actions/auth.ts:170-179`), not `sessionToken`.
- If the backend matches upstream expectations rather than local assumptions, local init will break outright or redirect without a valid authenticated session.

### Risk
- High. This is the clearest functional divergence in the set.

---

## 5) `no-access`: mostly equivalent, only navigation implementation differs

### Local
- `src/routes/dashboard/no-access.tsx:10-42` renders the page.
- `src/routes/dashboard/no-access.tsx:30` uses `window.history.back()`.
- `src/routes/dashboard/no-access.tsx:34` uses TanStack `navigate({ to: '/' })`.

### Upstream
- `features/dashboard/screens/NoAccessPage/index.tsx:7-49` renders the same layout/content.
- `features/dashboard/screens/NoAccessPage/index.tsx:30` uses `router.back()`.
- `features/dashboard/screens/NoAccessPage/index.tsx:38` uses `router.push('/')`.

### Difference
- Only framework-navigation substitutions: browser history/TanStack navigate vs Next router.
- Content and layout are effectively identical aside from formatting and apostrophe escaping (`src/routes/dashboard/no-access.tsx:25` vs `features/dashboard/screens/NoAccessPage/index.tsx:22`).

### Risk
- Low.

---

## 6) Shared pattern mismatch: upstream screens are thin wrappers over auth actions; local routes are not

### Upstream architecture
- `SignInForm` -> `signIn` server action (`features/dashboard/screens/SignInPage/SignInForm.tsx:53-60`, `features/dashboard/actions/auth.ts:21-90`)
- `SignUpForm` -> `signUp` server action -> `signIn` (`features/dashboard/screens/SignUpPage/SignUpForm.tsx:51-53`, `features/dashboard/actions/auth.ts:92-129`)
- `ResetForm` -> `resetPassword` server action (`features/dashboard/screens/ResetPage/ResetForm.tsx:56-81`, `features/dashboard/actions/auth.ts:206-289`)
- `InitPage` -> `createInitialUser` then `signIn` (`features/dashboard/screens/InitPage/index.tsx:54-90`, `features/dashboard/actions/auth.ts:164-204`, `:21-90`)

### Local architecture
- Each route embeds its own GraphQL mutation logic directly in the route component:
  - `src/routes/dashboard/signin.tsx:37-68`
  - `src/routes/dashboard/signup.tsx:42-73`
  - `src/routes/dashboard/reset.tsx:34-71`
  - `src/routes/dashboard/init.tsx:34-61`

### Difference
- Local is **not** a route-port of upstream; it is a partial reimplementation. That means every future upstream auth bugfix or behavior change must be rediscovered route-by-route.
- The most dangerous consequence is session handling: upstream centralizes cookie writes in `features/dashboard/actions/auth.ts:70-78`; local route code shown here never performs the equivalent explicitly.

---

## Priority-ranked concrete deltas

1. **`init` is functionally mismatched**: local assumes `createInitialUser` returns/establishes session (`src/routes/dashboard/init.tsx:22-30,40-55`), upstream explicitly signs in afterward because `createInitialUser` alone is not enough (`features/dashboard/screens/InitPage/index.tsx:69-79`, `features/dashboard/actions/auth.ts:170-179`).
2. **`signup` is behaviorally mismatched**: local duplicates auth in browser (`src/routes/dashboard/signup.tsx:47-65`) instead of using upstream `signUp -> signIn -> cookie set -> redirect` (`features/dashboard/actions/auth.ts:92-129`, `:70-89`).
3. **`signin` is structurally mismatched**: local client mutation + browser redirect (`src/routes/dashboard/signin.tsx:42-61`) vs upstream server action + cookie write + redirect (`features/dashboard/actions/auth.ts:45-89`).
4. **`reset` changes correctness semantics** in both branches (`src/routes/dashboard/reset.tsx:39-63`) vs upstream action logic (`features/dashboard/actions/auth.ts:226-280`).
5. **`no-access` is basically fine**; only router implementation differs.

---

## Minimal file set to inspect/fix first
- Local:
  - `src/routes/dashboard/init.tsx`
  - `src/routes/dashboard/signup.tsx`
  - `src/routes/dashboard/signin.tsx`
  - `src/routes/dashboard/reset.tsx`
- Upstream reference:
  - `features/dashboard/actions/auth.ts`
  - `features/dashboard/screens/InitPage/index.tsx`
  - `features/dashboard/screens/ResetPage/ResetForm.tsx`

These are the files where the behavioral contract actually diverges, not just the JSX skin.
