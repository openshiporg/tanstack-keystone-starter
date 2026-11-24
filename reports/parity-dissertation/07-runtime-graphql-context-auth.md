# Runtime / GraphQL / Context / Auth Parity Audit

Date: 2026-05-18

Scope compared:
- Target: `/Users/junaid/code/tanstack-keystone-starter`
- Official Keystone reference: `/Users/junaid/code/keystone`

Inputs reviewed:
- `progress.md` present at `/Users/junaid/code/tanstack-keystone-starter/progress.md`
- `plan.md` missing at `/Users/junaid/code/tanstack-keystone-starter/plan.md`

## Review
- Correct:
  - The target now has distinct cached public/internal schemas via `getCmsGraphQLSchema('public' | 'internal')` and exposes `context.graphql.schema/raw/run`, `withRequest`, `withSession`, `internal()`, and `sudo()` shapes that broadly mirror Keystone’s context contract (`src/features/cms/runtime.ts:678-727`; official `packages/core/src/lib/context/createContext.ts:62-125`).
  - Auth extension ordering is effectively aligned: target builds base CRUD schema, applies auth, then applies user `extendGraphqlSchema` (`src/features/cms/runtime.ts:1010-1014`), which matches Keystone’s `withAuth` composition where auth wraps the schema before user extension is applied (`packages/auth/src/index.ts:247-272`, `packages/core/src/lib/graphql.ts:59-82`).
  - Stateless sessions support both Bearer tokens and `keystonejs-session` cookies and write `Set-Cookie` through the HTTP route boundary (`src/features/cms/auth/session.ts:75-147`, `src/routes/api/graphql.ts:5-11`), which is directionally consistent with official Keystone’s cookie/Bearer session entry points (`packages/core/src/session.ts:62-135`).
  - Core auth flows are exercised in memory and Prisma validation scripts: sign-in, authenticatedItem, withRequest rebinding, cookie writing, init-first-item, and password reset are covered in `scripts/validate-cms-auth.ts:34-243` and `scripts/validate-cms-prisma-auth.ts:23-43`.
  - Current target auth failure union shape matches current official source, not the stale docs: both return only `{ message }` on `UserAuthenticationWithPasswordFailure` (`src/features/cms/auth/graphql.ts:95-97`, `packages/auth/src/gql/getBaseAuthSchema.ts:40-45`; docs are stale at `docs/content/docs/config/auth.md:123`).
- Blocker:
  - `context.internal()` currently bypasses access control because target treats `__internal.internal === true` as equivalent to sudo (`src/features/cms/access.ts:34-35`). Official Keystone only bypasses access when `__internal.sudo === true`; `internal()` changes schema/context internals but does not itself grant sudo (`packages/core/src/lib/context/createContext.ts:124-125`, `packages/core/src/lib/core/access-control.ts:49-54,75-80,118-123`). The target test suite currently codifies the wrong behavior by asserting that `context.internal()` bypasses access filters (`scripts/validate-cms-auth.ts:105-112`).
- Note:
  - Current official `@keystone-6/auth` source no longer implements password-reset GraphQL in the inspected package code; the docs still mention password reset (`docs/content/docs/config/auth.md:6-8,137-146`), but the package source only implements password auth + init-first-item (`packages/auth/src/gql/getBaseAuthSchema.ts:55-121`, `packages/auth/src/gql/getInitFirstItemSchema.ts:42-86`), and the repo includes a pending removal changeset for `passwordResetLink`/`magicAuthLink` (`.changeset/rm-auth-magic.md:1-5`). The target’s reset mutations are therefore custom surface area, not current-upstream parity requirements.

## Executive verdict

The target is no longer missing the broad runtime/auth surface: it has a real schema split, request-aware context, cookie/Bearer sessions, auth mutations, and init-first-item support. The remaining parity gaps are now mostly **semantic** rather than **surface-level**.

The biggest exact gaps versus current official Keystone are:

1. **`internal()` incorrectly behaves like `sudo()`**.
2. **`sessionData` is materialized by a hard-coded local parser instead of the wrapped session strategy + validated GraphQL query used by Keystone**.
3. **`authenticatedItem` and `createInitialUser` go straight to adapter methods instead of the `context.db/query` layer Keystone uses**, bypassing parity for coercion, hooks, and access semantics.
4. **`graphql.raw()` uses `execute()` directly and skips the validation path Keystone uses**.
5. **`createAuth()` is only a thin validator in the target; it does not wrap `session`, UI auth middleware, or schema validation the way official `withAuth()` does**.
6. **Password-reset behavior is extra/custom and should be treated as a product decision, not assumed Keystone parity work**.

## 1. Public vs internal schema split

### What matches

- Target builds and caches both public and internal schemas:
  - `src/features/cms/runtime.ts:1000-1023`
- Internal schema generation removes public `graphql.omit` restrictions by passing `kind: 'internal'` through type/input generation:
  - `src/features/cms/runtime.ts:281-322`
  - `src/features/cms/runtime.ts:516-557`
- Official Keystone similarly builds two schemas and uses an internal schema with omit disabled:
  - `packages/core/src/lib/system.ts:58-97`
  - `packages/core/src/lib/system.ts:147-156`

### Exact gaps

#### Gap 1.1 — `internal()` wrongly bypasses access control
- Target:
  - `src/features/cms/access.ts:34-35`
  - `src/features/cms/runtime.ts:707-709`
- Official:
  - `packages/core/src/lib/context/createContext.ts:123-125`
  - `packages/core/src/lib/core/access-control.ts:49-54,75-80,118-123,187-190`

Official Keystone only short-circuits access when `context.__internal.sudo` is true. The target’s `isSudoContext()` returns true for either `sudo` **or** `internal`, so `internal()` becomes an access bypass, not just a schema switch.

Impact:
- Incorrect privilege model.
- Hidden fields/lists and restricted query/update/delete access can be bypassed with `internal()`.
- Existing test coverage currently protects the wrong behavior (`scripts/validate-cms-auth.ts:105-112`).

Severity: **Critical**

#### Gap 1.2 — Internal/public distinction exists at SDL level, but parity metadata is thinner
- Target context internals:
  - `src/features/cms/adapters/types.ts:68-82`
- Official context internals:
  - `packages/core/src/types/context.ts:36-46`

Target `__internal` contains `{ sudo, internal, lists?, request?, responseHeaders? }`. Official Keystone exposes initialized list metadata and Prisma null markers under `__internal`. This is lower priority than Gap 1.1, but it matters if the target wants true extension parity or field/input coercion parity later.

Severity: **Low-Medium**

## 2. Context API parity

### What matches

- The target now exposes the same high-level shape that official Keystone consumers expect:
  - `db`, `query`, `graphql`, `prisma`, `transaction`, `sessionStrategy`, `session`, `withRequest`, `withSession`, `internal`, `sudo`
  - Target: `src/features/cms/adapters/types.ts:68-82`, `src/features/cms/runtime.ts:698-717`
  - Official: `packages/core/src/types/context.ts:9-46`, `packages/core/src/lib/context/createContext.ts:79-125`

### Exact gaps

#### Gap 2.1 — `graphql.raw()` skips GraphQL validation semantics
- Target:
  - `src/features/cms/runtime.ts:720-726`
- Official:
  - `packages/core/src/lib/context/createContext.ts:63-76`

Official Keystone’s `raw()` funnels through `graphql({ schema, source, ... })`, which parses and validates before execution. The target’s `raw()` calls `execute()` directly after parsing `query` into a document, which skips normal validation for invalid field selections/documents.

Impact:
- `context.graphql.raw()` is not behaviorally equivalent for invalid GraphQL documents.
- `query` API helpers built on top of `run()` may mask this for happy paths, but external callers will see different error behavior.

Severity: **High**

#### Gap 2.2 — `withRequest()` rebinds sessions via target-specific reconstruction, not via wrapped session strategy parity
- Target:
  - `src/features/cms/runtime.ts:710-717`
  - `src/features/cms/runtime.ts:841-864`
- Official:
  - `packages/core/src/lib/context/createContext.ts:105-117`
  - `packages/auth/src/index.ts:119-154`

Official `withRequest()` calls `config.session?.get({ context: newContext })` and then `withSession(...)`. When `withAuth()` is installed, `config.session` has already been wrapped so `get()` returns session data enriched via `sessionData`.

Target `createAuth()` does **not** wrap `config.session` at all (`src/features/cms/keystone/auth.ts:6-23`). Instead, `withRequest()` and `createCmsContext()` call the raw session strategy, extract `itemId`, then rebuild session data via `sessionForUser()` (`src/features/cms/runtime.ts:751-779`).

Impact:
- Session hydration parity lives in ad hoc runtime code instead of the session strategy contract.
- Custom session strategies or non-`User` auth lists will not inherit official Keystone behavior.
- `withRequest()` does not reuse the same extension points as official Keystone.

Severity: **High**

#### Gap 2.3 — Session typing is hard-coded to `User`
- Target:
  - `src/features/cms/adapters/types.ts:20-28`
  - `src/features/cms/runtime.ts:756-760`
- Official:
  - `packages/auth/src/index.ts:16-19,121-154`
  - `packages/core/src/types/context.ts:27-30`

Target `CmsSession` is fixed to `{ listKey: 'User'; itemId: string; data: ...role... }`. Official Keystone is generic over `TypeInfo['session']`, and `createAuth()` is not hard-coded to a specific list in the runtime contract.

Impact:
- The target only has app-specific parity, not reusable Keystone parity.
- Future auth-list changes would require runtime surgery, not config changes.

Severity: **Medium**

#### Gap 2.4 — Transaction API shape is thinner than official
- Target:
  - `src/features/cms/adapters/types.ts:76`
  - `src/features/cms/runtime.ts:706`
- Official:
  - `packages/core/src/types/context.ts:14-23`

Official Keystone’s `transaction()` accepts Prisma transaction options. The target only accepts `fn`.

Severity: **Low**

## 3. `graphql.raw` / `graphql.run` / `graphql.schema`

### What matches

- Both target and official expose:
  - `context.graphql.schema`
  - `context.graphql.raw({ query, variables })`
  - `context.graphql.run({ query, variables })`
- Both `run()` implementations throw the first GraphQL error:
  - Target: `src/features/cms/runtime.ts:723-726`
  - Official: `packages/core/src/lib/context/createContext.ts:73-76`

### Exact gaps

#### Gap 3.1 — `raw()` validation mismatch
Covered above in Gap 2.1. This is the main runtime-contract divergence for this surface.

#### Gap 3.2 — `raw()` document handling differs
- Target parses strings into AST and passes AST to `execute()`:
  - `src/features/cms/runtime.ts:576-577,721-722`
- Official converts AST to string with `print()` and calls `graphql()`:
  - `packages/core/src/lib/context/createContext.ts:63-70`

This matters because official behavior is aligned with standard `graphql()` validation/parsing rules. The target’s shortcut is faster but not parity-accurate.

Severity: **Medium**

## 4. `withRequest` / `withSession` / `sudo` / `internal`

### What matches

- The target exposes all four APIs with the expected names:
  - `src/features/cms/runtime.ts:708-717`
- `sudo()` correctly switches to the internal schema and marks `sudo: true`:
  - `src/features/cms/runtime.ts:709`
- Official does the same shape-wise:
  - `packages/core/src/lib/context/createContext.ts:119-125`

### Exact gaps

#### Gap 4.1 — `internal()` and `sudo()` semantics are collapsed
This is the same correctness blocker as Gap 1.1.

Official:
- `internal()` = internal schema/context
- `sudo()` = internal schema/context + access bypass

Target today:
- `internal()` = internal schema/context + access bypass because access helpers treat `internal` as sudo (`src/features/cms/access.ts:34-35`)

Severity: **Critical**

#### Gap 4.2 — `withRequest()` does not preserve official session-wrapper behavior
See Gap 2.2.

#### Gap 4.3 — `withSession()` is structurally fine, but only for target’s fixed `CmsSession`
- Target: `src/features/cms/runtime.ts:717`
- Official: `packages/core/src/lib/context/createContext.ts:119-121`

This is not a functional bug for the starter, but it is not generic parity.

Severity: **Low-Medium**

## 5. `extendGraphqlSchema` parity

### What matches

#### Correct 5.1 — Extension order matches official Keystone
- Target runtime order:
  - base CRUD schema
  - auth schema
  - user `extendGraphqlSchema`
  - `src/features/cms/runtime.ts:1010-1014`
- Official order:
  - auth wraps schema inside `withAuth()`
  - user extension is then called around that
  - `packages/auth/src/index.ts:247-272`
  - `packages/core/src/lib/graphql.ts:59-82`

This means app-specific extensions like `redirectToInit` in `cms.config.ts:9-30` correctly see auth fields already applied.

### Exact gaps

#### Gap 5.2 — Target `createAuth()` does not actually compose schema/session/UI behavior the way official `withAuth()` does
- Target `withAuth()`:
  - validates list/field existence, requires `config.session`, then only returns `{ ...config, auth }`
  - `src/features/cms/keystone/auth.ts:6-23`
- Official `withAuth()`:
  - composes UI public pages and middleware
  - wraps `config.session`
  - validates `sessionData` against schema
  - composes `extendGraphqlSchema`
  - `packages/auth/src/index.ts:119-285`
  - `packages/auth/src/schema.ts:25-83`

Target currently achieves auth via runtime special-casing in `buildCmsGraphQLSchema()` and `createCmsContext()`, not by making `withAuth()` itself behave like Keystone.

Impact:
- The config authoring API looks Keystone-like but is not Keystone-like in behavior.
- Third-party code expecting official `withAuth()` side effects would not work.

Severity: **High**

## 6. Auth/session strategy parity

### What matches

- Bearer and cookie token lookup:
  - Target `tokenFromRequest()`: `src/features/cms/auth/session.ts:75-80`
  - Official `getToken()`: `packages/core/src/session.ts:62-71`
- `start()`/`end()` write an httpOnly `keystonejs-session` cookie by default:
  - Target: `src/features/cms/auth/session.ts:117-146`
  - Official: `packages/core/src/session.ts:100-134`
- `secret.length >= 32` validation exists in both:
  - Target: `src/features/cms/auth/session.ts:104-105`
  - Official: `packages/core/src/session.ts:83-86`

### Exact gaps

#### Gap 6.1 — Target stateless sessions are signed, not Iron-sealed/encrypted
- Target uses base64url JSON + HMAC signature:
  - `src/features/cms/auth/session.ts:15-94`
- Official uses `@hapi/iron` sealing:
  - `packages/core/src/session.ts:73-135`

Impact:
- Target session tokens are integrity-protected but readable by clients.
- Official Keystone tokens are sealed, not just signed.

Severity: **Medium-High**

#### Gap 6.2 — No `storedSessions()` equivalent
- Official:
  - `packages/core/src/session.ts:138-168`
- Target:
  - only `statelessSessions()` exists in `src/features/cms/auth/session.ts`

Severity: **Medium**

#### Gap 6.3 — Fetch `Request`/`Headers` semantics replace Node `req`/`res`
- Target:
  - `src/features/cms/adapters/types.ts:77-81`
  - `src/routes/api/graphql.ts:5-11`
- Official:
  - `packages/core/src/types/context.ts:25-30`
  - `packages/core/src/session.ts:89-117`

This is a platform adaptation, not necessarily a bug. But it means middleware/extensions expecting Node request/response semantics are not source-compatible.

Severity: **Note / intentional platform difference**

## 7. `sessionData` parity

This is the largest non-security semantic gap.

### Official Keystone behavior
- `withAuth()` wraps the session strategy so that `get()`:
  1. reads the raw session,
  2. uses `context.sudo().query[listKey].findOne({ where: { id }, query: sessionData })`,
  3. returns the fetched GraphQL-shaped data as `session.data`
  - `packages/auth/src/index.ts:119-154`
- Startup validates the `sessionData` GraphQL string against the built schema:
  - `packages/auth/src/schema.ts:51-69`

### Target behavior
- `createAuth()` does not wrap `config.session` at all:
  - `src/features/cms/keystone/auth.ts:6-23`
- `createCmsContext()` and `withRequest()` rebuild session data through `sessionForUser()`:
  - `src/features/cms/runtime.ts:751-779,841-864`
- `sessionData` is interpreted by a local token parser, not by GraphQL:
  - `src/features/cms/runtime.ts:781-825`

### Exact gaps

#### Gap 7.1 — `sessionData` is not schema-validated at startup
- Target: no validation path exists.
- Official: `packages/auth/src/schema.ts:54-69`

Impact:
- Invalid `sessionData` strings will not fail fast.
- This regresses a documented Keystone guarantee and a historical bugfix noted in the changelog.

Severity: **High**

#### Gap 7.2 — `sessionData` is projected from raw adapter data, not GraphQL query resolution
- Target:
  - `src/features/cms/runtime.ts:763-779,781-825`
- Official:
  - `packages/auth/src/index.ts:127-146`

Impact:
- No field resolvers, no GraphQL-level access shaping, no aliases/fragments/arguments.
- Only the hard-coded user/role structure is really supported.
- `session.data` parity is starter-specific, not Keystone-generic.

Severity: **High**

#### Gap 7.3 — Target forces fallback `name`, `email`, and `role` fields into session data
- Target:
  - `src/features/cms/runtime.ts:763-779`
- Official:
  - returns exactly the resolved `sessionData` query result from `sudoContext.query[...]`
  - `packages/auth/src/index.ts:135-146`

Impact:
- Even if config selected less data, target session shape is not purely config-driven.

Severity: **Medium**

## 8. `authenticatedItem`, `authenticate*`, `createInitial*`, and reset flows

### 8.1 `authenticatedItem`

#### What matches
- Target exposes `authenticatedItem` and `endSession` under auth extension:
  - `src/features/cms/auth/graphql.ts:108-118`
- Official exposes the same two entry points:
  - `packages/auth/src/gql/getBaseAuthSchema.ts:55-78`

#### Exact gaps

##### Gap 8.1.1 — `authenticatedItem` fetches through sudo adapter instead of `context.db`
- Target:
  - `src/features/cms/auth/graphql.ts:71-74,127-128`
- Official:
  - `packages/auth/src/gql/getBaseAuthSchema.ts:57-68`

Official uses `context.db[listKey].findOne(...)`, not `context.sudo().adapter.findUnique(...)`.

Impact:
- Target bypasses the `db` API layer used by Keystone for access/coercion semantics.
- Read access is still partially enforced later by field resolvers, but the item-fetch contract is not the same.

Severity: **Medium-High**

### 8.2 `authenticateUserWithPassword`

#### What matches
- Query/mutation names align for current config:
  - Target: `src/features/cms/auth/graphql.ts:24-37`
  - Official: `packages/auth/src/index.ts:21-35`
- Wrong password returns the failure union member and correct password returns `sessionToken` + `item`.
- Timing-attack mitigation exists in the target by hashing a dummy password if hash is absent:
  - `src/features/cms/auth/password.ts:15-22`
  - Official equivalent: `packages/auth/src/gql/getBaseAuthSchema.ts:96-103`

#### Exact gaps

##### Gap 8.2.1 — No official identity-field validation
- Official validates that the identity field is searchable uniquely by String/ID on the auth list:
  - `packages/auth/src/schema.ts:25-40`
- Target only checks field existence:
  - `src/features/cms/keystone/auth.ts:7-15`

Impact:
- Misconfigured auth could start but fail semantically later.

Severity: **High**

##### Gap 8.2.2 — Target authenticate mutation stores `{ listKey, itemId }` instead of current official `{ itemId }`
- Target:
  - `src/features/cms/auth/graphql.ts:141`
- Official current source:
  - `packages/auth/src/gql/getBaseAuthSchema.ts:104-109`

This is minor and harmless for the starter, but it is not exact parity with current source.

Severity: **Low**

### 8.3 `createInitialUser`

#### What matches
- Mutation naming is correct:
  - Target: `src/features/cms/auth/graphql.ts:32-33`
  - Official: `packages/auth/src/index.ts:32-33`
- Both flows do:
  - require session strategy
  - count existing auth-list items under sudo
  - create item with merged `defaultItemData`/`itemData`
  - start session
  - return auth success payload
  - Target: `src/features/cms/auth/graphql.ts:195-230`
  - Official: `packages/auth/src/gql/getInitFirstItemSchema.ts:47-83`

#### Exact gaps

##### Gap 8.3.1 — `CreateInitialUserInput` is manually reconstructed instead of derived from real `UserCreateInput`
- Target:
  - `src/features/cms/auth/graphql.ts:46-68,89-118`
- Official:
  - `packages/auth/src/gql/getInitFirstItemSchema.ts:30-40`

Official filters the actual generated `UserCreateInput` down to the configured field set. Target manually maps field kinds to coarse GraphQL types.

Impact:
- Input type can drift from real list create semantics.
- Relationships/files/images/field-specific inputs will not match Keystone if ever used in `initFirstItem.fields`.

Severity: **High**

##### Gap 8.3.2 — `createInitialUser` writes through `adapter.create`, not `sudoContext.db[listKey].createOne`
- Target:
  - `src/features/cms/auth/graphql.ts:197-224`
- Official:
  - `packages/auth/src/gql/getInitFirstItemSchema.ts:50-65`

This bypasses the `db` API layer where Keystone performs GraphQL-coerced input resolution and participates in list/field hook semantics.

Impact:
- Even if SDL looks right, init behavior can diverge from normal list create behavior.
- Hook/validation parity is lost at the most sensitive bootstrap path.

Severity: **High**

##### Gap 8.3.3 — Error semantics diverge from official source
- Target throws specific `GraphQLError`s with custom extensions:
  - `src/features/cms/auth/graphql.ts:199-228`
- Official throws plain `AUTHENTICATION_FAILURE` string in these failure cases:
  - `packages/auth/src/gql/getInitFirstItemSchema.ts:53-54,75-76`

Target is arguably better operationally, but it is not exact parity.

Severity: **Medium**

### 8.4 Password reset / reset flow

#### Important parity note
Current official inspected source does **not** implement password-reset GraphQL in `packages/auth/src/gql/*`. The target does implement:
- `sendUserPasswordResetLink`
- `redeemUserPasswordResetToken`
- custom reset-token storage semantics
- `src/features/cms/auth/graphql.ts:145-191`
- validated in `scripts/validate-cms-auth.ts:155-240`

The official repo state is mixed:
- docs still describe reset support broadly (`docs/content/docs/config/auth.md:6-8`)
- current source lacks the implementation
- pending changeset removes it explicitly (`.changeset/rm-auth-magic.md:1-5`)

#### Practical conclusion
This is **not** a missing Keystone-parity item against the current inspected package source. It is a **product decision point**:
- If the goal is parity with current official `@keystone-6/auth`, keep reset out of the core parity backlog.
- If the goal is parity with older Keystone docs or the broader starter UX, then reset remains a custom feature and should be treated separately.

#### If reset remains in product scope, there are still non-parity details
- It uses adapter-level update/write paths, not `context.db/query` parity paths:
  - `src/features/cms/auth/graphql.ts:151-159,182-189`
- It assumes hard-coded token fields on the auth list item.
- It is not driven by official `createAuth()` configuration surface in the current source.

Severity: **Decision point, not current-upstream blocker**

## 9. Request/response semantics

### What matches

#### Correct 9.1 — GraphQL route forwards auth cookies correctly
- Target route wrapper:
  - `src/routes/api/graphql.ts:5-11`
- Target Yoga context injection:
  - `src/features/cms/graphql.ts:8-14`

The route creates `cmsResponseHeaders`, passes them into Yoga context, then appends them onto the outgoing `Response`. This is the bridge that makes session mutations write cookies in TanStack Start.

### Exact gaps

#### Gap 9.2 — No Node `req` / `res` compatibility layer
- Target uses Fetch `Request` and `Headers` in context internals:
  - `src/features/cms/adapters/types.ts:77-81`
- Official Keystone context contract is Node-centric:
  - `packages/core/src/types/context.ts:25-30`

This is expected for the platform, but it means official middleware/session helpers cannot be ported literally.

Severity: **Intentional platform difference**

#### Gap 9.3 — Auth route gating is app-specific, not `withAuth()`-driven middleware parity
- Target dashboard guard:
  - `src/routes/dashboard.tsx:17-52`
  - `src/features/cms/dashboard-auth.ts:22-52`
- Official `withAuth()` middleware behavior:
  - `packages/auth/src/index.ts:156-240`

The target gets the UX outcome mostly right, but it does so through route-layer app logic plus the custom `redirectToInit` field in `cms.config.ts:9-30`, not through official `withAuth()`-composed Admin UI middleware.

Severity: **Medium**

## 10. Tests: what is covered vs what is still missing

### Already covered
- password auth success/failure
- `authenticatedItem` from Bearer token
- `withRequest()` session rebinding
- session cookie writing
- `redirectToInit`
- `createInitialUser`
- reset-token redemption behavior
- memory + Prisma smoke coverage

Evidence:
- `scripts/validate-cms-auth.ts:68-240`
- `scripts/validate-cms-prisma-auth.ts:28-43`

### Missing or currently wrong for parity

1. **`internal()` vs `sudo()` regression test is wrong**
   - Current test asserts `internal()` bypasses access (`scripts/validate-cms-auth.ts:105-112`)
   - Official behavior requires only `sudo()` to bypass access.

2. **No test that invalid `sessionData` fails at startup**
   - Official validates this on boot (`packages/auth/src/schema.ts:54-69`)
   - Target has no equivalent.

3. **No test that `graphql.raw()` validates invalid GraphQL**
   - Needed to catch the `execute()` vs `graphql()` mismatch.

4. **No test that `createInitialUser` goes through normal `db` semantics**
   - Today it goes through adapter directly.

5. **No test that `authenticatedItem` honors non-sudo `db` lookup semantics**
   - Today it resolves via `sudo().adapter.findUnique`.

## 11. Recommended implementation order

### Order 1 — Fix `internal()` vs `sudo()` semantics
Files:
- `src/features/cms/access.ts:34-35`
- `scripts/validate-cms-auth.ts:105-112`

Why first:
- This is the only clear correctness/security blocker in the current parity slice.
- It also invalidates at least one current parity assertion.

Expected change:
- `internal()` should switch schema/context internals only.
- Only `sudo()` should bypass access.

### Order 2 — Move `sessionData` behavior into `createAuth()` parity machinery
Files:
- `src/features/cms/keystone/auth.ts`
- `src/features/cms/runtime.ts:751-825,841-864`
- `src/features/cms/config.ts`

Reference:
- `packages/auth/src/index.ts:119-154`
- `packages/auth/src/schema.ts:51-69`

Why second:
- This is the biggest remaining semantic mismatch in normal authenticated request handling.
- It also removes the current hard-coded `User`/`Role` session projection debt.

### Order 3 — Validate auth config like official Keystone
Files:
- `src/features/cms/keystone/auth.ts`

Reference:
- `packages/auth/src/schema.ts:25-40`
- `packages/auth/src/index.ts:94-117`

Add:
- identity-field unique/searchable validation
- sessionData GraphQL validation at startup

### Order 4 — Route `authenticatedItem` and `createInitialUser` through `context.db/query`, not raw adapter methods
Files:
- `src/features/cms/auth/graphql.ts`

Reference:
- `packages/auth/src/gql/getBaseAuthSchema.ts:57-68,92-118`
- `packages/auth/src/gql/getInitFirstItemSchema.ts:50-65`

Why:
- This is required for parity with official coercion/hook/access semantics.
- It also prevents init bootstrap from being a one-off write path.

### Order 5 — Derive `CreateInitial*Input` from real `CreateInput`
Files:
- `src/features/cms/auth/graphql.ts:46-68,89-118`

Reference:
- `packages/auth/src/gql/getInitFirstItemSchema.ts:30-40`

Why:
- Prevents schema drift.
- Makes init-first-item resilient if field types evolve.

### Order 6 — Make `graphql.raw()` use validated execution semantics
Files:
- `src/features/cms/runtime.ts:720-726`

Reference:
- `packages/core/src/lib/context/createContext.ts:63-76`

Why:
- Brings the context contract into exact behavioral alignment for direct GraphQL API consumers.

### Order 7 — Decide whether password reset is in or out of official parity scope
Files:
- `src/features/cms/auth/graphql.ts`
- `src/routes/dashboard/reset.tsx`
- product docs/reporting

Decision options:
1. **Current-upstream parity mode:** treat reset as app-specific feature and remove it from core parity backlog.
2. **Legacy/docs/NKS parity mode:** keep it, but treat it as a separate compatibility track.

## 12. Bottom-line exact-gap summary

### Already aligned enough
- public/internal schema presence
- `context.graphql.schema/run`
- auth mutation/query names
- cookie/Bearer session entry points
- auth-before-user `extendGraphqlSchema` ordering
- route-level HTTP cookie propagation

### Must change for official parity
1. `internal()` must stop behaving like sudo.
2. `sessionData` must be schema-validated and hydrated through wrapped session strategy/query semantics.
3. `authenticatedItem` and `createInitialUser` must stop bypassing `context.db/query` parity paths.
4. `graphql.raw()` must use validated GraphQL execution semantics.
5. `createAuth()` must do more than attach `auth` onto config if the goal is true official parity.

### Decision, not bug
- Password reset is currently **custom product surface**, not a proven current-upstream Keystone parity requirement.
