# Core 6.5.1 context/access/hooks/error reconciliation

## Scope and constraints

Owned surfaces: applicable Core 6.5.1 context APIs, access callback failures/return validation, mutation hook ordering/failures, and one/many mutation error/state behavior. Auth, document, `src/features/cms/keystone/core.ts`, storage, AdminMeta, and Prisma generation were not edited.

The pinned executable oracle remains `scripts/validate-keystone-differential.mjs`. It creates an isolated temporary install containing exact `@keystone-6/core@6.5.1`, builds a real Keystone schema and SQLite Prisma client, runs `scripts/fixtures/keystone-differential-oracle.cjs`, runs the local fixture, exact-compares their JSON artifacts, and deletes the install. It does not add Keystone as a repository dependency.

## Reconciliation result

### Exact-oracle coverage

The pinned differential passes for public access denial envelopes/state, nested related-list access and counts, inaccessible cursors, filtering/order/pagination, both `context.query` and `context.db`, thrown/invalid access callbacks, every mutation hook phase, phase ordering/error paths, ordered many errors/data, and persisted DB state. This exercises real Core 6.5.1 and real SQLite on the oracle side. Common contracts are exact-compared; the two intentional stronger local guarantees below are asserted explicitly rather than hidden by normalization.

### Access and hooks

Focused executable probes confirm:

- thrown access callbacks are wrapped/tagged at their exact access phase;
- non-boolean operation/item/field access values and invalid filter values use the local structured access-return failure path;
- field hook phases execute concurrently as Core does;
- field failures aggregate with field/phase tags;
- validation errors aggregate field errors before the list validation error;
- before/after field phases complete and preserve the expected phase boundary.

Evidence: `scripts/validate-cms-access-parity.mjs`, `scripts/validate-cms-hook-parity.ts`, and the existing mutation/access/hook validators.

### One/many mutations and state

The runtime returns the same ordered many data and error-code sequence as Core for the mixed success/before/validation/after failure oracle. Core starts many item pipelines concurrently; local runs complete item pipelines in input order. The oracle now asserts both order traces explicitly. Core persists an item when its `afterOperation` hook throws, while local rolls that item back; the probe proves Core persists `after-bad` and `good`, while local persists only `good`. The stronger documented local atomic mutation guarantee was deliberately preserved. Context `db`/`query` many failures retain resolver tags through `wrapManyContextFailure`.

### Context APIs

Added `scripts/validate-cms-context-semantics.ts`, covering executable local semantics for:

- `graphql.raw` data envelopes;
- `graphql.run` data unwrapping and throwing on GraphQL errors;
- `sudo()` and `internal()` flags/session retention;
- `withSession()` replacement/removal;
- request and response-header retention;
- transaction context construction;
- `prisma` passthrough from the active adapter;
- custom/local list registry and schema retention inside transactions.

`withRequest` remains the request/session-strategy rehydration API already covered by the auth/context validators; auth itself was explicitly out of scope. Core 6.5.1 does not provide every local convenience with identical naming/lifecycle, so stronger documented local APIs were retained where no applicable exact Core oracle exists.

## Genuine runtime gap fixed

`contextWithAdapter()` rebuilt transaction contexts without forwarding `context.__internal.lists`. A transaction created from an ad-hoc/custom list registry could therefore silently switch to the process-global registry while retaining the caller's schema. This could break `transactionContext.db/query` or pair the wrong metadata with the schema.

Fixed `src/features/cms/runtime.ts` to retain the caller-local list registry. The new context probe fails before this fix and now proves transaction-local `query.ContextProbe` execution.

## Verification

Passed:

- `npm run test:cms:differential` — exact Core 6.5.1 oracle/local comparison, including access throws/invalid returns, hook phases/order/errors, ordered many errors/data, and atomic persisted-state assertions
- `npm run test:cms:access:parity` — memory and Prisma access parity probe
- `npm run test:cms:hooks:parity` — hook concurrency/error aggregation probe
- `npx --no-install tsx scripts/validate-cms-context-semantics.ts`
- `npx tsc --noEmit`
- `npx eslint src/features/cms/runtime.ts scripts/validate-cms-context-semantics.ts`

## Files changed

- `src/features/cms/runtime.ts`
- `scripts/validate-cms-context-semantics.ts`
- `scripts/validate-keystone-differential.mjs`
- `scripts/fixtures/keystone-differential-oracle.cjs`
- `scripts/fixtures/keystone-differential-local.ts`
- `package.json`
- `reports/keystone-parity/CONTEXT-WORKER.md`
