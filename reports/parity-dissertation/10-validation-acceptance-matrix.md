## Review
- Correct:
  - **Artifact/gen/build guardrails already exist and are meaningful.**
    - `npm run cms:check` validates generated CMS artifacts, Prisma schema parity, and Prisma delegate availability (`package.json:13`; `scripts/cms-generate.ts:72-120`; `scripts/compare-cms-prisma-schema.ts:14-22`; `scripts/check-cms-prisma-delegates.ts:7-15`).
    - `npm run build` always regenerates CMS artifacts before bundling (`package.json:19`).
    - `npm run lint` and `npm run check` exist as static quality gates (`package.json:29-31`).
  - **Backend memory-parity coverage is already broad.**
    - `npm run test:cms` covers AdminMeta, unique where, `NOT` list-shape parity, single CRUD, nested create/update, rollback, many mutations, partial failure handling, access/sudo, context APIs, and delete-hook sequencing (`package.json:22`; `scripts/validate-cms-crud.ts:49-217`, `378-639`).
  - **Auth/session coverage exists for the runtime contract.**
    - `npm run test:cms:auth` covers anonymous/authenticated state, production dev-fallback disablement, opt-in dev fallback, password auth, Bearer token hydration, internal schema bypass, `withRequest`, cookie writing, init-first-user, and password reset token flows (`package.json:23`; `scripts/validate-cms-auth.ts:29-243`).
  - **Storage/upload coverage exists for the local provider slice.**
    - `npm run test:cms:storage` validates filename sanitization, local persistence, byte sniffing, PNG/GIF/WebP/JPEG dimension extraction, extension correction, and invalid-image rejection (`package.json:24`; `scripts/validate-cms-storage.ts:11-119`).
    - `npm run test:cms:upload` validates GraphQL Upload execution and persisted local bytes, but only in-process (`package.json:25`; `scripts/validate-cms-graphql-upload.ts:20-71`).
  - **Dynamic-model and Prisma parity coverage is stronger than earlier audits.**
    - `npm run test:cms:dynamic` exercises arbitrary list initialization, `graphql.maxTake`, public/internal omit behavior, generated Prisma schema content, many mutations, delegate preflight, fixture-backed Prisma semantics, and a real temporary generated Prisma client (`package.json:26`; `scripts/validate-cms-dynamic-model.ts:22-302`; `scripts/validate-cms-prisma-preflight.ts:1-75`; `scripts/validate-cms-prisma-runtime-fixture.ts:172-279`; `scripts/validate-cms-prisma-temp-client.ts:55-134`).
    - `npm run test:cms:prisma` covers seeded Prisma CRUD, filters, image column reconstruction, upload persistence, nested relationship rollback, many mutations, hooks, access/sudo, and context APIs (`package.json:27`; `scripts/validate-cms-prisma.ts:64-739`).
    - `npm run test:cms:prisma:auth` covers Prisma password auth and Bearer session hydration (`package.json:28`; `scripts/validate-cms-prisma-auth.ts:22-43`).

- Blocker:
  1. **I did not write** `/Users/junaid/code/tanstack-keystone-starter/reports/parity-dissertation/10-validation-acceptance-matrix.md` **because the task also explicitly said “Read-only; do not edit.”** Per instruction precedence, I left the repo unchanged.
  2. **Parity should not be claimed yet because the acceptance surface is still missing critical regression layers:**
     - No repo-owned Vitest/unit spec corpus was found, despite `npm run test` existing (`package.json:21`).
     - No automated dashboard/browser regression suite exists for route guards and CRUD screens, even though the relevant routes are now live (`src/routes/dashboard.tsx:17-69`; `src/routes/dashboard/$listKey.tsx:9-116`; `src/routes/dashboard/$listKey.create.tsx:12-119`; `src/routes/dashboard/$listKey.$id.tsx:25-297`; `src/routes/dashboard/signin.tsx:13-128`; `src/routes/dashboard/reset.tsx:13-133`; `src/routes/dashboard/signup.tsx:17-126`; `src/routes/dashboard/init.tsx:13-113`).
     - Upload coverage is **not HTTP transport parity** yet: the Upload scalar is wired in schema (`src/features/cms/runtime.ts:38-64`, `255-264`), but the current test calls `graphql()` directly rather than exercising `/api/graphql` multipart transport (`scripts/validate-cms-graphql-upload.ts:40-54`; `src/features/cms/graphql.ts:8-14`; `src/routes/api/graphql.ts:14-20`).
     - Manual dashboard smoke still reports visible Base UI console errors, so the browser layer is not clean enough for parity signoff (`dashboard-browser-smoke.md:3-15`).

- Note:
  - `plan.md` was requested but does not exist at `/Users/junaid/code/tanstack-keystone-starter/plan.md`. I used `progress.md` plus existing parity reports.

### Dependency-aware validation matrix

| Gate | Status | Exact command(s) | Primary evidence files | What it covers now | Critical gap remaining |
|---|---|---|---|---|---|
| 0. Formatting/static | Partial | `npm run check` ; `npm run lint` | `package.json:29-31` | formatting + lint | no behavior coverage |
| 1. Artifact drift/config | Strong | `npm run cms:check` | `package.json:13`; `scripts/cms-generate.ts:72-120`; `scripts/compare-cms-prisma-schema.ts:14-22`; `scripts/check-cms-prisma-delegates.ts:7-15` | generated artifacts current, Prisma schema parity, delegate existence | no runtime/browser validation |
| 2. Buildability | Strong | `npm run build` | `package.json:19` | CMS generation + app bundle | no runtime assertions |
| 3. Memory runtime CRUD/access/context | Strong | `npm run test:cms` | `scripts/validate-cms-crud.ts:49-217`, `378-639` | adminMeta, unique where, `NOT`, CRUD, nested writes, rollback, many ops, access/sudo, context APIs | missing official edge-case/error-envelope parity |
| 4. Memory auth/session/reset | Strong | `npm run test:cms:auth` | `scripts/validate-cms-auth.ts:34-243` | auth unions, session token, cookie, init, reset flows | no browser-route coverage |
| 5. Local storage/image bytes | Strong | `npm run test:cms:storage` | `scripts/validate-cms-storage.ts:14-119` | sanitize, persist, sniff, reject bad bytes | no S3/file/document parity |
| 6. GraphQL upload execution | Partial | `npm run test:cms:upload` | `scripts/validate-cms-graphql-upload.ts:33-71` | Upload value normalization + local write | **not HTTP multipart route coverage** |
| 7. Dynamic DSL/schema/runtime | Strong | `npm run test:cms:dynamic` | `scripts/validate-cms-dynamic-model.ts:22-302`; `scripts/validate-cms-prisma-preflight.ts:1-75`; `scripts/validate-cms-prisma-runtime-fixture.ts:172-279`; `scripts/validate-cms-prisma-temp-client.ts:55-134` | arbitrary lists, omit/internal/public, maxTake, many ops, real temp Prisma client | no dashboard/controller parity |
| 8. Prisma persisted backend | Strong | `DATABASE_URL=... CMS_ADAPTER=prisma npm run test:cms:prisma` | `scripts/validate-cms-prisma.ts:64-739` | persisted CRUD/authz/hooks/upload/image reconstruction | not all official mutation/error edge cases |
| 9. Prisma auth | Partial-strong | `DATABASE_URL=... CMS_ADAPTER=prisma npm run test:cms:prisma:auth` | `scripts/validate-cms-prisma-auth.ts:22-43` | login + Bearer hydration | narrow compared with memory auth suite |
| 10. Dashboard live smoke | Weak/manual | manual only | `dashboard-browser-smoke.md:3-15` | signin redirect, signin success, dashboard render | console errors; no automated route/UI regression |
| 11. Vitest/unit suite | Missing | `npm run test` | `package.json:21` | command exists | no repo-owned test/spec files found |

### Critical regression gaps before any “parity” claim

1. **No automated dashboard acceptance suite**
   - Missing regression coverage for:
     - route guard matrix (`src/routes/dashboard.tsx:17-53`)
     - list page/search/sort/filter/child-route behavior (`src/routes/dashboard/$listKey.tsx:9-116`)
     - create flow/controller serialization (`src/routes/dashboard/$listKey.create.tsx:35-84`)
     - item edit/delete/reset flow (`src/routes/dashboard/$listKey.$id.tsx:92-149`, `226-297`)
     - signin/signup/reset/init UX paths (`signin.tsx`, `signup.tsx`, `reset.tsx`, `init.tsx`)
   - Current evidence is only manual smoke and parity reports.

2. **HTTP transport parity gap**
   - Needed because current upload proof stops at in-process execution, not real `/api/graphql` request handling (`scripts/validate-cms-graphql-upload.ts:40-54` vs `src/routes/api/graphql.ts:14-20`).

3. **Official Keystone semantic edge cases still lack regression tests**
   - Existing parity report already calls out uncovered blockers: missing-target update/delete semantics, invalid nested relationship combinations, ordered all-settled many-mutation errors, some access/hook ordering differences, and missing official error envelopes (`reports/parity-dissertation/08-runtime-mutations-access-hooks-errors.md`).

4. **Provider/field parity gaps remain unguarded**
   - S3 storage: untested/missing.
   - file field: scaffold present, not proven by a real model.
   - document field: still far from official Keystone semantics and not covered by a parity-grade test suite (`reports/parity-dissertation/09-runtime-prisma-storage-upload.md`).

5. **UI/browser health still has known console regressions**
   - Base UI button-context warnings were observed in smoke (`dashboard-browser-smoke.md:12-15`).

### Milestone gates required before claiming parity

#### Gate A — Static + artifact integrity
Run, in order:
```bash
npm run check
npm run cms:check
npm run lint
npm run build
```
Pass criteria:
- no formatting/lint failures
- `.cms/*` current
- `prisma/schema.prisma` matches generated schema
- bundle succeeds

#### Gate B — Memory runtime parity
Run:
```bash
npm run test:cms
npm run test:cms:auth
npm run test:cms:storage
npm run test:cms:upload
npm run test:cms:dynamic
```
Pass criteria:
- all current memory/auth/storage/dynamic checks green

#### Gate C — Prisma runtime parity
Prereqs:
```bash
DATABASE_URL=... npm run db:generate
DATABASE_URL=... npm run db:push
DATABASE_URL=... npm run db:seed
```
Then run:
```bash
DATABASE_URL=... CMS_ADAPTER=prisma npm run test:cms:prisma
DATABASE_URL=... CMS_ADAPTER=prisma npm run test:cms:prisma:auth
```
Pass criteria:
- persisted CRUD/auth/upload parity green against real DB

#### Gate D — Missing HTTP transport acceptance suite
Needed files before parity claim:
- `tests/api/graphql-http-upload.test.ts`
- `tests/api/graphql-session-http.test.ts`

Needed assertions:
- multipart upload against `/api/graphql`
- cookie write/read across real HTTP
- auth mutation + subsequent authenticated request
- error envelope over HTTP transport

Run target:
```bash
npm run test
```
Only valid once these repo-owned tests exist.

#### Gate E — Missing dashboard/browser acceptance suite
Needed files before parity claim:
- `tests/dashboard/auth-routing.test.ts`
- `tests/dashboard/list-page.test.ts`
- `tests/dashboard/create-page.test.ts`
- `tests/dashboard/item-page.test.ts`
- `tests/dashboard/auth-flows.test.ts`

Must cover:
- redirect matrix from `src/routes/dashboard.tsx:17-53`
- signin/signup/reset/init flows
- list search/sort/filter/field selection
- create submit and item save/delete/reset
- no console errors on primary routes

#### Gate F — Official semantic blocker closure
Extend existing backend scripts:
- `scripts/validate-cms-crud.ts`
- `scripts/validate-cms-prisma.ts`

Add exact missing assertions for:
- update/delete missing target should error, not null
- invalid nested relationship input combinations
- ordered many-mutation multi-error alignment
- memory scalar create field-access denial
- official-style error-code envelopes

### Parity acceptance verdict

**Current state:** strong backend validation foundation, but only **partial acceptance coverage** for parity.  
**Can claim today:** buildable, generated-artifact-safe, memory+Prisma CMS runtime with meaningful scripted validation.  
**Cannot claim yet:** full Next/official Keystone parity, because **dashboard/browser acceptance, HTTP transport acceptance, and remaining official semantic edge-case regressions are not yet locked down.**