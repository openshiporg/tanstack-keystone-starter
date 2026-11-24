# Seed / Init / Fresh Mode Audit

Repository audited: `/Users/junaid/code/tanstack-keystone-starter`

Scope: seed/init runtime behavior for memory + Prisma paths, dashboard init redirects, createInitialUser, and credentials.

---

## Evidence inspected

- `package.json`
- `.env.example`
- `prisma/seed.ts`
- `prisma/schema.prisma`
- `cms.config.ts`
- `src/features/cms/adapters/index.ts`
- `src/features/cms/adapters/memory.ts`
- `src/features/cms/auth/graphql.ts`
- `src/features/cms/runtime.ts`
- `src/features/cms/dashboard-auth.ts`
- `src/features/cms/dashboard-server.ts`
- `src/routes/dashboard.tsx`
- `src/routes/dashboard/init.tsx`
- `scripts/validate-cms-auth.ts`
- `scripts/validate-cms-prisma-auth.ts`

Validation run (read-only against existing state):
- `npm run -s test:cms:auth` ✅ passed

---

## What is actually wired

1. **Memory mode default + bootstrap mode switch**
   - Adapter resolution (`src/features/cms/adapters/index.ts`):
     - `CMS_ADAPTER=memory` → memory adapter
     - `CMS_ADAPTER=prisma` → Prisma adapter
     - unset `CMS_ADAPTER` + `DATABASE_URL` present → Prisma
     - unset `CMS_ADAPTER` + no `DATABASE_URL` → memory
   - Memory bootstrap (`src/features/cms/adapters/memory.ts`):
     - `CMS_BOOTSTRAP_MODE=fresh` → empty store for all lists
     - otherwise default → seeded store with 2 users, roles, todos, images

2. **Dashboard init redirect source of truth**
   - `cms.config.ts` adds GraphQL query `redirectToInit` = `context.sudo().query.User.count({}) === 0`.
   - Dashboard guard (`src/routes/dashboard.tsx`):
     - if `redirectToInit=true`, all dashboard routes redirect to `/dashboard/init` (except already on init).
     - if `redirectToInit=false`, `/dashboard/init` redirects to `/dashboard`.

3. **createInitialUser availability**
   - `cms.config.ts` sets auth `initFirstItem` for `User` list.
   - `src/features/cms/auth/graphql.ts` exposes `createInitialUser` only when `initFirstItem` exists.
   - It explicitly rejects when user count is not zero (`CMS_INIT_ALREADY_COMPLETE`).

4. **Nested role create during init**
   - `initFirstItem.itemData` includes:
     - `role: { create: { name: 'Admin', ...all dashboard perms true } }`
   - Memory adapter relationship create path supports nested create (`createNestedRelationshipItems` + `applyRelationshipInput`).
   - Script assertion in `scripts/validate-cms-auth.ts` confirms created initial user role has `canManagePeople=true`, `canManageRoles=true`, `canAccessDashboard=true`.

5. **Seeded credentials**
   - Memory seed users (`memory.ts`):
     - `ada@example.com` / `password`
     - `ed@example.com` / `password`
   - Prisma demo seed (`prisma/seed.ts`) creates same credentials (password hashed via `hashPassword`).

6. **Dashboard login and fallback behavior**
   - Dashboard GraphQL calls disable dev auth fallback by setting `x-cms-disable-dev-auth-fallback=true` (`dashboard-auth.ts`, `dashboard-server.ts`).
   - Therefore dashboard requires real cookie/Bearer auth even in dev.
   - `scripts/validate-cms-auth.ts` verifies:
     - default dev fallback is off
     - explicit `CMS_DEV_AUTH_FALLBACK=true` needed for non-dashboard non-cookie dev shortcuts.

---

## Mode matrix (current behavior)

| Mode | Command | Expected users count at boot | Redirect path behavior | Credentials | createInitialUser enabled? | Nested role create works? | Dashboard login works? | Known failures / caveats |
|---|---|---:|---|---|---|---|---|---|
| Memory Seeded | `npm run dev:seeded` (or `CMS_ADAPTER=memory CMS_BOOTSTRAP_MODE=seeded npm run dev`) | 2 (`user_admin`, `user_editor`) | `/dashboard/init` **not** required; hitting `/dashboard/init` redirects to `/dashboard` | `ada@example.com/password`, `ed@example.com/password` | GraphQL field exists, but mutation will fail with `CMS_INIT_ALREADY_COMPLETE` since count != 0 | N/A in steady state; adapter supports it | Yes, signin with seeded creds should create session and access dashboard (admin/editor both have `canAccessDashboard=true`) | If expecting first-run init screen, this mode intentionally bypasses it because users already exist |
| Memory Fresh | `npm run dev:fresh` (or `CMS_ADAPTER=memory CMS_BOOTSTRAP_MODE=fresh npm run dev`) | 0 | Any dashboard route redirects to `/dashboard/init` until first user created | No seeded users | Yes, and this is the intended path | Yes, proven by `test:cms:auth` assertions | Yes after creating initial user (session token + cookie set) | If createInitialUser payload invalid, mutation returns `Initial user creation failed.` with cause extension |
| Prisma Demo Seed | `npm run db:seed:demo` (after schema present + DB reachable), then `CMS_ADAPTER=prisma npm run dev` | 2 users inserted by seed script | `/dashboard/init` not required; `/dashboard/init` redirects to `/dashboard` | `ada@example.com/password`, `ed@example.com/password` | Exists but returns `CMS_INIT_ALREADY_COMPLETE` | Not exercised in this mode because users already exist | Yes with seeded creds (validated by `scripts/validate-cms-prisma-auth.ts`) | Seed script is demo data, not first-run parity; can confuse init testing |
| Prisma Fresh Reset | `npm run db:reset:fresh` then `CMS_ADAPTER=prisma npm run dev` **without** running seed | 0 | Redirects to `/dashboard/init` until initial user created | No seeded users | Yes (intended first-run path) | Expected yes via generic adapter relation create; not executed here to avoid mutating non-temp DB | Expected yes after init+signin | `db:reset:fresh` is destructive reset of configured DB; should only be run against disposable DB |

---

## Script naming / env intent clarity

- `db:seed` aliases `db:seed:demo` (demo fixtures, not first-run init).
- `db:reset:fresh` intentionally supports true first-admin flow testing when **not** followed by seed.
- `.env.example` documents this clearly:
  - memory default
  - `CMS_BOOTSTRAP_MODE=seeded|fresh`
  - Prisma is persistent mode via `CMS_ADAPTER=prisma`

---

## Concrete conclusions

1. **Seeded memory mode is working and intentionally bypasses init** (2 users present).
2. **Fresh memory mode is working and intentionally forces `/dashboard/init`** (0 users).
3. **Prisma `db:seed:demo` is demo-fixture seeding, not first-run init parity**.
4. **Prisma fresh parity path is `db:reset:fresh` without seed**.
5. **`createInitialUser` is correctly gated to zero-user state and includes nested role create data**.
6. **Dashboard auth/redirect behavior is consistent with Keystone-like init flow and does not use dev fallback shortcuts**.

## Most likely source of confusion (not a code bug)

Using a seeded mode (`dev:seeded` or `db:seed:demo`) while expecting first-run init UI. In this project, seeded paths intentionally disable init by making user count non-zero.