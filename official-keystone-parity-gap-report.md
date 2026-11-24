# Official Keystone vs tanstack-keystone-starter backend parity gap report

Date: 2026-05-11  
Scope: backend/runtime parity only. Excludes Keystone Admin UI React app, Keystone Next/server runner, branding/UI. Includes Keystone-like config/list/field DSL, initialization, GraphQL schema/resolvers, context, access/hooks, sessions/auth primitives, Prisma/codegen, storage/upload, `extendGraphqlSchema`, and Yoga integration.

## 1. Executive summary

The TanStack CMS runtime has moved past a pure `adminMeta` facade: it now has a registry for the four starter lists, generated CRUD SDL, in-memory and first-pass Prisma adapters, relationship resolution, basic filters/ordering, operation/filter access approximations, and a GraphQL Yoga route. It is still **not Keystone-compatible as a public backend runtime** because it lacks the public Keystone DSL, default resolution, initialized field factory architecture, real hooks lifecycle, many mutations, nested create/update/delete relationship inputs, Keystone context APIs, auth/session mutations, schema/codegen pipeline, and true storage/upload behavior.

Approximate parity by subsystem:

| Subsystem | Current status | Approx. parity | Notes |
|---|---:|---:|---|
| GraphQL Yoga route | Done | 80% | `/api/graphql` is wired to Yoga with CMS context. Missing multipart upload/session request-response semantics. |
| Starter list coverage | Partial/done for fixed models | 70% | `Todo`, `User`, `Role`, `TodoImage` are represented in `src/features/cms/registry.ts`, but not authored through Keystone DSL. |
| AdminMeta | Partial | 55% | Dynamic from registry, enough for dashboard metadata; not produced from initialized Keystone-style field factories and lacks full UI/access dynamics. |
| CRUD GraphQL schema | Partial | 45% | Generates list/item/count and single create/update/delete for all lists. Missing many mutations, full type shapes, omit/isEnabled semantics, upload/image/password/document-specific types. |
| Data adapters | Partial | 35% | Memory adapter is usable; Prisma adapter is first-pass and model-specific. No dynamic adapter generated from initialized lists or schema printer. |
| Filters/orderBy | Partial | 30% | Basic scalar/relationship filters exist. Missing field-owned resolver semantics, unique filters beyond id, filter/order access checking, many official operators/details. |
| Relationships/nested writes | Partial | 30% | Output and connect/disconnect/set are implemented. Missing nested `create`/nested update/delete, existence validation parity, transaction/afterOperation queue. |
| Access control | Partial | 25% | Hard-coded starter rules approximate operation/filter/field write access. Missing public list/field/action access config and Keystone validation/error semantics. |
| Hooks lifecycle | Minimal | 10% | Only Todo `assignedTo` default is hard-coded. Missing Keystone lifecycle (`resolveInput`, `validate*`, `beforeOperation`, `afterOperation`) at field/list levels. |
| Context API | Minimal | 15% | Has `session`, `sudo()`, `withSession()`, adapter. Missing `db`, `query`, `prisma`, `graphql.raw/run/schema`, `withRequest`, transaction semantics and true sudo/internal schema. |
| Public config/list/group DSL | Missing | 5% | No `config()`, `list()`, `group()`, field factories, `resolveDefaults()`, initialized lists. |
| Field factories/metadata | Partial fixed registry | 20% | Field kinds exist as registry entries; not Keystone factories that return DB/input/output/admin fragments. Password/image/document are stubs. |
| Auth/sessions | Missing/prototype | 10% | Dev fallback session and `x-cms-user-id` header only. No stateless cookie sessions, `createAuth` mutations, `authenticatedItem`, init-first-item, password compare. |
| Prisma schema/migrations/codegen | Partial fixed schema | 20% | Hand-authored four-model `prisma/schema.prisma`, seed, scripts. No registry/config-driven Prisma schema printer, GraphQL schema artifact, generated types. |
| Storage/upload/image/file/document | Stub | 10% | Image/document stored as JSON metadata. No Upload scalar input, local/S3 strategy, Keystone image output type, file/document behavior. |
| `extendGraphqlSchema` | Missing | 0% | No config-level extension hook; source starter’s `redirectToInit` cannot be expressed. |

Overall backend parity estimate: **~30% for the fixed starter CRUD demo; ~15–20% for Keystone-like configurable runtime parity.**

## 2. Detailed comparison table

| Official Keystone subsystem | Official source paths | Current target files | Status | Notes |
|---|---|---|---|---|
| Public `config`, `list`, `group` and config defaults | `/Users/junaid/code/keystone/packages/core/src/schema.ts:18-73`, `:86-160` | `src/features/cms/registry.ts`, `src/features/cms/types.ts` | Missing | Keystone validates reserved `fields.id`, injects default id field, sets db/graphql/server/ui defaults. Target has a hand-authored `cmsLists` array and no public Keystone-compatible authoring DSL. |
| Runtime pipeline/system creation | `/Users/junaid/code/keystone/packages/core/src/lib/system.ts:147-195` | `src/features/cms/graphql.ts`, `src/features/cms/runtime.ts`, `src/features/cms/adapters/*` | Partial | Keystone does `initialiseLists -> createAdminMeta -> public/internal schemas -> createContext`. Target directly generates SDL from registry and creates Yoga schema/context; no initialized list model or internal/sudo schema. |
| Internal/sudo GraphQL schema | `/Users/junaid/code/keystone/packages/core/src/lib/system.ts:58-97` | `src/features/cms/runtime.ts:437-452`, `src/features/cms/adapters/types.ts:27-32` | Missing/incorrect | Keystone builds internal schema with omit disabled and filter/order enabled, and `context.sudo()` sets internal+sudo. Target `sudo()` just shallow-copies context/session and does not bypass access. |
| Initialize lists and compose field fragments | `/Users/junaid/code/keystone/packages/core/src/lib/core/initialise-lists.ts:54-130`, `:332-630`, `:643-706`, `:949-957` | `src/features/cms/runtime.ts:206-356`, `src/features/cms/registry.ts` | Partial/missing architecture | Target has functions for output/input/filter/order SDL, but not Keystone’s field factory call (`fieldFunc({ fieldKey, listKey, lists, provider, getStorage })`), field-owned DB/input/output/hook/admin fragments, or relationship DB resolution pass. |
| GraphQL schema composition and extension | `/Users/junaid/code/keystone/packages/core/src/lib/graphql.ts:26-56`, `:59-82` | `src/features/cms/runtime.ts:359-392`, `src/features/cms/graphql.ts:5-13` | Partial | Target composes Query/Mutation SDL for registry and includes `keystone.adminMeta`. Missing `config.graphql.extendGraphqlSchema` and official type inclusion/order behavior. |
| Queries | `/Users/junaid/code/keystone/packages/core/src/lib/core/queries/index.ts:6-66`, resolvers `/queries/resolvers.ts:75-160`, `:208-235` | `src/features/cms/runtime.ts:475-493`; adapters | Partial | Target has item/list/count. Missing maxTake, default args, filter/order access checking, field-owned input resolvers, cache hints, official error behavior. |
| Single mutations | `/Users/junaid/code/keystone/packages/core/src/lib/core/mutations/index.ts:687-786` | `src/features/cms/runtime.ts:495-506`; adapters | Partial | Target has create/update/delete one. Missing list/item/field access architecture, lifecycle order, transform for multi DB fields, official errors. |
| Many mutations | `/Users/junaid/code/keystone/packages/core/src/lib/core/mutations/index.ts:703-719`, `:741-767`, `:788-854` | none | Missing | No `createTodos`, `updateTodos`, `deleteTodos` or `UpdateManyInput` generation. High-impact gap for Keystone/Admin-like clients. |
| Mutation input resolution and hooks | `/Users/junaid/code/keystone/packages/core/src/lib/core/mutations/index.ts:574-617` plus `fields/resolve-hooks.ts` | `src/features/cms/adapters/memory.ts:508-516`, `:536-587`; `src/features/cms/adapters/prisma.ts:130-153` | Mostly missing | Target hard-codes `Todo.assignedTo` default and basic validation. Keystone resolves field inputs, relationship inputs, field/list hooks, validation, before/after, nested afterOperation queue. |
| Nested relationship inputs | `/Users/junaid/code/keystone/packages/core/src/lib/core/initialise-lists.ts:574-626`; `/mutations/nested-mutation-one-input-resolvers.ts`; `/mutations/nested-mutation-many-input-resolvers.ts:39+` | `src/features/cms/runtime.ts:337-355`; `src/features/cms/adapters/memory.ts:481-506`; `src/features/cms/adapters/prisma.ts:109-128` | Partial | Target supports connect/disconnect/set. Missing nested `create`, nested update/delete, official ordering of operations, `RelationshipErrors`, existence/access checks for nested mutations. Note target includes `set` on create, which official relate-to-many create has in current source. |
| Where input resolution | `/Users/junaid/code/keystone/packages/core/src/lib/core/where-inputs.ts:15-96`, `:98-126` | `src/features/cms/runtime.ts:37-87`, `:242-254`; `src/features/cms/adapters/memory.ts:331-347`; `src/features/cms/adapters/prisma.ts:157-200` | Partial | Target maps common filters and recursive relationship filters. Missing field-owned `.input.where.resolve`, `coerceAndValidateForGraphQLInput`, provider-specific filters, exact AND wrapping and null semantics for many relations. |
| Filter/order access | `/Users/junaid/code/keystone/packages/core/src/lib/core/filter-order-access.ts:4-40`; used in query resolvers | `src/features/cms/runtime.ts:23-24`, `:257-300` | Mostly missing | Target hides nonfilterable/nonorderable fields from SDL but does not run Keystone dynamic `isFilterable/isOrderable` functions or produce official access errors. |
| Access control | `/Users/junaid/code/keystone/packages/core/src/lib/core/access-control.ts:72-155`, `:157-260+` | `src/features/cms/runtime.ts:455-473`; `src/features/cms/adapters/memory.ts:349-391`, `:430-436`; `src/features/cms/adapters/prisma.ts:208-242` | Partial/hard-coded | Starter rules are embedded in code. Missing config-driven `access.operation`, `access.filter`, `access.item`, field read/create/update access, actions, sudo bypass, access return validation. |
| Context API | `/Users/junaid/code/keystone/packages/core/src/lib/context/createContext.ts:18-141`; `/context/api.ts` | `src/features/cms/adapters/types.ts:27-32`; `src/features/cms/runtime.ts:437-452` | Mostly missing | Target context lacks `db`, `query`, `prisma`, `graphql.raw/run/schema`, `transaction`, `withRequest`, `sessionStrategy`, `req/res`, `internal()`, `__internal`. |
| Session strategy | `/Users/junaid/code/keystone/packages/core/src/session.ts:1-151` | `src/features/cms/runtime.ts:418-452` | Missing/prototype | Keystone supports Iron-sealed stateless/stored sessions from cookies/Bearer and sets response cookies. Target uses dev fallback `user_admin`, optional `x-cms-user-id`, and no cookie/session strategy. |
| Auth primitives | `/Users/junaid/code/keystone/packages/auth/src/gql/getBaseAuthSchema.ts:1-111` | none | Missing | No `authenticatedItem`, `authenticateUserWithPassword`, `endSession`, init-first-item, password reset, or KDF compare. |
| Field factories | `/fields/types/*/index.ts` (e.g. text, checkbox, integer, float, decimal, bigInt, timestamp, json, select, multiselect, relationship, password, image, file, virtual) | `src/features/cms/types.ts:1-35`; `src/features/cms/registry.ts`; adapter coercion/validation | Partial registry only | Target has field kinds and some validation/defaults, not factory functions that return DB fields, GraphQL args, hooks, output resolvers, `getAdminMeta`. |
| Text field behavior | `/fields/types/text/index.ts:1-120+` | `src/features/cms/adapters/memory.ts:411-414`, `src/features/cms/registry.ts` | Partial | Required validation only. Missing nullable/default empty string semantics, length/match validation, uniqueWhere for indexed unique, admin meta details, mode-insensitive filters. |
| Password field behavior | `/fields/types/password/index.ts:1-120+` | `src/features/cms/runtime.ts:31-33`, `:510-512`; `prisma/schema.prisma:14`, `:48` | Stub | Target stores booleans and outputs `{ isSet }`; no bcrypt hash, validation, `PasswordFilter { isSet }`, secret compare, no raw string storage. |
| Relationship field behavior | `/fields/types/relationship/index.ts:1-160+`; `/lib/core/resolve-relationships.ts` | `src/features/cms/registry.ts:78-79`, `:120-121`, `:139`, `:158`; adapters relationship functions | Partial | Fixed refs work. Missing validation/ownership of all relationships, one-sided relationship support, Prisma relation naming, relationship field admin meta/search filters. |
| Image/file/storage | `/fields/types/image/index.ts:1-120+`; `/lib/assets/createImagesContext.ts`, `createFilesContext.ts` | `src/features/cms/registry.ts:77`, `:155`; `prisma/schema.prisma:49`, `:58` | Stub | Target represents image as JSON. Keystone image uses Upload input, metadata columns, storage strategy URL resolver, local/S3. File/document similarly absent/stubbed. |
| Prisma schema/artifacts | `/lib/core/prisma-schema-printer.ts:1-80+`; `/artifacts.ts:1-96` | `prisma/schema.prisma`, `prisma/seed.ts`, `package.json` db scripts | Partial fixed | Hand-authored four-model schema and seed exist. No config/list-driven Prisma printer, GraphQL schema artifact, generated TS types, artifact validation, migration wrapper. |
| Yoga integration | Keystone uses its own server/Express path; target should embed in TanStack | `src/features/cms/graphql.ts:5-13`; `src/routes/api/graphql.ts` | Mostly done | Yoga is correctly embedded in TanStack Start. Needs upload/multipart and real request/session response integration later. |

## 3. Exact missing pieces in priority order

1. **Implement many mutations and adapter bulk operations (highest-impact schema parity).** Add `<List>UpdateManyInput`, `create<ListPlural>`, `update<ListPlural>`, `delete<ListPlural>` to generated SDL/resolvers for every list. Preserve Keystone names from `getGraphQLNames`. Use official behavior from `/lib/core/mutations/index.ts:703-854`: many mutations return lists, process each operation independently with ordered promise/error behavior. This immediately closes a visible GraphQL API gap.
2. **Refactor toward a small initialized-list layer.** Introduce a runtime metadata object between registry/DSL and GraphQL generation: list names, fields by key, `isEnabled`, input/output/filter/order fragments, access hooks, DB metadata. Do not try to port full Keystone in one step; start by moving current hard-coded helpers into field-owned methods.
3. **Add Keystone-like public DSL for target-owned config.** Implement `config()`, `list()`, `group()`, and source-starter field factories under `src/features/cms/fields/*`. Initial factories can produce the current registry-compatible metadata, then later richer initialized fields. Required first fields: text, checkbox, integer, float, decimal, bigInt, timestamp, json, select, multiselect, relationship, password, image/document stubs.
4. **Move access rules out of hard-coded runtime/adapter code.** Represent `access.operation`, `access.filter`, and field access in list/field metadata and evaluate them generically. Keep current starter rules as configured functions. Add sudo bypass that actually bypasses operation/filter/field access.
5. **Implement hook lifecycle.** Add generic list/field hook arrays and run order matching Keystone: input resolvers -> relationship resolvers -> field hooks -> list hooks -> validate -> beforeOperation -> adapter write -> nested afterOperations -> afterOperation. Port the existing Todo `assignedTo` default from hard-coded adapter logic into a `resolveInput` hook.
6. **Complete nested relationship mutation inputs.** Add nested `create` for to-one/to-many create/update inputs, then nested update/delete where feasible. Validate related item existence and access. Wrap multi-step nested writes in adapter transactions.
7. **Expand context API.** Add `context.prisma` for Prisma adapter, `context.db`, `context.query`, `context.graphql.raw/run/schema`, `transaction`, `withRequest`, `internal()`, and real `sudo()` semantics. Even if first implementation delegates to GraphQL execution, match Keystone’s API shape enough for source-style code.
8. **Implement auth/session primitives.** Add stateless cookie session strategy (Iron or equivalent), password hashing/compare, `authenticatedItem`, `authenticateUserWithPassword`, `endSession`, and init-first-item. Remove or gate dev fallback session/header auth for production.
9. **Improve field type parity.** Password must store hashes; image should expose `ImageFieldOutput` shape; document should at least be JSON AST with correct GraphQL scalar/metadata; text/select/multiselect should validate as Keystone; unique filters for `User.email` should exist if indexed unique and not omitted by config.
10. **Prisma parity beyond fixed schema.** Stabilize the current Prisma adapter and add `scripts/validate-cms-prisma.ts` or remove the package script if not present. Then implement a registry/config-driven Prisma schema printer or explicitly document fixed-schema-only mode. Add generated GraphQL schema artifact/snapshot validation.
11. **Implement `extendGraphqlSchema`.** Add config hook that receives the built schema and can add custom queries/mutations, enough to support the source starter’s `redirectToInit` query.
12. **Storage/upload.** Add Upload scalar/multipart support to Yoga route, local storage first, then S3-compatible `my_images`, Keystone-like image/file output URLs and metadata.

## 4. What can be copied/vendored safely vs must be rewritten

Keystone core is MIT licensed, so copying is legally possible if copyright/license notices are preserved. Practically, wholesale vendoring is risky because internals depend on `@graphql-ts/schema`, Keystone type internals, Prisma internals, storage/upload/session packages, and admin metadata assumptions.

Safer to copy or lightly adapt with MIT notice:

- Small pure naming/defaulting ideas from `schema.ts`, especially validations and defaults, but implement in target style.
- `statelessSessions` algorithm shape from `src/session.ts` if using the same `cookie` + Iron model.
- Filter operator semantics from `fields/filters/internal.ts` and provider files, rewritten against current adapters.
- Specific field validation rules (text length/match, integer ranges, select option validation, password length/common rejection) as behavior specs.
- Ordered-many-mutation error behavior from `mutations/index.ts:663-677` as a small helper if desired.
- Prisma schema printer concepts and mapping rules from `prisma-schema-printer.ts`, if/when building a target-owned printer.

Must be rewritten or used only as reference:

- `initialise-lists.ts` wholesale: deeply coupled to Keystone types, `@graphql-ts/schema`, admin meta internals, access/hook parser types, storage getters.
- `createSystem`/`createContext` wholesale: assumes Keystone build artifacts, Prisma module injection, internal schema shape, Node req/res context.
- Query/mutation resolvers wholesale: depend on Keystone initialized lists, Prisma field input resolvers, official error classes, OpenTelemetry, cache hints.
- Field factories wholesale: depend on Keystone fieldType wrappers, controller views, generated types, storage context, GraphQL-TS. Reimplement target equivalents.
- Auth package wholesale: can reference `getBaseAuthSchema`, but adapt to target context/session/password APIs.
- Admin UI packages/components and Next/Express server runner: out of scope and should not be imported.

## 5. Backend worker prompt for next highest-impact missing slice

```md
Task: Implement Keystone-style many mutations for the TanStack CMS runtime. Do not work on dashboard UI.

Context:
- Current generated schema is in `src/features/cms/runtime.ts`.
- Single mutations are generated at `runtime.ts:370-377` and resolved at `runtime.ts:495-506`.
- Adapter interface is `src/features/cms/adapters/types.ts:54-64`; memory implementation is `src/features/cms/adapters/memory.ts:536-600`; Prisma implementation is `src/features/cms/adapters/prisma.ts:284-304`.
- Keystone reference for many mutations is `/Users/junaid/code/keystone/packages/core/src/lib/core/mutations/index.ts:703-854`.
- GraphQL names already include `createManyMutationName`, `updateManyInputName`, `updateManyMutationName`, and `deleteManyMutationName` in `src/features/cms/types.ts`.

Goal:
Add generated `create<ListPlural>`, `update<ListPlural>`, and `delete<ListPlural>` mutations for every CMS list, matching Keystone naming and argument shapes as closely as this runtime allows:
- `createTodos(data: [TodoCreateInput!]!): [Todo]`
- `updateTodos(data: [TodoUpdateArgs!]!): [Todo]`
- `deleteTodos(where: [TodoWhereUniqueInput!]!): [Todo]`
- same for User, Role, TodoImage.

Implementation notes:
- Generate `<List>UpdateArgs`/`<List>UpdateManyInput` input type with `where: <WhereUnique>!` and `data: <UpdateInput>!`.
- Add many fields to `type Mutation` next to existing single mutations.
- Resolver can initially loop over existing adapter `create/update/delete` methods, preserving list order. Do not introduce one-off Todo-only code.
- Run operation access once per mutation type at resolver entry, and existing adapter-level filter/item access will still gate update/delete.
- Prefer ordered, per-item behavior similar to Keystone. If one operation fails, GraphQL may fail the mutation for now, but document this if exact `Promise.allSettled` error ordering is not implemented.
- Update validation script `scripts/validate-cms-crud.ts` or add a focused script/test to exercise createMany/updateMany/deleteMany in memory. If Prisma validation script is absent, do not rely on it.

Success criteria:
- Introspection/SDL contains many mutations and update-many input types for all four lists.
- Memory validation proves createMany/updateMany/deleteMany for Todo and at least one other list.
- Existing `npm run test:cms` still passes.
- No changes to Keystone source, no imports from Keystone runtime, no dashboard UI work.
```

## 6. Risks and licenses

- **License:** Keystone core package is MIT. `/Users/junaid/code/keystone/packages/core/package.json` reports license `MIT`, and `/Users/junaid/code/keystone/packages/core/LICENSE` is MIT copyright Thinkmill Labs Pty Ltd. Preserve notices for substantial copied source.
- **Runtime coupling risk:** Directly importing `@keystone-6/core` defeats the target architecture: it brings Keystone internals, Next/admin/server assumptions, `@graphql-ts/schema`, Prisma internals, upload/session packages, and unstable internal APIs.
- **Current security risk:** `createCmsContext()` uses a dev fallback admin session and `x-cms-user-id` header (`src/features/cms/runtime.ts:437-445`). This is acceptable only as a temporary development shim, not production auth.
- **False parity risk:** The current runtime’s generated GraphQL looks Keystone-like for fixed CRUD, but behavior differs materially around access, hooks, context, nested mutations, password/image/document fields, and codegen.
- **Prisma drift risk:** `prisma/schema.prisma` is hand-authored and model-specific. Adding fields/lists to the registry will not update Prisma schema or migrations.
- **Script drift risk:** `package.json` references `test:cms:prisma` as `tsx scripts/validate-cms-prisma.ts`, but no such file was found in `scripts/`; either add it during Prisma validation work or fix the script.
- **Field semantics risk:** Passwords are booleans, images/documents are JSON stubs, BigInt/Decimal are strings. This protects against exposing secrets but is not Keystone storage/auth parity.
- **Maintenance risk of vendoring:** Keystone internals can change across minor/patch versions and include paths intended to be private. Prefer target-owned implementations with tests against expected Keystone behavior.
