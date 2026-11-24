# Context Factory / Initialised-List Delta Audit

## Scope

This audit compares:

- Keystone upstream factory/context path:
  - `/Users/junaid/code/keystone/packages/core/src/lib/context/api.ts`
  - `/Users/junaid/code/keystone/packages/core/src/lib/context/graphql.ts`
  - `/Users/junaid/code/keystone/packages/core/src/lib/core/initialise-lists.ts`
- Local TanStack/CMS path:
  - `src/features/cms/runtime.ts`
  - `src/features/cms/config.ts`
  - `src/features/cms/adapters/types.ts`

This is a static/source-backed delta audit only. It does **not** claim DB-backed provider parity.

---

## What is now materially aligned

### 1. Factory caching shape is now closer

Upstream Keystone:
- `getDbFactory(...)` builds a local `fcache` of field executors once per list/schema factory.
- `getQueryFactory(...)` also builds a local `fcache` once per list/schema factory.

Local runtime:
- `buildContextDbApi(...)` now builds a local `fcache` of schema-derived executors.
- `buildContextQueryApi(...)` now builds a local `fcache` of query/mutation wrappers.
- core non-count query/mutation methods now use a local `makeContextQueryFn(...)`-style schema-derived helper path.

Evidence:
- `src/features/cms/runtime.ts`
- `scripts/validate-cms-context-db.ts`

### 2. `context.db` rootValue seam is now present and behaviorally proven

Upstream Keystone:
- `makeContextDbFn(...)` accepts `rootValue` and forwards it into `execute(...)`.

Local runtime:
- `makeContextDbFn(...)` now accepts `rootValue`.
- It forwards `rootValue` into `execute(...)`.
- Focused validator behaviorally proves a resolver sees non-empty rootValue.

Evidence:
- `src/features/cms/runtime.ts:1134-1141`
- `scripts/validate-cms-context-db.ts`

### 3. Singleton default semantics are not a remaining mismatch

Upstream Keystone:
- singleton item query defaults to `{ id: '1' }`
- singleton count query defaults to `{ id: { equals: '1' } }`
- singleton create mutates data to force `id: 1` at the DB layer

Local runtime:
- `effectiveWhereUnique(...)` falls back to singleton `{ id: '1' }`
- `effectiveCountWhere(...)` falls back to singleton `{ id: { equals: '1' } }`
- local singleton validation already proves default item/count behavior and canonical singleton id behavior

Evidence:
- Keystone:
  - `packages/core/src/lib/core/queries/index.ts:9-17`
  - `packages/core/src/lib/core/queries/index.ts:40-48`
  - `packages/core/src/lib/core/mutations/index.ts:94-101`
- Local:
  - `src/features/cms/runtime.ts:934-950`
  - `scripts/validate-cms-singleton.ts`

### 4. Numeric-id wrapper boundaries are narrowed

Local runtime now allows string-or-number ids across:
- `CmsWhereUnique`
- `FindManyArgs.cursor`
- `context.db` wrappers
- `context.query` wrappers
- relationship cursor args

This does not finish DB-backed parity, but it removes stale string-only wrapper assumptions.

Evidence:
- `src/features/cms/adapters/types.ts`
- `src/features/cms/runtime.ts:1210-1221`
- `src/features/cms/runtime.ts:1255-1264`

---

## Remaining exact factory / initialized-list gaps

### A. Keystone factories are driven by `InitialisedList`; local factories are driven by local `CmsList`

Upstream:
- `getDbFactory(list: InitialisedList, schema)`
- `getQueryFactory(list: InitialisedList, schema)`

Local:
- `buildContextDbApi(list: CmsList, context, kind)`
- `buildContextQueryApi(list: CmsList, context, namesByListKey, kind)`

Why it matters:
- Keystone’s list object carries the full initialized field graph, resolved DB fields, GraphQL type graph, searchable field introspection, hook parsing, provider-specific metadata, and action/list metadata in one canonical initialized structure.
- Local runtime reconstructs behavior from a smaller normalized config/list model plus the executable schema.

Status:
- **Not resolved**.
- This is the biggest remaining architectural gap in the context factory path.

### B. Exact generated API/type parity is still not present

Upstream:
- factory output is effectively anchored to initialized Keystone list metadata and its generated GraphQL/types ecosystem.

Local:
- `CmsContextListDbApi` and `CmsContextListQueryApi` are hand-written TypeScript shapes.
- They are closer now, but not generated from an initialized-list/type graph.

Status:
- **Not resolved**.
- This is mostly type architecture rather than a small runtime bug.

### C. `context.query` execution helper parity is materially narrowed

Upstream:
- `makeContextQueryFn(schema, operation, field)` constructs a validated AST per call from the provided selection string and executes against the schema.
- `getQueryFactory(...)` uses that helper for core non-count methods.
- `count` remains a direct query-string special case in upstream Keystone.

Local:
- local runtime now defines and exports `makeContextQueryFn(...)`.
- `buildContextQueryApi(...)` now uses schema-derived fields plus local `makeContextQueryFn(...)` for core non-count methods.
- local focused validation now behaviorally proves:
  - default selection falls back to `id`
  - explicit `query: 'id label'` selection works
  - undefined optional args are filtered and execution still succeeds
- local `count` remains on the direct query-string path, which matches Keystone’s special-case shape rather than diverging from it.

Status:
- **Substantially narrowed**.
- Remaining gaps are no longer “missing query helper” or “count still direct.”
- Remaining gaps are deeper architecture/type/lifecycle parity around `CmsList` vs `InitialisedList`, generated API shapes, and DB-backed proof.

### D. Factory caching scope is still only locally similar, not proven identical

Upstream:
- `getDbFactory(...)` / `getQueryFactory(...)` build `fcache` around initialized list + schema factory creation.

Local:
- caching is per `buildContextDbApi(...)` / `buildContextQueryApi(...)` call, which occurs during `buildCmsContext(...)` list API construction.

Status:
- **Partially narrowed, not resolved**.
- This is probably acceptable behaviorally for many paths, but it is not yet proven equivalent to Keystone’s exact factory lifecycle.

### E. Local public/internal omit behavior is close but not proven identical to the initialized-list path

Upstream:
- omit behavior is an initialized-list concern deeply wired into the GraphQL graph and list metadata.

Local:
- many omit paths are now validated, but the factory still hangs off local schema/list wiring rather than upstream initialized-list structures.

Status:
- **Partially narrowed, not resolved**.

### F. DB-backed proof is still missing

Even where source parity is now stronger, we still do **not** have real Prisma/database evidence in-session for:
- context.db with autoincrement ids
- context.query with autoincrement ids
- nested relationship traversal/filtering
- Decimal/BigInt provider-native execution semantics
- exact rootValue/provider interactions in Prisma-backed flows

Status:
- **Not resolved** until `DATABASE_URL` is available and `scripts/validate-cms-prisma.ts` (and likely more focused Prisma validations) can run.

---

## Smallest honest next implementation direction

The previously recommended `makeContextQueryFn(...)` implementation slice is now **done**.

If continuing static/code-backed work before DB-backed proof is available, the next meaningful runtime step is no longer another tiny query-helper change.

### Current remaining decision point

Choose between:

1. **architecture path**
   - move more of the local factory/list metadata model toward a Keystone-like initialized-list graph, or
2. **proof path**
   - wait for a configured Prisma database and collect DB-backed execution evidence for the remaining provider/runtime gaps.

Important clarification:
- `context.query.count` staying on a direct query-string path is **not** a remaining mismatch by itself, because upstream Keystone also special-cases `count` that way in `getQueryFactory(...)`.

---

## Completion relevance

This audit is additional evidence that:
- dashboard non-document parity remains effectively at deferred final manual browser verification,
- but runtime/core is still **not** at full parity,
- because the context factory path still has real architectural deltas and we still lack DB-backed proof.
