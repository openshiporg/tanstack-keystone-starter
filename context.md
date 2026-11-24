# Code Context

## Files Retrieved
1. `/Users/junaid/code/keystone/packages/core/src/types/context.ts` (lines 1-156) - official Keystone context surface for `db`, `query`, `graphql`, `transaction`, `withRequest`, `withSession`, `internal`, `sudo`, and `__internal`.
2. `/Users/junaid/code/keystone/packages/core/src/types/config/access-control.ts` (lines 1-177) - official access-control contracts for list operation/filter/item and field access.
3. `/Users/junaid/code/keystone/packages/core/src/types/config/hooks.ts` (lines 1-521) - official hook contracts and per-operation argument shapes.
4. `/Users/junaid/code/keystone/packages/core/src/lib/context/createContext.ts` (lines 1-129) - official runtime construction of context APIs, schema switching, and transactions.
5. `/Users/junaid/code/keystone/packages/core/src/lib/core/access-control.ts` (lines 1-435; inspected 1-260) - official runtime enforcement patterns, especially sudo short-circuiting and filter validation against GraphQL schema.
6. `/Users/junaid/code/keystone/packages/core/src/lib/core/hooks.ts` (lines 1-110) - official hook execution order and validation aggregation.
7. `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/adapters/types.ts` (lines 1-125) - local `CmsContext`, `db`, `query`, `graphql`, `transaction`, `sudo`, and adapter interfaces.
8. `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/types.ts` (lines 117-287) - local access and hook type contracts.
9. `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/access.ts` (lines 1-343; inspected 1-240 and 214-343) - local runtime access checks, filter validation, field access, and related-item checks.
10. `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/hooks.ts` (lines 1-195) - local hook execution model and deferred `afterOperation` behavior.
11. `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/runtime.ts` (lines 660-679, 1360-1418, 1543-1564) - local context builder, GraphQL API wiring, `db`/`query` population, request/session hydration, and example `context.query` consumer.
12. `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/adapters/prisma.ts` (lines 430-578 and 680-824) - local Prisma adapter mutation flow and adapter-level transactions.
13. `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/adapters/memory.ts` (lines 680-849) - local memory adapter mutation flow and transaction semantics.
14. `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/graphql.ts` (lines 1-14) - public GraphQL entrypoint only; no separate `adapters/graphql.ts` exists.

## Key Code

### Official Keystone baseline

#### Context API contract
`/Users/junaid/code/keystone/packages/core/src/types/context.ts:8-41`
```ts
export type KeystoneContext = {
  db: KeystoneDbAPI<...>
  query: KeystoneListsAPI<...>
  graphql: KeystoneGraphQLAPI
  prisma: TypeInfo['prisma']
  transaction: <T>(f: (context: KeystoneContext) => MaybePromise<T>, options?: {
    maxWait?: number
    timeout?: number
    isolationLevel?: { Serializable: 'Serializable' }
  }) => Promise<T>
  withRequest: ...
  withSession: ...
  internal: () => KeystoneContext
  sudo: () => KeystoneContext
  __internal: { sudo: boolean; lists: Record<string, InitialisedList>; prisma: { DbNull; JsonNull } }
}
```
Key parity expectations:
- typed `db` returns raw items; `query` returns GraphQL-shaped projections via `query` string.
- `transaction` passes a fresh nested context and exposes Prisma transaction options.
- `sudo()` implies `internal: true` and `sudo: true`.

#### Official context runtime
`/Users/junaid/code/keystone/packages/core/src/lib/context/createContext.ts:43-125`
```ts
const context: KeystoneContext = {
  prisma,
  db: {},
  query: {},
  graphql: { raw: rawGraphQL, run: runGraphQL, schema },
  transaction: async (f, opts) => prisma.$transaction(async prisma_ => {
    const newContext = construct({ prisma: prisma_, req, res, session, internal, sudo })
    return await f(newContext)
  }, opts),
  withRequest: async (...) => ...withSession(await config.session?.get({ context: newContext })),
  internal: () => construct({ ..., internal: true, sudo }),
  sudo: () => construct({ ..., internal: true, sudo: true }),
}
for (const listKey of Object.keys(lists)) {
  context.db[listKey] = _dbFactories[listKey](context)
  context.query[listKey] = _queryFactories[listKey](context)
}
```

#### Official access-control contract
`/Users/junaid/code/keystone/packages/core/src/types/config/access-control.ts:5-107`
- list `operation`: boolean only.
- list `filter`: boolean or GraphQL `where` object.
- list `item`: boolean only, with operation-specific args.
- field access: `read/create/update` boolean only.

Important response semantics are documented in `access-control.ts:108-141`:
- denied single mutations: `null` + access error.
- denied multi mutations: per-item `null` + per-item errors.
- denied single queries: `null` without errors.
- denied many queries/count: silently filtered.

#### Official runtime access enforcement
`/Users/junaid/code/keystone/packages/core/src/lib/core/access-control.ts:68-180`
- every helper short-circuits under `context.__internal.sudo`.
- `getAccessFilters()` validates returned filter shape against the GraphQL `where` input type using `context.sudo().graphql.schema` and `coerceAndValidateForGraphQLInput(...)`.
- errors are wrapped with tagged `extensionError(...)` and invalid returns become `accessReturnError(...)`.

#### Official hooks contract and runtime
`/Users/junaid/code/keystone/packages/core/src/types/config/hooks.ts:12-521`
- list/field hooks are operation-scoped objects or single functions.
- hook args differ by operation; delete hooks receive `inputData/resolvedData` as `undefined`.
- validation hooks receive `addValidationError`.
- after hooks receive both `item` and `originalItem`, with delete `item: undefined`.

`/Users/junaid/code/keystone/packages/core/src/lib/core/hooks.ts:4-110`
```ts
await hook({ ...hookArgs, addValidationError, fieldKey, itemField, inputFieldData, resolvedFieldData })
...
await list.hooks[hookName][operation](args)
```
Execution properties:
- field validation runs for all fields; errors aggregate.
- before/after field hooks run only for fields present in original create/update input; delete runs for all fields.
- list hooks run after field hooks.

### Local CMS runtime

#### Local context contract
`/Users/junaid/code/tanstack-keystone-starter/src/features/cms/adapters/types.ts:34-93`
```ts
export type CmsContext = {
  adapter: CmsAdapter
  db: Record<string, CmsContextListDbApi>
  query: Record<string, CmsContextListQueryApi>
  prisma: unknown | null
  graphql: CmsGraphQLApi
  session?: CmsSession
  transaction: <T>(fn: (context: CmsContext) => Promise<T>) => Promise<T>
  __internal: {
    sudo: boolean
    internal: boolean
    lists?: CmsList[]
    request?: Request
    responseHeaders?: Headers
    mutationState?: CmsMutationState
    deferAfterOperation?: boolean
  }
  internal: () => CmsContext
  sudo: () => CmsContext
  withRequest: ...
  withSession: ...
}
```
Differences vs official:
- untyped `Record<string, ...>` APIs instead of list-keyed mapped types.
- no transaction options.
- no `req/res`; uses Fetch `Request`/`Headers`.
- no `sessionStrategy` generics, no `__internal.prisma.DbNull/JsonNull`.

#### Local context runtime
`/Users/junaid/code/tanstack-keystone-starter/src/features/cms/runtime.ts:1371-1418`
```ts
const context: CmsContext = {
  adapter,
  db,
  query,
  prisma: adapter.prisma ?? null,
  graphql: graphqlApi,
  session,
  sessionStrategy: cmsConfig.session,
  transaction: async (fn) => withAdapterTransaction(context, fn),
  __internal: { sudo, internal, lists, request, responseHeaders },
  internal: () => buildCmsContext({ ..., internal: true, schema: getCmsGraphQLSchema('internal') }),
  sudo: () => buildCmsContext({ ..., sudo: true, internal: true, schema: getCmsGraphQLSchema('internal') }),
  withRequest: async (...) => { ...cmsConfig.session?.get({ context: sessionStrategyContext })... },
  withSession: (replacementSession) => buildCmsContext({ ..., session: replacementSession, ... }),
}
for (const list of runtimeLists) {
  db[list.key] = buildContextDbApi(list, context, internal ? 'internal' : 'public')
  query[list.key] = buildContextQueryApi(list, context, namesByListKey, internal ? 'internal' : 'public')
}
```
Strong parity:
- same lazy context shape population pattern.
- `sudo()` also forces internal schema.
- `withRequest()` re-hydrates session from session strategy.

Gap:
- `transaction` delegates to adapter helper, not a canonical Prisma-context rebuild with options.

#### Local access types
`/Users/junaid/code/tanstack-keystone-starter/src/features/cms/types.ts:117-159`
```ts
export type CmsOperationAccessControl = boolean | ((args: CmsOperationAccessArgs) => boolean | Promise<boolean>)
export type CmsFilterAccessControl = boolean | Record<string, unknown> | ((args: CmsFilterAccessArgs) => boolean | Record<string, unknown> | Promise<boolean | Record<string, unknown>>)
export type CmsItemAccessControl = boolean | ((args: CmsItemAccessArgs) => boolean | Promise<boolean>)
export type CmsFieldAccessControl = boolean | ((args: CmsFieldAccessArgs) => boolean | Promise<boolean>)
export type CmsListAccess = {
  operation?: Partial<Record<CmsListAccessOperation, CmsOperationAccessControl>>
  filter?: Partial<Record<CmsListFilterOperation, CmsFilterAccessControl>>
  item?: Partial<Record<CmsListItemOperation, CmsItemAccessControl>>
}
```
Parity:
- same high-level access dimensions: operation/filter/item/field.

Gaps:
- no official-style single function overload for whole-list access object.
- arg shapes are simplified and less operation-specific than Keystone’s discriminated types.

#### Local access runtime
`/Users/junaid/code/tanstack-keystone-starter/src/features/cms/access.ts:34-176`
- `isSudoContext()` short-circuits all access checks.
- `getOperationAccess`, `getAccessFilter`, `getItemAccess`, `getFieldAccess` mirror official helper layering.
- local filter validation is custom recursive shape checking, not GraphQL-input coercion.

`/Users/junaid/code/tanstack-keystone-starter/src/features/cms/access.ts:273-316`
```ts
export async function assertFilterAccess(...) {
  ...
  const configured = filterEnabled ?? field.isFilterable
  const allowed = typeof configured === 'function'
    ? await evaluateAccessValue(configured, { context, session: context.session, listKey, fieldKey, field, operation }, phase)
    : configured
  if (allowed === false) throw filterDenied(...)
}
```
This adds field-level filterability guards absent from the official `types` contract, but still does not replicate official GraphQL-schema coercion.

#### Local hooks types
`/Users/junaid/code/tanstack-keystone-starter/src/features/cms/types.ts:213-270`
```ts
export type CmsListHooks = {
  resolveInput?: CmsListResolveInputHook
  validateInput?: CmsListValidationHook
  validateDelete?: CmsListValidationHook
  beforeOperation?: CmsListOperationHook
  afterOperation?: CmsListAfterOperationHook
}
```
Main divergence:
- local hook API is flatter and renamed (`validateInput`, `validateDelete`) instead of operation-partitioned `validate.{create|update|delete}`.
- no `addValidationError`; hooks must throw.
- field/list hook args do not expose `itemField`, `inputFieldData`, `resolvedFieldData`, or `originalItemField` at the type level.

#### Local hooks runtime
`/Users/junaid/code/tanstack-keystone-starter/src/features/cms/hooks.ts:58-195`
- `resolveInputForMutation()` runs all non-id/non-virtual field hooks, not just fields present in input.
- `validateResolvedInput()` and `runBeforeOperationHooks()` only run field hooks for fields included in original input, matching official create/update field scoping.
- delete validation and before hooks run all concrete fields.
- `runOrDeferAfterOperationHooks()` can defer after hooks through `mutationState`, a local extension with no direct official analogue.

#### Local db/query/graphql usage
- `context.query[...]` is actively used by runtime hydration logic: `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/runtime.ts:660-679`.
- auth uses `context.db`/`context.query`/`context.sudo()` heavily: grep hits in `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/auth/graphql.ts` and `/keystone/auth.ts`.
- `src/features/cms/graphql.ts:1-14` is only a GraphQL Yoga wrapper; there is no `src/features/cms/adapters/graphql.ts` file, so any requested parity work against that path is blocked by missing local target.

#### Local transaction behavior
Prisma adapter: `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/adapters/prisma.ts:554-560`
```ts
async transaction(fn) {
  if (options.inTransaction || typeof prisma.$transaction !== 'function') return fn(adapter)
  return prisma.$transaction(async (transactionPrisma) => {
    const transactionAdapter = createPrismaCmsAdapter({ prisma: transactionPrisma as PrismaClient, lists, inTransaction: true })
    return fn(transactionAdapter)
  })
}
```
Memory adapter: `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/adapters/memory.ts:809-823`
```ts
async transaction(fn) {
  const storeSnapshot = cloneStore(store)
  ... rollback on error ...
}
```
Context-level transaction wraps adapter transaction via `withAdapterTransaction(context, fn)` from runtime, meaning semantics depend on adapter implementation rather than Keystone-style direct context reconstruction around Prisma.

## Architecture
- Official Keystone centralizes runtime truth in `KeystoneContext`: GraphQL schema choice, Prisma client, and list API factories are all rebuilt together in `createContext()`. Access and hooks assume that context contract and use `context.sudo()` for internal validation and access bypass.
- Local CMS mirrors that overall layering:
  - `runtime.ts` builds `CmsContext`, `graphql.raw/run`, and per-list `db`/`query` APIs.
  - `access.ts` is the enforcement layer consumed by adapters and GraphQL resolvers.
  - `hooks.ts` is the mutation hook executor used by both `adapters/memory.ts` and `adapters/prisma.ts`.
  - adapter implementations are the actual mutation/read engines; they call access + hooks helpers and power context transactions.
- The biggest architectural mismatch is that local parity is behavioral, not contract-level:
  - official contracts are operation-discriminated and strongly typed.
  - local contracts are mostly `Record<string, unknown>` and simplified hook shapes.
  - official filter validation is GraphQL-schema-based; local validation is hand-written recursive checking.

## Blocker ranking
1. **Critical blocker: hook API mismatch**  
   Official hook surface in `/keystone/.../types/config/hooks.ts` is operation-scoped with richer args and `addValidationError`; local `/src/features/cms/types.ts` + `/hooks.ts` use a different API (`validateInput`, `validateDelete`, flat signatures). Any runtime parity claim for hooks is blocked until the public/local API shape is redesigned or a compatibility layer is introduced.
2. **High blocker: transaction API/semantics mismatch**  
   Official `context.transaction` supports Prisma options and always rebuilds a fresh nested context around transaction Prisma. Local `CmsContext.transaction` exposes no options and depends on adapter-specific transaction wrappers. This blocks parity for context transaction API and some nested semantic expectations.
3. **High blocker: access filter validation mismatch**  
   Official runtime validates access filters by coercing against GraphQL `where` input types via `context.sudo().graphql.schema`; local runtime performs manual recursive validation only. This can diverge on nullability, nested types, enum coercion, singleton nuances, and future schema changes.
4. **Medium blocker: context typing/metadata mismatch**  
   Local `CmsContext` lacks official mapped list typing, `req/res` shape, and `__internal.prisma.DbNull/JsonNull`. This is less likely to block basic behavior but blocks contract-level parity and some advanced integrations.
5. **Medium blocker: missing local target path**  
   Requested local path included `src/features/cms/adapters/graphql`, but no such file exists; only `src/features/cms/graphql.ts` exists. Any parity task scoped to that exact path is blocked until the correct local target is identified.
6. **Low/behavioral blocker: after-operation deferral extension**  
   Local deferred `afterOperation` execution via `mutationState` has no direct official equivalent. It may be beneficial, but it means timing semantics can differ from Keystone in nested mutations.

## Start Here
Open `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/types.ts` first. It is the narrowest choke point because the largest parity blockers come from local public contract differences for access, hooks, and context. If those types are not realigned, runtime helper changes in `access.ts`, `hooks.ts`, `runtime.ts`, and adapters cannot reach true Keystone parity.