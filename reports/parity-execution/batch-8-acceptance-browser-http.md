# Batch 8 acceptance/browser/http parity

Date: 2026-05-20

## What changed

This batch focused on the highest-value acceptance gaps still called out by the parity dissertation, without attempting a broad UI rewrite.

### 1) Added reusable dashboard route-guard parity logic
New file:
- `src/features/cms/dashboard-route-guards.ts`

This extracts the dashboard redirect matrix into a pure function:
- anonymous protected route → `/dashboard/signin?from=...`
- first-item mode → `/dashboard/init`
- authenticated user on public auth routes → redirect back to dashboard target
- authenticated user without dashboard access → `/dashboard/no-access`
- signup disabled → `/dashboard/signin`

`src/routes/dashboard.tsx` now uses this shared logic, which makes the dashboard gate behavior both easier to test and less likely to drift.

### 2) Added repo-owned HTTP acceptance validation for dashboard auth/completion flows
New file:
- `scripts/validate-dashboard-http.ts`

This script exercises real route handlers rather than only in-process helper calls. It validates:
- `/api/graphql` auth mutation returns HTTP 200
- auth over HTTP writes a session cookie
- that cookie hydrates dashboard auth state on a real `Request`
- `/api/completion` rejects anonymous requests with HTTP 403
- `/api/completion` succeeds for authenticated requests and returns user-aware output
- dashboard redirect decisions match the intended route-guard matrix

This is the strongest practical HTTP acceptance layer that could be added in one batch without building a full browser harness.

### 3) Added a small repo-owned test suite for route-guard regression locking
New file:
- `tests/dashboard-route-guards.test.ts`

Updated:
- `vite.config.ts`

This adds a lightweight Vitest layer that locks down the dashboard redirect matrix directly. It covers:
- standalone auth path detection
- anonymous redirect-to-signin behavior
- signup-disabled redirect behavior
- authenticated-user redirect away from signin/signup/reset
- first-item redirect behavior
- no-access redirect behavior

### 4) Added a dedicated dashboard HTTP test command
Updated:
- `package.json`

New script:
- `npm run test:dashboard:http`

This keeps the new acceptance coverage runnable as a first-class repo-owned command.

## Exact files changed

- `src/features/cms/dashboard-route-guards.ts` **new**
- `src/routes/dashboard.tsx`
- `scripts/validate-dashboard-http.ts` **new**
- `tests/dashboard-route-guards.test.ts` **new**
- `vite.config.ts`
- `package.json`

## Validations run and results

### Required validations
- `npm run lint` ✅ passed
- `npm run build` ✅ passed

### Batch-8 targeted validations
- `npm run test:dashboard:http` ✅ passed
  - output: `Dashboard HTTP acceptance validation passed.`
- `npm run test:dashboard:ai` ✅ passed
  - output: `Dashboard completion validation passed.`
- `npm test` ✅ passed
  - `1` test file, `6` tests passed
  - note: Vitest still prints a Vite/react module-runner warning (`ReferenceError: module is not defined`) plus a close-timeout warning, but the run exits with status `0` and all tests pass

## What acceptance gaps still remain

This batch improved acceptance coverage materially, but it does **not** mean full browser/dashboard parity is closed.

### Closed or improved in this batch
- dashboard redirect matrix is now explicitly encoded and regression-tested
- dashboard auth/completion HTTP transport behavior is now exercised through real route handlers
- repo-owned `npm test` coverage now exists instead of having no local spec corpus at all

### Still open
1. **No full browser automation suite yet**
   - no Playwright-style route/UI regression coverage for:
     - signin/signup/reset/init screens in a browser
     - list page filter/sort/search UX
     - create page form interactions
     - item page save/delete/reset interactions
     - console-error-free route smoke across primary dashboard pages

2. **No end-to-end browser proof for list/controller parity**
   - the route guards and HTTP layer are now better covered, but the dissertation’s remaining list/controller differences are still mostly validated by code-path reasoning, not browser automation.

3. **No HTTP acceptance suite yet for every dashboard mutation flow**
   - auth and completion now have route-level checks
   - create/update/delete item flows are still primarily covered by the existing CMS runtime validation scripts rather than dedicated dashboard HTTP acceptance scripts

4. **Vitest runtime harness still has environment noise**
   - tests pass, but the repo still emits a Vite/react module-runner warning and hanging-process close-timeout message during `npm test`
   - this does not currently fail CI-style execution, but it is still a harness-quality gap

## Practical outcome

Batch 8 did the most pragmatic acceptance hardening available in one slice:
- it converted the dashboard redirect contract into a testable unit,
- added route-level HTTP acceptance checks for dashboard auth/session/completion behavior,
- and established a minimal repo-owned test suite.

The biggest remaining acceptance gap is still true browser automation for dashboard CRUD and list UX, but the repo now has materially stronger evidence for dashboard HTTP and auth-routing parity than it had before this batch.
