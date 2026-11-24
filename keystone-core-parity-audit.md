# Keystone core parity audit for TanStack Start CMS

## Executive summary

The current TanStack starter has a useful **admin metadata façade**, but it is not a Keystone-like runtime. It exposes only `Query.keystone.adminMeta` from a hand-written registry and sample counts. Real parity requires a runtime that turns list/field config into:

- GraphQL output/input/filter/order types per list.
- Query and mutation resolvers for `findOne`, `findMany`, `count`, `create`, `update`, `delete`, and many variants.
- Field-specific input/output resolvers, defaults, validation, hooks, relationship resolution, and access checks.
- A storage/DB adapter, eventually Prisma schema generation, migrations, and generated client usage.

A practical path is **not** “copy Keystone wholesale into TanStack Start”. Keystone’s `createSystem` is reusable as reference, but its package runtime pulls in Next/admin UI, Prisma internals, upload/storage/session, and many bundled dependencies. For this starter, build a small Keystone-like registry and GraphQL CRUD engine first, starting in-memory, then swap in Prisma once the contract is stable.

---

## 1. What Keystone actually does to produce GraphQL schema and Prisma operations

### Public config API is deliberately tiny

Reference: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/index.ts`

```ts
1 export { list, config, group } from './schema'
2 export type { ListConfig, BaseFields } from './types'
3 export { graphql } from './types/schema'
```

Reference: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/schema.ts`

```ts
10 export function config<TypeInfo extends BaseKeystoneTypeInfo> (config: KeystoneConfig<TypeInfo>) {
11   return config
12 }
15 export function group<ListTypeInfo extends BaseListTypeInfo> (config: {
20   const keys = Object.keys(config.fields)
25     [`__group${i++}`]: { fields: keys, label: config.label, description: config.description ?? null },
31 export function list<ListTypeInfo extends BaseListTypeInfo> (config: ListConfig<ListTypeInfo>) {
32   return { ...config }
```

`config()` and `list()` mainly preserve a declarative object. The heavy lifting happens later in `createSystem()` and `initialiseLists()`.

### `createSystem()` pipeline

Reference: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/createSystem.ts`

```ts
203 export function createSystem (config_: KeystoneConfig) {
204   const config = resolveDefaults(config_)
205   const lists = initialiseLists(config)
206   const adminMeta = createAdminMeta(config, lists)
207   const graphQLSchema = createGraphQLSchema(config, lists, adminMeta, false)
208   const graphQLSchemaSudo = getSudoGraphQLSchema(config)
...
221       const prePrismaClient = new PM.PrismaClient({
222         datasourceUrl: formatUrl(config.db.provider, config.db.url),
223         log: config.db.enableLogging
224       })
226       const prismaClient = config.db.extendPrismaClient(injectNewDefaults(prePrismaClient, lists))
227       const context = createContext({
228         config,
```

Important details:

- `resolveDefaults()` normalizes config before runtime.
- `initialiseLists()` converts list/field config into rich list metadata: GraphQL names/types, field input/output resolvers, DB field metadata, access/hook functions, UI metadata, relationship metadata.
- `createAdminMeta()` derives dashboard/admin metadata from initialized lists.
- `createGraphQLSchema()` adds query/mutation fields for every initialized list plus `keystone.adminMeta` and session mutation fields.
- `getKeystone()` instantiates Prisma, wraps Prisma errors/default IDs, creates request context, and exposes `context.db`, `context.query`, `context.prisma`, `context.graphql`, `context.sudo()`, `context.withRequest()`, `context.withSession()`.

### Sudo schema is a transformed copy

Reference: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/createSystem.ts`

```ts
72 function getSudoGraphQLSchema (config: __ResolvedKeystoneConfig) {
80   const transformedConfig: __ResolvedKeystoneConfig = {
88             access: allowAll,
89             graphql: { ...(list.graphql || {}), omit: false },
94                       access: allowAll,
95                       isFilterable: true,
96                       isOrderable: true,
97                       graphql: { ...(f.graphql || {}), omit: false },
117   const lists = initialiseLists(transformedConfig)
118   const adminMeta = createAdminMeta(transformedConfig, lists)
119   return createGraphQLSchema(transformedConfig, lists, adminMeta, true)
```

For parity, do not ignore sudo/context concerns: Keystone builds a separate schema with access and omit disabled for internal operations.

### List initialization creates all GraphQL input/output types

Reference: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/core/initialise-lists.ts`

Key structures:

```ts
54 export type InitialisedField = {
56   access: ResolvedFieldAccessControl
57   dbField: ResolvedDBField
58   hooks: ResolvedFieldHooks<BaseListTypeInfo>
60     isEnabled: { read/create/update/filter/orderBy ... }
64     isNonNull: { read/create/update }
...
101   access: ResolvedListAccessControl
103   fields: Record<string, InitialisedField>
112   resolvedDbFields: Record<string, ResolvedDBField>
116     types: GraphQLTypesForList
117     names: GraphQLNames
118     namePlural: string
119     isEnabled: IsListEnabled
124     listKey: string
125     mapping: string | undefined
126     extendPrismaSchema: ...
```

The initialization pass:

```ts
376 function getListsWithInitialisedFields (
390   const listGraphqlTypes: Record<string, ListGraphQLTypes> = {}
397     const output = graphql.object<BaseItem>()({ name: names.outputTypeName, fields: () => { ... } })
437     const uniqueWhere = graphql.inputObject({ name: names.whereUniqueInputName, fields: () => { ... id ... } })
473     const where = graphql.inputObject({ name: names.whereInputName, fields: () => ({ AND, OR, NOT, ...field where args }) })
494     const create = graphql.inputObject({ name: names.createInputName, fields: () => { ...field create args } })
507     const update = graphql.inputObject({ name: names.updateInputName, fields: () => { ...field update args } })
520     const orderBy = graphql.inputObject({ name: names.listOrderName, fields: () => { ...field orderBy args } })
556     const findManyArgs = { where, orderBy, take, skip, cursor }
574     const relateToOneForCreate = graphql.inputObject({ name: names.relateToOneForCreateInputName, fields: () => ({ create, connect }) })
586     const relateToOneForUpdate = graphql.inputObject({ ... create, connect, disconnect })
600     const relateToManyForCreate = graphql.inputObject({ ... create: [CreateInput!], connect: [WhereUnique!] })
617     const relateToManyForUpdate = graphql.inputObject({ ... disconnect, set, create, connect })
677     for (const [idx, [fieldKey, fieldFunc]] of Object.entries(listConfig.fields).entries()) {
699       const f = fieldFunc({ fieldKey, listKey, lists: listGraphqlTypes, provider, getStorage })
706       resultFields[fieldKey] = { dbField: f.dbField, access, hooks, graphql, ui, input, output, extraOutputFields, getAdminMeta }
892 export function initialiseLists (config: __ResolvedKeystoneConfig): Record<string, InitialisedList> {
896   intermediateLists = getListsWithInitialisedFields(config, listsRef)
899   const resolvedDBFieldsForLists = resolveRelationships(intermediateLists)
```

Essential idea: field factory functions return DB field metadata plus GraphQL input/output fragments. `initialiseLists()` composes those fragments into list-wide GraphQL types.

### Relationship resolution is a separate DB/schema pass

Reference: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/core/resolve-relationships.ts`

```ts
84 // - validating all the relationships
85 // - for relationships involving to-one: deciding which side owns the foreign key
86 // - turning one-sided relationships into two-sided relationships ...
90 export function resolveRelationships (
91   lists: Record<string, { fields: Record<string, { dbField: DBField }>, isSingleton: boolean }>
104         throw new Error(`The relationship field at ${listKey}.${fieldPath} points to the list ${listKey} which does not exist`)
119           throw new Error(`${localRef} points to ${foreignRef}, but ${foreignRef} is not a relationship field`)
124           throw new Error(`${localRef} expects ${foreignRef} to be a two way relationship, but ${foreignRef} points to ${actualRef}`)
```

For this starter, support initially required refs:

- `User.role` ↔ `Role.assignedTo`: one-to-many.
- `User.tasks` ↔ `Todo.assignedTo`: one-to-many.
- `Todo.todoImages` ↔ `TodoImage.todos`: many-to-many.

### Query schema and resolvers

Reference: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/createGraphQLSchema.ts`

```ts
11 import { getQueriesForList } from './core/queries'
12 import { getMutationsForList } from './core/mutations'
24       ...Object.values(lists).map(list => getQueriesForList(list)),
37         const { mutations, updateManyInput } = getMutationsForList(list)
100 export function createGraphQLSchema (...) {
```

Reference: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/core/queries/index.ts`

```ts
5 export function getQueriesForList (list: InitialisedList) {
8   const findOne = graphql.field({ type: list.graphql.types.output, args: { where: nonNull(uniqueWhere) }, resolve: ... })
21   const findMany = graphql.field({ type: list(output), args: list.graphql.types.findManyArgs, resolve: ... })
33   const countQuery = graphql.field({ type: graphql.Int, args: { where: nonNull(where) }, resolve: ... })
43     [list.graphql.names.itemQueryName]: findOne,
44     [list.graphql.names.listQueryName]: findMany,
45     [list.graphql.names.listQueryCountName]: countQuery,
```

Reference: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/core/queries/resolvers.ts`

```ts
75 export async function findOne (...) {
81   const operationAccess = await getOperationAccess(list, context, 'query')
84   const accessFilters = await getAccessFilters(list, context, 'query')
88   const uniqueWhere = await resolveUniqueWhereInput(args.where, list, context)
91   if (Object.keys(resolvedWhere).length === 0) return null
98   const filter = await accessControlledFilter(list, context, resolvedWhere, accessFilters)
100   return await context.prisma[list.listKey].findFirst({ where: filter })
103 export async function findMany (...) {
116   const operationAccess = await getOperationAccess(list, context, 'query')
119   const accessFilters = await getAccessFilters(list, context, 'query')
123   const resolvedWhere = await resolveWhereInput(where, list, context)
130   const orderBy = await resolveOrderBy(rawOrderBy, list, context)
133   const results = await context.prisma[list.listKey].findMany({ where, orderBy, take, skip, cursor })
208 export async function count (...) {
215   const operationAccess = await getOperationAccess(list, context, 'query')
218   const accessFilters = await getAccessFilters(list, context, 'query')
221   const resolvedWhere = await resolveWhereInput(where, list, context)
```

### Mutation schema and resolvers

Reference: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/core/mutations/index.ts`

```ts
133 export async function createOne (...) {
138   const operationAccess = await getOperationAccess(list, context, 'create')
142   const { item, afterOperation } = await createSingle(inputData ?? {}, list, context)
227 export async function updateOne (...) {
232   const operationAccess = await getOperationAccess(list, context, 'update')
236   const accessFilters = await getAccessFilters(list, context, 'update')
308 export async function deleteOne (...)
322 export async function deleteMany (...)
340 async function getResolvedData (...) {
352   // apply non-relationship field type input resolvers
379   // apply relationship field type input resolvers
436   // field hooks
467   // list hooks
502 async function resolveInputForCreateOrUpdate (...) {
514   hookArgs.resolvedData = await getResolvedData(list, hookArgs, nestedMutationState)
517   await validate({ list, hookArgs })
520   await runSideEffectOnlyHook(list, 'beforeOperation', hookArgs)
526     data: transformForPrismaClient(list.fields, hookArgs.resolvedData, context),
531       await runSideEffectOnlyHook(list, 'afterOperation', ...)
607 export function getMutationsForList (list: InitialisedList) {
614   const createOne_ = graphql.field({ type: list.graphql.types.output, args: { data: nonNull(createInput) }, resolve: ... })
625   const createMany_ = graphql.field({ type: list(output), args: { data: nonNull(list(nonNull(createInput))) }, ... })
634   const updateOne_ = graphql.field({ args: { where: nonNull(uniqueWhere), data: nonNull(updateInput) }, ... })
654   const updateMany_ = graphql.field({ args: { data: nonNull(list(nonNull(updateManyInput))) }, ... })
670   const deleteOne_ = graphql.field({ args: { where: nonNull(uniqueWhere) }, ... })
683   const deleteMany_ = graphql.field({ args: { where: nonNull(list(nonNull(uniqueWhere))) }, ... })
699       [list.graphql.names.createMutationName]: createOne_,
704       [list.graphql.names.updateMutationName]: updateOne_,
708       [list.graphql.names.deleteMutationName]: deleteOne_,
```

### Filters and orderBy are field-owned but list-composed

Reference: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/core/where-inputs.ts`

```ts
42 export async function resolveWhereInput (inputFilter, list, context, isAtRootWhere = true) {
50         if (key === 'OR' || key === 'AND' || key === 'NOT') { ... }
62         const field = list.fields[key]
65         const resolve = field.input!.where!.resolve
74                 const whereResolver = (filter: InputFilter) => resolveWhereInput(filter, list.lists[foreignList], context)
101         return handleOperators(key, dbField, ret)
```

Reference: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/filters/internal.ts`

```ts
10 type CommonFilter<T> = { equals?, in?, notIn?, lt?, lte?, gt?, gte?, contains?, startsWith?, endsWith?, not? }
27 function internalResolveFilter (...)
69 export function resolveCommon (...)
74 export function resolveString (...)
```

For a minimal in-memory prototype, implement a subset of these operators: `equals`, `in`, `notIn`, `lt/lte/gt/gte`, `contains/startsWith/endsWith` for strings, `not`, `AND`, `OR`, `NOT`, and relationship filters for to-one and to-many (`some`, `none`, `every`) only as needed.

### Access control is both operation-level and filter-level

Reference: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/core/access-control.ts`

```ts
72 export async function getOperationAccess (list, context, operation) {
80     result = await list.access.operation.query({ operation, session: context.session, listKey, context })
97   if (typeof result !== 'boolean') throw accessReturnError(...)
126 export async function getAccessFilters (list, context, operation) {
132       filters = await list.access.filter.query({ operation, session, listKey, context })
147     if (typeof filters === 'boolean') return filters
151     const result = coerceAndValidateForGraphQLInput(schema, whereInput, filters)
167 export async function enforceListLevelAccessControl (...)
228 export async function enforceFieldLevelAccessControl (...)
```

A real parity starter must support both:

- `access.operation`: returns boolean for query/create/update/delete.
- `access.filter`: returns boolean or where input to constrain query/update/delete.
- Field access for read/create/update, especially password and relationship fields.

### Field types define DB shape, GraphQL shape, default values, validation, and admin metadata

Examples:

- Text: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/types/text/index.ts`
  - Defines scalar `String`, default empty string/null, uniqueWhere if `isIndexed: 'unique'`, string filters, create/update args, validation hooks, admin meta.
- Checkbox: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/types/checkbox/index.ts`
  - Required Boolean with default false; rejects null in create/update.
- Password: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/types/password/index.ts`
  - Stores bcrypt hash, outputs `PasswordState { isSet }`, supports validation and hidden/read access patterns.
- Relationship: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/types/relationship/index.ts`
  - Builds to-one/to-many relation inputs and output resolvers; to-many adds `<field>Count` extra output field.
- Image: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/types/image/index.ts`
  - Multi DB field: `<field>_id`, `<field>_filesize`, `<field>_width`, `<field>_height`, `<field>_extension`; input is upload, output has URL resolver via `context.images(storage)`.
- Select/multiselect: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/types/select/index.ts`, `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/types/multiselect/index.ts`
  - Enforce option sets; multiselect uses JSON-backed list output.
- Document: package is separate, `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/fields-document/dist/declarations/src/index.d.ts`; source not installed, d.ts shows config surface only.

### Context API wraps GraphQL and DB operations

Reference: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/context/createContext.ts`

```ts
22 export function createContext ({ config, lists, graphQLSchema, graphQLSchemaSudo, prismaClient, prismaTypes }) {
40   const dbFactories = ... getDbFactory(list, graphQLSchema)
50   const queryFactories = ... getQueryFactory(list, graphQLSchema)
60   const images = createImagesContext(config)
61   const files = createFilesContext(config)
74     const rawGraphQL = async ({ query, variables }) => graphql({ schema, source, contextValue: context, variableValues: variables })
91       prisma,
92       db: {},
93       query: {},
94       graphql: { raw: rawGraphQL, run: runGraphQL, schema },
96       sudo: () => construct({ prisma, session, sudo: true, req, res }),
114       withRequest: async (newReq, newRes) => ... withSession(await config.session?.get(...))
128       withSession: session => construct({ prisma, session, sudo, req, res })
134       images,
135       files,
```

Reference: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/context/api.ts`

```ts
7 export function getQueryFactory (list, schema) { ... findOne/findMany/count/create/update/delete via GraphQL selections ... }
59 export function getDbFactory (list, schema) { ... execute root fields directly ... }
```

### Prisma schema/codegen/migrations

Reference: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/core/prisma-schema-printer.ts`

```ts
185 export function printPrismaSchema (config, lists) {
196     `datasource ${provider} {`,
202     `generator client {`,
213     const listPrisma = [`model ${listKey} {`]
216     for (const [fieldPath, field] of Object.entries(resolvedDbFields)) {
220         let fieldPrisma = printField(fieldPath, field, provider, lists)
222           fieldPrisma += ' @id'
```

Reference: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/artifacts.ts`

```ts
6 import { getGenerators, formatSchema } from '@prisma/internals'
62 export async function getArtifacts (system: System) {
63   const lists = initialiseLists(system.config)
66       [system.config.db.prismaSchemaPath, printPrismaSchema(system.config, lists)]
76 export async function generateArtifacts (cwd, system) {
83 export async function generateTypes (cwd, system) {
90 export async function generatePrismaClient (cwd, system) {
```

Reference: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/scripts/prisma.ts`

```ts
22   const system = createSystem(await importBuiltKeystoneConfiguration(cwd))
24   await validateArtifacts(cwd, system)
27   const { exitCode } = await spawnPrisma3(cwd, system, args)
```

Keystone’s Prisma pipeline is artifact-first: print Prisma schema, validate/generate, then run Prisma CLI. Do not attempt Prisma-backed parity until a schema printer/hand-authored Prisma schema and migration command path are decided.

---

## 2. Essential modules/concepts to vendor/copy/rebuild for a minimal real starter

### Build/rebuild in our own code first

For this project, rebuild these concepts with small scope rather than vendoring Keystone internals wholesale:

1. **List registry**
   - Current `cmsLists` is admin-meta oriented. Add runtime metadata: access functions, hooks, defaults, field resolvers, DB mapping, relationship metadata.
   - Required list names/naming should follow existing `getGraphQLNames()` in `src/features/cms/gql-names.ts`.

2. **Field type definitions**
   - Minimal runtime field kinds: `id`, `text`, `checkbox`, `integer`, `float`, `decimal`, `bigInt`, `timestamp`, `json`, `select`, `multiselect`, `password`, `relationship`.
   - Stub/defer complex fields: `document` as JSON scalar; `image` as JSON/object metadata without upload initially; later support upload/storage.
   - Each field needs: GraphQL output type, create/update input type, where filter type, orderBy eligibility, default resolver, validation, value serialization.

3. **GraphQL schema generation**
   - For each list generate:
     - Output type: `Todo`, `User`, `Role`, `TodoImage`.
     - Inputs: `<List>WhereUniqueInput`, `<List>WhereInput`, `<List>CreateInput`, `<List>UpdateInput`, `<List>OrderByInput`, `<List>UpdateArgs`.
     - Relationship inputs: `<List>RelateToOneForCreateInput`, `<List>RelateToOneForUpdateInput`, `<List>RelateToManyForCreateInput`, `<List>RelateToManyForUpdateInput`.
     - Root fields: `todo`, `todos`, `todosCount`, `createTodo`, `createTodos`, `updateTodo`, `updateTodos`, `deleteTodo`, `deleteTodos` etc.

4. **CRUD resolver layer**
   - Initial in-memory adapter can mirror Prisma-ish methods: `findFirst`, `findMany`, `count`, `create`, `update`, `delete`.
   - Apply operation access, filter access, field access, default values, hooks, and field validation before writing.

5. **Filters/orderBy**
   - Where input must support `AND`, `OR`, `NOT` plus scalar filter operators.
   - To-one relationship filter should recurse into related item.
   - To-many relationship filter should support `some`, `none`, `every` eventually.
   - OrderBy can be scalar-only initially.

6. **Relationships**
   - Resolve `ref` pairs and cardinality before schema creation.
   - Support output resolvers for to-one and to-many relationships.
   - Support nested mutation inputs at least for `connect`, `disconnect`, `set`; `create` can be phase 2.
   - Add extra `tasksCount`/`todoImagesCount` style fields for many relationships if parity with Keystone UI expects them.

7. **Access control hooks**
   - Operation-level booleans are needed immediately.
   - Filter access is needed for User/Todo parity.
   - Field access is needed for `User.password`, `User.role`, `User.tasks`.
   - Hook `resolveInput` is needed immediately for `Todo.assignedTo` default-to-current-user.

8. **Session context**
   - Runtime context should expose at least `{ session, sudo(), withSession(), db/query? }`.
   - Initial can inject a fake/dev session or parse a simple header; later implement Keystone-like stateless sessions with Iron/cookies.

9. **Prisma adapter/migrations/codegen**
   - Phase after in-memory: choose hand-authored Prisma schema or write a small schema printer using the registry.
   - Required mappings: password string hash, document/json/multiselect JSON, decimal string/Decimal, image multi columns/object, relationships.
   - Add Prisma client dependency intentionally; current TanStack app has none.

### Candidate Keystone modules to copy only with care

If copying is approved, the highest-value source references are:

- `src/lib/core/initialise-lists.ts` — architecture for composing field-level GraphQL fragments into list types.
- `src/lib/createGraphQLSchema.ts` — root query/mutation schema composition.
- `src/lib/core/queries/*` and `src/lib/core/mutations/*` — access + hooks + Prisma operation order.
- `src/lib/core/where-inputs.ts` and `src/fields/filters/*` — filter input and resolver model.
- `src/lib/core/resolve-relationships.ts` — relationship validation and foreign-key ownership.
- `src/lib/core/access-control.ts` — operation/filter/field access semantics.
- `src/lib/core/prisma-schema-printer.ts` — Prisma model generation strategy.

But do not copy these directly without product/legal approval: they are entangled with Keystone’s internal type system, `@graphql-ts/schema`, Prisma internals, admin UI metadata, image/file storage, upload, hooks, and package dependency layout.

---

## 3. Exact Keystone package paths useful as references or vendoring candidates

Installed package root: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core`

### Source files are present and readable

This installed package includes `src/`. Prefer source over `dist` for audit/reference. The dist files are bundled/chunked and not minified in dev chunks, but they are generated and hash-named. The `.d.ts` files are useful for public/config types but insufficient for behavior.

### Core runtime references

- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/index.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/schema.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/createSystem.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/createGraphQLSchema.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/create-admin-meta.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/resolve-admin-meta.ts` (adminMeta GraphQL resolver type, not fully audited here)

Dist equivalents:

- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/dist/createSystem-9936a87a.cjs.dev.js`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/dist/createSystem-fce2edb6.esm.js`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/dist/create-admin-meta-e69b236d.cjs.dev.js`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/dist/create-admin-meta-648256d6.esm.js`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/dist/graphql-ts-schema-73069614.cjs.dev.js`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/dist/keystone-6-core.cjs.dev.js`

Declarations:

- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/dist/declarations/src/lib/createSystem.d.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/dist/declarations/src/lib/create-admin-meta.d.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/dist/declarations/src/schema.d.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/dist/declarations/src/types/config/lists.d.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/dist/declarations/src/types/config/fields.d.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/dist/declarations/src/types/config/access-control.d.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/dist/declarations/src/types/config/hooks.d.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/dist/declarations/src/types/context.d.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/dist/declarations/src/types/prisma.d.ts`

### Schema/list/query/mutation internals

- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/core/initialise-lists.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/core/resolve-relationships.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/core/access-control.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/core/filter-order-access.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/core/hooks.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/core/where-inputs.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/core/queries/index.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/core/queries/resolvers.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/core/queries/output-field.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/core/mutations/index.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/core/mutations/nested-mutation-one-input-resolvers.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/core/mutations/nested-mutation-many-input-resolvers.ts`

### Field references

- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/index.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/types/text/index.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/types/checkbox/index.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/types/integer/index.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/types/float/index.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/types/decimal/index.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/types/bigInt/index.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/types/timestamp/index.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/types/json/index.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/types/select/index.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/types/multiselect/index.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/types/password/index.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/types/relationship/index.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/types/image/index.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/types/virtual/index.ts`
- Filters: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/fields/filters/internal.ts` and provider files under `/src/fields/filters/providers/`.
- Document field declarations: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/fields-document/dist/declarations/src/index.d.ts`. The installed package does **not** include TS source, only dist/declarations; d.ts is useful for config shape, dist JS for behavior if needed.

Dist field files:

- Aggregated field dist: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/fields/dist/keystone-6-core-fields.esm.js`, `.cjs.dev.js`, `.cjs.prod.js`.
- These are bundled enough to be less useful than `src/fields/types/*/index.ts`.

### Context/session/storage/Prisma references

- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/context/createContext.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/context/api.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/context/executeGraphQLFieldToRootVal.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/context/executeGraphQLFieldWithSelection.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/session.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/core/prisma-schema-printer.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/artifacts.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/scripts/prisma.ts`
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/src/lib/assets/createImagesContext.ts` and `createFilesContext.ts` (not deeply audited, needed for upload/image phase).

### Package metadata/license

- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/package.json`
  - Version audited: `@keystone-6/core` `6.5.1`.
  - License: MIT.
  - Dependencies include Next 14, React 18, Prisma 5.22, Apollo, upload, image/file, Keystone UI packages.
- `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/LICENSE`
  - MIT, copyright Thinkmill Labs Pty Ltd.

---

## 4. Source starter model/access patterns to support initially

Source model registry: `/Users/junaid/code/next-keystone-starter/features/keystone/models/index.ts`

```ts
1 import { User } from './User';
2 import { Role } from './Role';
3 import { Todo } from './Todo';
4 import { TodoImage } from './TodoImage';
6 export const models = { User, Role, Todo, TodoImage };
```

### Access/session config

Reference: `/Users/junaid/code/next-keystone-starter/features/keystone/access.ts`

```ts
1 export type Session = {
2   itemId: string
3   listKey: string
4   data: { name: string; role: { id; name; canCreateTodos; canManageAllTodos; canSeeOtherPeople; canEditOtherPeople; canManagePeople; canManageRoles; canAccessDashboard } }
28 export const permissions = {
29   canCreateTodos: ({ session }) => session?.data.role?.canCreateTodos ?? false,
30   canManageAllTodos: ({ session }) => session?.data.role?.canManageAllTodos ?? false,
31   canManagePeople: ({ session }) => session?.data.role?.canManagePeople ?? false,
32   canManageRoles: ({ session }) => session?.data.role?.canManageRoles ?? false,
35 export const rules = {
36   canReadTodos: ({ session }) => {
39     if (session.data.role?.canManageAllTodos) {
41       return { OR: [
42         { assignedTo: { id: { equals: session.itemId } } },
43         { assignedTo: null, isPrivate: { equals: true } },
44         { NOT: { isPrivate: { equals: true } } },
49     return { assignedTo: { id: { equals: session.itemId } } }
52   canManageTodos: ({ session }) => session.data.role?.canManageAllTodos ? true : { assignedTo: { id: { equals: session.itemId } } }
59   canReadPeople: ... canSeeOtherPeople ? true : { id: { equals: session.itemId } }
66   canUpdatePeople: ... canEditOtherPeople ? true : { id: { equals: session.itemId } }
```

Support needed:

- `isSignedIn` query/update/delete gate.
- Permission booleans from `session.data.role`.
- Filter access returning Keystone-style where inputs.
- Todo read rule includes a likely odd source condition `{ assignedTo: null, isPrivate: { equals: true } }`; preserve behavior initially for parity, even if product may later change it.

### User

Reference: `/Users/junaid/code/next-keystone-starter/features/keystone/models/User.ts`

```ts
8 export const User = list({
9   access: {
10     operation: { ...allOperations(isSignedIn), create: public signup or permissions.canManagePeople, delete: permissions.canManagePeople },
22     filter: { query: rules.canReadPeople, update: rules.canUpdatePeople },
46   fields: {
47     name: text({ validation: { isRequired: true } }),
52     email: text({ isFilterable: false, isOrderable: false, isIndexed: 'unique', validation: { isRequired: true } }),
60     password: password({ access: { read: denyAll, update: canManagePeople or self }, validation: { isRequired: true } }),
68     role: relationship({ ref: 'Role.assignedTo', access: { create/update: canManagePeople } }),
80     tasks: relationship({ ref: 'Todo.assignedTo', many: true, access: { create: canManageAllTodos, update: canManageAllTodos or self } }),
```

Must support initially:

- Unique `email` in create/update, no filtering/order by email in normal GraphQL.
- Password field hidden/read-denied; for in-memory prototype can store plaintext or hash placeholder only if explicitly documented, but worker should avoid exposing raw value.
- Relationship to Role (to-one) and Todo tasks (to-many).
- Public signup controlled by `PUBLIC_SIGNUPS_ALLOWED`.

### Role

Reference: `/Users/junaid/code/next-keystone-starter/features/keystone/models/Role.ts`

```ts
7 export const Role = list({
8   access: { operation: { ...allOperations(permissions.canManageRoles), query: isSignedIn } },
24   fields: {
25     name: text({ validation: { isRequired: true } }),
26-32 canCreateTodos/canManageAllTodos/canSeeOtherPeople/canEditOtherPeople/canManagePeople/canManageRoles/canAccessDashboard: checkbox({ defaultValue: false }),
33     assignedTo: relationship({ ref: 'User.role', many: true, ui: { itemView: { fieldMode: 'read' } } }),
```

Must support initially:

- Checkbox defaults false.
- Query allowed to any signed-in session; create/update/delete only `canManageRoles`.
- One-to-many inverse relationship to users.

### Todo

Reference: `/Users/junaid/code/next-keystone-starter/features/keystone/models/Todo.ts`

```ts
22 export const Todo = list({
23   access: {
24     operation: { ...allOperations(isSignedIn), create: permissions.canCreateTodos },
28     filter: { query: rules.canReadTodos, update: rules.canManageTodos, delete: rules.canManageTodos },
40   fields: {
42     label: text({ validation: { isRequired: true } }),
43     description: document({ formatting: true, links: true, dividers: true, layouts: [[1,1], [1,1,1], [2,1]] }),
58     isComplete: checkbox({ defaultValue: false }),
59     status: select({ type: 'string', options: todo/in_progress/done/blocked, defaultValue: 'todo' }),
69     priority: integer({ defaultValue: 1, validation: { min: 1, max: 5 } }),
74     tags: multiselect({ type: 'string', options: frontend/backend/database/testing/documentation/bug_fix/feature/urgent/nice_to_have, defaultValue: [] }),
100    dueDate: timestamp(),
103    weight: float({ defaultValue: 1.0 }),
107    budget: decimal({ precision: 10, scale: 2, defaultValue: '0.00' }),
121    isPrivate: checkbox({ defaultValue: false }),
122    largeNumber: bigInt(),
126    metadata: json(),
127    secretNote: password(),
137    coverImage: image({ storage: 'my_images' }),
141    todoImages: relationship({ ref: 'TodoImage.todos', many: true, ui cards... }),
167    assignedTo: relationship({ ref: 'User.tasks', hooks: { resolveInput(...) default connect current user on create } }),
```

Must support initially:

- Required text, scalar defaults, select/multiselect option validation.
- Document as JSON-ish opaque field first.
- Decimal as string or decimal scalar; BigInt scalar serialization decision.
- Password-like `secretNote` should not expose raw value if implemented like Keystone.
- `assignedTo` resolveInput hook: on create, if missing and `context.session.itemId`, set `{ connect: { id: session.itemId } }`.
- Relationship to TodoImage many-to-many.

### TodoImage

Reference: `/Users/junaid/code/next-keystone-starter/features/keystone/models/TodoImage.ts`

```ts
6 export const TodoImage = list({
7   access: { operation: { query: isSignedIn, create/update/delete: permissions.canCreateTodos } },
15   fields: {
16     image: image({ storage: 'my_images' }),
17     imagePath: text(),
18     altText: text(),
19     todos: relationship({ ref: 'Todo.todoImages', many: true }),
20     metadata: json(),
```

Must support initially:

- Query signed-in; mutations require `canCreateTodos`.
- Image can be represented as metadata object/stub until upload phase.
- Many-to-many `todos` inverse.

### Auth/session/storage config from source Keystone index

Reference: `/Users/junaid/code/next-keystone-starter/features/keystone/index.ts`

Important source patterns:

- `createAuth({ listKey: 'User', identityField: 'email', secretField: 'password', initFirstItem, passwordResetLink, sessionData })`.
- `statelessSessions({ maxAge, secret })`.
- PostgreSQL `db.provider = 'postgresql'`, `DATABASE_URL` fallback.
- S3 image storage key `my_images`.
- `ui.isAccessAllowed` uses `session.data.role.canAccessDashboard`.
- `graphql.extendGraphqlSchema` adds `redirectToInit` query.

For GraphQL CRUD slice, auth UI/password reset can wait, but session shape and `canAccessDashboard` should be preserved.

---

## 5. Gap analysis against current TanStack starter

Current target files:

- `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/registry.ts`
- `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/admin-meta.ts`
- `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/graphql.ts`
- `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/types.ts`
- `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/gql-names.ts`
- `/Users/junaid/code/tanstack-keystone-starter/src/routes/api/graphql.ts`
- `/Users/junaid/code/tanstack-keystone-starter/src/routes/dashboard/$listKey.tsx`

### Current capabilities

Reference: `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/graphql.ts`

```ts
9 const typeDefs = /* GraphQL */ `
12   type Query { keystone: KeystoneMeta! }
...
42     fields: [FieldMeta!]!
...
163 export const cmsGraphQLYoga = createYoga({ schema: cmsGraphQLSchema, graphqlEndpoint: '/api/graphql' })
```

It only defines metadata types and `Query.keystone.adminMeta`.

Reference: `/Users/junaid/code/tanstack-keystone-starter/src/routes/api/graphql.ts`

```ts
3 import { cmsGraphQLYoga } from '@/features/cms/graphql'
6   const response = await cmsGraphQLYoga.handle(request, {})
11 export const Route = createFileRoute('/api/graphql')({ server: { handlers: { GET, POST } } })
```

The route is wired correctly for Yoga, but context is `{}` and there are no CRUD resolvers.

Reference: `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/registry.ts`

```ts
13 export const cmsLists: CmsList[] = [ ... Todo, User, Role ... ]
77 { path: 'coverImage', kind: 'image', ... }
78 { path: 'todoImages', kind: 'relationship', ref: 'TodoImage.todos', many: true }
79 { path: 'assignedTo', kind: 'relationship', ref: 'User.tasks' }
115 fields: [ ... User ... ]
135 fields: [ ... Role ... ]
```

Major gap: current registry **omits `TodoImage`**, even though `sampleCountsByListKey` and nav icon map mention it. Source starter has four lists; TanStack registry has only Todo/User/Role. Add TodoImage for parity.

Reference: `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/schema.ts`

```ts
const sampleCountsByListKey = { Todo: 24, User: 6, Role: 3, TodoImage: 11 }
```

Counts are fake and not backed by data.

Reference: `/Users/junaid/code/tanstack-keystone-starter/package.json`

```json
"dependencies": {
  "graphql": "^16.14.0",
  "graphql-yoga": "^5.21.0"
}
```

No Prisma, bcrypt, cookie/Iron, upload, or Keystone dependency in the TanStack app. That is fine for in-memory first; it blocks Prisma/auth parity until added.

### Missing runtime concepts

- No CRUD GraphQL fields (`todos`, `todo`, `createTodo`, etc.).
- No data adapter or seed data.
- No access/session context.
- No field resolvers/defaults/validation.
- No filter/orderBy input types.
- No relationship output or nested input handling.
- No hooks.
- No password hashing/secret field output behavior.
- No Prisma schema/client/migrations.
- No upload/image storage implementation.
- No `TodoImage` list in registry.
- Dashboard reads static `cmsAdminMeta`, not GraphQL CRUD.

---

## 6. Phased implementation plan to working GraphQL API

### Phase 0 — clarify scope and preserve boundary

- Keep TanStack Start as the HTTP/UI runtime.
- Do not import Keystone’s Next-coupled server/admin runtime.
- Use Keystone source as behavioral reference.
- Keep current adminMeta query working while adding CRUD fields.

### Phase 1 — in-memory CRUD prototype from our own registry

Goal: a real GraphQL CRUD API at `/api/graphql` for the starter lists, backed by seeded in-memory data.

Implement:

- Add `TodoImage` to `cmsLists`.
- Add a `cmsRuntime` or similar module that initializes lists from `cmsLists`.
- Generate GraphQL object/input types programmatically using `graphql`/`graphql-yoga` primitives, not static SDL if possible. Static SDL is acceptable for first slice if generated from registry is too slow, but do not hard-code only Todo.
- Generate list queries: `todo(where: TodoWhereUniqueInput!)`, `todos(where, orderBy, take, skip, cursor)`, `todosCount(where)`; same for User/Role/TodoImage.
- Generate mutations: `createTodo`, `updateTodo`, `deleteTodo`; many variants can be phase 1.5.
- Implement scalar field create/update/defaults/validation for `text`, `checkbox`, `integer`, `float`, `decimal`, `bigInt`, `timestamp`, `json`, `select`, `multiselect`.
- Implement relationship output by resolving IDs through an in-memory store.
- Implement minimal relationship mutation inputs: to-one `{ connect, disconnect }`, to-many `{ connect, disconnect, set }`.
- Implement access/session shape and a dev session provider so rules can run.
- Implement filter access and where filtering for source rules.
- Treat `document` and `image` as JSON/metadata stubs.
- Treat `password` as `{ isSet: Boolean! }` output and never expose stored value.

Validation:

- Introspection shows CRUD fields.
- `todos { id label assignedTo { id name } todoImages { id altText } }` works.
- `createTodo(data: { label: "X" })` defaults `status`, `priority`, `isComplete`, etc. and `assignedTo` from session if present.
- Access filters hide other users’ private todos for non-manager sessions.

### Phase 2 — richer schema parity

- Add many mutations: `createTodos`, `updateTodos`, `deleteTodos`.
- Add `<field>Count` for many relationships.
- Add full filter operators and orderBy types per field.
- Add unique constraints in memory (`User.email`).
- Add field-level access for reads and writes.
- Add hook runner order closer to Keystone: field input resolvers → relationship resolvers → field hooks → list hooks → validate → beforeOperation → adapter write → afterOperation.
- Add `context.query`/`context.db` wrappers if internal code needs them.

### Phase 3 — Prisma-backed adapter

Two options:

1. **Hand-authored Prisma schema first** for the known four models.
   - Fastest reliable path for starter.
   - Add Prisma 5.x/6.x dependency intentionally.
   - Map all required fields/relations manually.
   - Keep registry → GraphQL runtime independent of Prisma schema printer.

2. **Small Prisma schema printer from registry**.
   - More Keystone-like and extensible.
   - Higher risk: multi fields, enums, decimal, BigInt, JSON, relations, indexes, native types, migrations.

Recommended: hand-authored Prisma schema for the four-list starter first, then graduate to printer if the project needs dynamic list config.

Implement:

- Adapter interface already used by in-memory layer.
- Prisma adapter maps list key to Prisma model operations.
- Convert GraphQL where/order inputs into Prisma args.
- Transactions for nested writes.
- Migration scripts and seed script.

### Phase 4 — relationships/files/auth

- Full nested create/connect/update/delete parity for relationships.
- Image upload scalar and S3/local storage support; replicate Keystone image output shape.
- Stateless sessions using cookie/Iron or compatible library.
- `createAuth`-like mutations: authenticate, endSession, initFirstItem, password reset.
- Dashboard access (`canAccessDashboard`) integrated with route loaders.
- `redirectToInit` extension from source starter.

### Phase 5 — codegen/admin UI parity polish

- Generated GraphQL schema file for debugging.
- Generated TS types for list inputs/outputs if needed.
- Dashboard list/item/create screens backed by GraphQL CRUD, not static metadata.
- Relationship selectors, inline create/edit cards, image fields, document editor integration.

---

## 7. License and maintainability warnings

- `@keystone-6/core` is MIT licensed. Reference: `/Users/junaid/code/next-keystone-starter/node_modules/@keystone-6/core/package.json` has `"license": "MIT"`; `/LICENSE` includes MIT terms.
- If copying substantial source, preserve license/copyright notices.
- Keystone internals are not stable public API. The package has paths like `___internal-do-not-use-will-break-in-patch`, and core internals can break across patch/minor releases.
- Directly vendoring internals creates a fork maintenance burden: security fixes, Prisma upgrades, GraphQL changes, upload/session behavior, and field semantics must be tracked manually.
- Dist files are generated hash chunks; vendoring dist is worse than source for maintainability.
- Public `.d.ts` files document shapes, not behavior; do not rely on declarations alone to reproduce runtime behavior.
- Importing `@keystone-6/core` directly into the TanStack runtime may drag Next/React 18/admin UI/Prisma dependencies and defeat the “no Next-coupled runtime” goal.
- Recommended approach: write a compact Keystone-inspired runtime under `src/features/cms`, with explicit tests/scope, and use Keystone source as a reference only.

---

## 8. Recommended next worker prompt

```md
Task: Implement the first real Keystone-like GraphQL CRUD slice for the TanStack CMS. Do not implement adminMeta-only work.

Context:
- Audit file: `/Users/junaid/code/tanstack-keystone-starter/keystone-core-parity-audit.md`.
- Current GraphQL endpoint is `/Users/junaid/code/tanstack-keystone-starter/src/routes/api/graphql.ts`, backed by `/src/features/cms/graphql.ts`; it only serves `Query.keystone.adminMeta`.
- Current registry is `/src/features/cms/registry.ts`; it includes Todo/User/Role but is missing TodoImage. Add TodoImage parity from `/Users/junaid/code/next-keystone-starter/features/keystone/models/TodoImage.ts`.
- Source starter fields/access are in `/Users/junaid/code/next-keystone-starter/features/keystone/models/{User,Role,Todo,TodoImage}.ts` and `/features/keystone/access.ts`.
- Keystone reference behavior is in `node_modules/@keystone-6/core/src/lib/createSystem.ts`, `src/lib/core/initialise-lists.ts`, `src/lib/createGraphQLSchema.ts`, `src/lib/core/queries/*`, `src/lib/core/mutations/*`, `src/lib/core/where-inputs.ts`, `src/lib/core/access-control.ts`, and `src/fields/types/*/index.ts`.

Goal:
Build a practical in-memory GraphQL CRUD API generated from our own `cmsLists`/runtime registry while preserving the existing `keystone.adminMeta` query. The API should expose Keystone-like root fields for all four lists: item query, list query, count query, create/update/delete mutation at minimum.

Required initial behavior:
1. Add TodoImage to the CMS registry with fields: id, image, imagePath, altText, todos, metadata.
2. Create or refactor a CMS runtime module that maps list/field metadata to GraphQL types and resolvers.
3. Generate root fields using existing `getGraphQLNames()` naming: e.g. `todo`, `todos`, `todosCount`, `createTodo`, `updateTodo`, `deleteTodo`; same for User/Role/TodoImage.
4. Use an in-memory adapter with seeded demo data for User, Role, Todo, TodoImage and relationships.
5. Implement scalar field output/input/defaults for text, checkbox, integer, float, decimal as string, bigInt as string scalar or string output, timestamp as string, json/document/image as JSON, select, multiselect.
6. Implement password output as `PasswordState { isSet: Boolean! }`; never expose stored password/secretNote value.
7. Implement where filtering subset needed by source access rules: `AND`, `OR`, `NOT`, `equals`, string contains/startsWith/endsWith, and nested to-one relationship filter by id. Add simple orderBy for scalar fields.
8. Implement relationship output resolvers for to-one and to-many refs: User.role, Role.assignedTo, User.tasks, Todo.assignedTo, Todo.todoImages, TodoImage.todos.
9. Implement create/update/delete with basic validation and defaults. Relationship mutation input can initially support `connect`, `disconnect`, and `set`; nested `create` can be omitted with a clear TODO.
10. Implement a minimal request context/session path so access functions can run. A dev fallback session is acceptable, but centralize it and document the security limitation in code comments. Apply operation access and filter access for User/Role/Todo/TodoImage based on source `/features/keystone/access.ts` semantics.

Constraints:
- Do not import Keystone’s Next-coupled runtime or depend on `@keystone-6/core` for runtime behavior.
- Do not add Prisma in this slice unless it is clearly simpler than in-memory; preferred first slice is in-memory.
- Preserve existing `keystone.adminMeta` GraphQL query shape so current dashboard code keeps working.
- Avoid hard-coding only Todo; the implementation should be list-driven enough to cover all four source lists.
- If copying Keystone source, preserve MIT notices; prefer clean-room small implementation inspired by the audit.

Validation:
- Run `pnpm test` if tests exist, and `pnpm build` or at least `pnpm lint`/`pnpm check` if available.
- Manually exercise `/api/graphql` with queries/mutations such as:
  - `query { todos { id label status isComplete assignedTo { id name } todoImages { id altText } } todosCount }`
  - `mutation { createTodo(data: { label: "GraphQL parity" }) { id label status priority isComplete assignedTo { id } } }`
  - `query { users { id name email role { id name } tasksCount } roles { id name canManageRoles assignedTo { id name } } todoImages { id altText todos { id label } } }`
- Confirm password/secretNote fields return only `{ isSet }` or are omitted/denied, never raw values.

Output expectation:
- Implement files in the TanStack starter.
- Summarize changed files, supported GraphQL fields, known limitations, and validation results.
```
