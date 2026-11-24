# Dashboard Init Flow Plan (fresh empty runtime)

## Summary
The init bypass happens because **TanStack memory adapter is pre-seeded with users/roles by default**, while the init gate (`redirectToInit`) is based on `User.count() === 0`. In a fresh process using memory mode, count is already > 0, so `/dashboard/init` is never required.

By contrast, `next-keystone-starter` middleware checks `redirectToInit` from GraphQL and relies on the real Keystone DB state (typically empty until seeded/migrated), so init appears when user count is truly zero.

---

## Compared behavior

### next-keystone-starter (middleware + init gate)
- File: `../next-keystone-starter/features/dashboard/middleware.ts`
- Middleware queries:
  - `redirectToInit`
  - `authenticatedItem { ... }`
- Route behavior:
  - if `redirectToInit === true`, redirect any dashboard route to `/dashboard/init`
  - if `redirectToInit === false`, block `/dashboard/init` and redirect to `/dashboard`

This is consistent with Keystone’s intended first-admin flow.

### tanstack-keystone-starter (dashboard route guard + runtime)
- Route guard: `src/routes/dashboard.tsx`
  - same core logic as above: if `redirectToInit`, force `/dashboard/init`.
- Auth-state query path:
  - `src/features/cms/dashboard-auth.ts` → GraphQL query for `redirectToInit` + `authenticatedItem`
- `redirectToInit` resolver:
  - `cms.config.ts` uses `context.sudo().query.User.count({}) === 0`
- Critical difference:
  - memory adapter bootstraps with seeded users:
    - `src/features/cms/adapters/memory.ts` defines `seedStore` with `User` entries (`ada@example.com`, `ed@example.com`) and initializes `store` from it.

So in memory mode, first-admin init is effectively pre-completed at startup.

---

## Why seeded memory users bypass init

1. `redirectToInit` computes from real data count (`User.count`).
2. Memory adapter default data includes users before any request.
3. Therefore `User.count !== 0` on first request.
4. Dashboard guard sees `redirectToInit === false` and routes to sign-in/dashboard, not init.

This is not a guard bug; it is a **data bootstrap mode mismatch**.

---

## Additional nuance (important)

Even though dashboard requests disable dev auth fallback (`x-cms-disable-dev-auth-fallback` set in both `dashboard-auth.ts` and `dashboard-server.ts`), that only affects implicit session injection. It does **not** change seeded memory data. So disabling fallback does not restore init behavior when users are preseeded.

---

## Proposed exact modes

Use explicit runtime modes so behavior is deterministic across memory/prisma and dev/fresh-db scenarios.

### 1) `CMS_BOOTSTRAP_MODE=seeded` (default for demos)
- Purpose: instant demo/dev experience.
- Memory adapter loads current `seedStore`.
- `redirectToInit` normally false.
- Sign-in defaults like `ada@example.com / password` remain valid.

### 2) `CMS_BOOTSTRAP_MODE=fresh` (first-admin testing / parity)
- Purpose: emulate truly empty DB/runtime.
- Memory adapter starts with empty store for all lists (or at least empty `User`/`Role`).
- `redirectToInit` true until `createInitialUser` succeeds.
- Enables deterministic testing of `/dashboard/init` flow without Prisma DB resets.

### 3) `CMS_BOOTSTRAP_MODE=prisma` (or inferred by `CMS_ADAPTER=prisma`)
- Purpose: real DB behavior.
- No in-memory seeding path.
- `redirectToInit` follows DB state:
  - fresh migrated DB with zero users -> true
  - seeded/migrated DB with users -> false

---

## Concrete implementation shape (no code changes here, just exact plan)

1. **Adapter selection stays** in `src/features/cms/adapters/index.ts` (`memory` vs `prisma`).
2. Add **bootstrap selector** for memory adapter initialization/reset:
   - seeded store (current `seedStore`)
   - fresh empty store
3. Keep `redirectToInit` logic unchanged (`User.count() === 0`) in `cms.config.ts`.
4. Add npm scripts/env presets:
   - `dev:seeded` -> `CMS_ADAPTER=memory CMS_BOOTSTRAP_MODE=seeded`
   - `dev:fresh` -> `CMS_ADAPTER=memory CMS_BOOTSTRAP_MODE=fresh`
   - `dev:prisma` -> `CMS_ADAPTER=prisma`
5. Update signin/init UI copy:
   - only show seeded credentials hint when bootstrap mode is seeded.

---

## Fresh-DB / CI scenarios to enforce

1. **Memory fresh mode**
   - first dashboard request redirects to `/dashboard/init`
   - `createInitialUser` succeeds once
   - subsequent `/dashboard/init` redirects to `/dashboard`

2. **Memory seeded mode**
   - `/dashboard/init` redirects to `/dashboard`
   - seeded sign-in works

3. **Prisma fresh DB**
   - after migrate, before seed: init required
   - after seed or first-admin creation: init not required

---

## Files and lines most relevant

- `src/routes/dashboard.tsx` — dashboard gating for init/signin/no-access.
- `src/features/cms/dashboard-auth.ts` — query path for `redirectToInit` + auth state; disables dev fallback header.
- `src/features/cms/dashboard-server.ts` — in-process dashboard GraphQL request setup; disables dev fallback header.
- `cms.config.ts` — `redirectToInit` resolver based on `User.count() === 0`; auth `initFirstItem` config.
- `src/features/cms/adapters/memory.ts` — seeded `User`/`Role` data causing init bypass.
- `../next-keystone-starter/features/dashboard/middleware.ts` — reference middleware behavior in next-keystone starter.

---

## Recommended decision

Adopt two memory sub-modes immediately (`seeded` and `fresh`) and keep existing `redirectToInit` semantics unchanged. This preserves developer convenience while making first-admin/init parity testable and predictable in a “fresh empty runtime.”