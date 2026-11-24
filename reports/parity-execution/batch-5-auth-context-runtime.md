# Batch 5 official auth/context/runtime semantics

Date: 2026-05-19

## What changed

Implemented a focused Batch 5 auth/context/runtime parity pass guided primarily by:
- `reports/parity-dissertation/07-runtime-graphql-context-auth.md`
- `reports/parity-dissertation/06-runtime-config-dsl-adminmeta.md`
- `reports/parity-dissertation/10-validation-acceptance-matrix.md`

### 1) `createAuth()` now does more real auth wrapping work
- Tightened `withAuth()` validation so auth config must point at a:
  - real auth list
  - real identity field
  - real password secret field
  - uniquely searchable identity field
  - required identity field
- This closes part of the audit drift where auth config only checked field existence and allowed semantically invalid identity-field setups.

### 2) Session strategy is now wrapped with auth-aware session-data hydration
- `createAuth()` now wraps the configured session strategy instead of only attaching `auth` metadata to config.
- Wrapped `session.get()` now:
  - reads the raw session
  - uses `context.sudo().query[listKey].findOne({ where: { id }, query: sessionData })`
  - returns session data shaped from the GraphQL query result
- This materially moves session hydration closer to official Keystone’s model and removes more of the previous ad hoc runtime-only session rebuilding behavior.

### 3) `sessionData` is now schema-validated against the built GraphQL schema
- Added startup-time validation in the auth GraphQL extension layer:
  - syntax validation via `parse(...)`
  - schema validation via `validate(...)`
- Invalid `sessionData` now fails fast instead of silently surviving until runtime.
- This directly addresses one of the highest-value parity gaps called out in the audit.

### 4) `authenticatedItem` now goes through `context.db[...]`
- Changed `authenticatedItem` resolution away from `context.sudo().adapter.findUnique(...)`.
- It now resolves through:
  - `context.db[auth.listKey].findOne({ where: { id } })`
- This is closer to the official Keystone contract and keeps auth item resolution on the same higher-level context API surface.

### 5) `authenticateUserWithPassword` moved closer to official session-start behavior
- The auth mutation now resolves the candidate item through `sudoContext.db[auth.listKey].findOne(...)` instead of raw adapter access.
- On successful authentication, it now starts the session with:
  - `{ itemId }`
  instead of always forcing `{ listKey, itemId }` for the standard password-auth path.
- This aligns more closely with the current official auth source behavior while keeping existing flows working.

### 6) `createInitialUser` now uses the db context API and derives its input shape from real CreateInput
- The init-first-item input type is no longer manually reconstructed from coarse field-kind mapping.
- Instead, it is derived from the real generated `${listKey}CreateInput` type and filtered down to the configured `initFirstItem.fields`.
- The mutation’s write path now uses:
  - `sudoContext.db[listKey].createOne(...)`
  instead of raw `adapter.create(...)`
- The item count check now goes through:
  - `sudoContext.db[listKey].count({})`
- This reduces drift between init-first-item behavior and normal list create behavior.

### 7) `graphql.raw()` now uses validated GraphQL execution semantics
- Replaced direct `execute(...)` usage in `context.graphql.raw()` with `graphql(...)`.
- When callers pass a `DocumentNode`, the runtime now prints it back to source before execution.
- This brings the context GraphQL contract closer to the official Keystone behavior where parsing/validation semantics are preserved.

### 8) Runtime session hydration now respects wrapped session data when available
- Added a dedicated `hydrateCmsSession(...)` step in runtime context creation.
- If the wrapped session strategy already returns hydrated `data`, the runtime now uses that directly instead of always rebuilding session data through the local fallback projector.
- The older `sessionForUser(...)` path remains as a safe fallback for dev-fallback/request-header shims and partial raw sessions.

## Exact files changed

- `src/features/cms/keystone/auth.ts`
- `src/features/cms/auth/graphql.ts`
- `src/features/cms/runtime.ts`
- `src/features/cms/adapters/types.ts`

## Validations run and results

### Required validations
- `npm run lint` ✅ passed
- `npm run build` ✅ passed
- `npm run test:cms:auth` ✅ passed

### Targeted supporting validation
- `npm run test:cms` ✅ passed
- `npm run cms:check` ✅ passed

## Remaining blockers / follow-up notes

This batch intentionally stayed inside auth/context/runtime semantics and did not start the mutation/hook/error-envelope batch.

### Improved materially in this batch
- `sessionData` startup validation
- auth session wrapping behavior
- `authenticatedItem` parity path
- `createInitialUser` parity path
- `graphql.raw()` validation behavior
- auth config validation for identity-field semantics

### Still not fully done
- `createAuth()` still does not replicate the full official `withAuth()` UI/public-pages/page-middleware composition model; the target keeps dashboard/auth gating as app-specific route behavior.
- Session typing is still app-biased even though it is now looser than before.
- Password reset remains custom product surface rather than current-upstream Keystone parity.
- Some auth helper paths (`sendPasswordResetLink`, `redeemPasswordResetToken`) still use lower-level adapter behavior rather than a full db/query parity route.
- This batch did not attempt the broader mutation/access/hook/error-envelope semantics work from the next roadmap slice.

### Important practical note
- The runtime now prefers the wrapped session strategy’s hydrated `session.data` when present. That means future auth behavior should treat `createAuth()` + wrapped `config.session` as the canonical place for `sessionData` semantics, not the older ad hoc runtime reconstruction path.
