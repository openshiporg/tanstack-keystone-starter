# CMS generator design: replacing `keystone build --no-ui` for TanStack

Date: 2026-05-11  
Scope: design only. No production code changes in this report.

## Executive summary

`tanstack-keystone-starter` should replace `keystone build --no-ui` with a small, TanStack-native generator that reads a CMS config, initializes lists/fields, and emits the artifacts needed by GraphQL Yoga, Prisma, dashboard metadata, and TypeScript tooling. We should **not** keep Keystone's Next/admin build pipeline and should not import Keystone runtime internals as the production path.

Recommendation:

- Keep a config file: **yes**. Use `cms.config.ts` as the canonical new entrypoint, while supporting `keystone.ts` as a compatibility shim during migration.
- Keep generated artifacts: **yes**. Generate a deterministic `.cms/` directory plus checked/managed Prisma artifacts where Prisma expects them.
- Directory recommendation: **`.cms`**, not `.keystone`, for the TanStack-native generator. Optionally create a temporary `.keystone/config.js` compatibility artifact only if a legacy tool explicitly needs it.
- Initial artifacts:
  - `.cms/manifest.json` runtime config/list/field manifest.
  - `.cms/admin-meta.json` dashboard metadata.
  - `.cms/schema.graphql` public GraphQL SDL.
  - `.cms/types.ts` generated CMS TypeScript types.
  - `.cms/runtime.ts` or `.cms/index.ts` helper exports that load the manifest into the runtime.
  - `prisma/schema.prisma` generated from CMS metadata, or `.cms/schema.prisma` plus a synchronized copy/symlink/explicit Prisma `--schema` path. For developer clarity, generate `prisma/schema.prisma` in phase 1 of Prisma generation, with a generated-file header.
- Package scripts should replace `keystone build --no-ui` with `cms:generate` and ensure `dev`, `build`, and `db:*` run or validate generation before Vite/Prisma commands.

The first generator slice should be artifact-only: load the existing `cmsLists`/DSL metadata, build the current `cmsTypeDefs`/adminMeta/Prisma schema outputs, write `.cms/*`, and validate drift. Do not attempt full Keystone field factory parity in the first slice.

---

## 1. What NKS/Keystone currently generates and why

### NKS scripts depend on Keystone build before app and migrations

`/Users/junaid/code/next-keystone-starter/package.json` wires Keystone generation into normal commands:

- `dev`: `keystone build --no-ui && npm run migrate && next dev` (`package.json:6`).
- `build`: `keystone build --no-ui && npm run migrate && next build` (`package.json:7`).
- `migrate:gen`: `keystone build --no-ui && ... && keystone prisma migrate dev` (`package.json:10`).
- `migrate`: `prisma migrate deploy` (`package.json:11`).

So the source starter treats Keystone build as a required preflight for schema/artifact freshness before Next starts or Prisma migrates.

### NKS config entrypoint

NKS has a minimal `keystone.ts`:

```ts
// /Users/junaid/code/next-keystone-starter/keystone.ts
import config from './features/keystone';
export default config;
```

The real Keystone config is in `/Users/junaid/code/next-keystone-starter/features/keystone/index.ts`:

- Imports `createAuth`, `config`, `statelessSessions`, starter `models`, and `extendGraphqlSchema` (`index.ts:1-7`).
- Configures DB provider/url (`index.ts:69-75`).
- Configures S3 image storage key `my_images` (`index.ts:76-88`).
- Configures dashboard access with `ui.isAccessAllowed` (`index.ts:89-91`).
- Configures sessions (`index.ts:92`).
- Configures `graphql.extendGraphqlSchema` (`index.ts:93-95`).
- Wraps the config with `createAuth` for password auth, init-first-item, password reset, and session data (`index.ts:25-67`, `69-97`).

### Keystone build pipeline

Official Keystone `build` does four jobs before optionally building Admin UI:

```ts
// /Users/junaid/code/keystone/packages/core/src/scripts/build.ts
await esbuild.build(await getEsbuildConfig(cwd))                 // line 24
const system = createSystem(await importBuiltKeystoneConfiguration(cwd)) // line 26
await generateArtifacts(cwd, system) or validateArtifacts(...)    // lines 28-34
await generateTypes(cwd, system)                                  // line 36
await generatePrismaClient(cwd, system)                           // line 37
if (!ui) return                                                   // line 40
```

With `--no-ui`, it still bundles config, initializes the system, generates/validates GraphQL and Prisma artifacts, generates types, and generates Prisma Client. It skips Admin UI code/build.

### Keystone bundles the config into `.keystone/config.js`

Official path logic:

- Built config path is `.keystone/config.js` (`/Users/junaid/code/keystone/packages/core/src/lib/system.ts:10-13`).
- `getEsbuildConfig()` bundles `./keystone` into `.keystone/config.js` (`scripts/esbuild.ts:36-57`).

NKS has such an artifact: `/Users/junaid/code/next-keystone-starter/.keystone/config.js`. It is a bundled CommonJS copy of `keystone.ts`, `features/keystone/index.ts`, models, access functions, etc. It exists so Keystone CLI can import one compiled config independent of TS runtime/module details.

### Keystone initializes runtime system from config

Official `createSystem()` is the heart of artifact generation/runtime:

```ts
// /Users/junaid/code/keystone/packages/core/src/lib/system.ts
const lists = initialiseLists(config)                 // line 148
const adminMeta = createAdminMeta(config, lists)      // line 149
const graphQLSchemas = {
  public: createGraphQLSchema(config, lists, adminMeta, false),   // line 151
  internal: getInternalGraphQLSchema(config),                     // line 152
}
```

It also later creates Prisma Client and Keystone context (`system.ts:164-193`). The internal/sudo schema disables omit/access filtering for internal operations (`system.ts:58-97`).

### Keystone-generated artifacts

Official artifact generation is in `/Users/junaid/code/keystone/packages/core/src/artifacts.ts`:

- `buildArtifacts()` prints and formats Prisma schema and GraphQL schema (`artifacts.ts:54-66`).
- `generateArtifacts()` writes GraphQL and Prisma schema files (`artifacts.ts:69-76`).
- `generateTypes()` writes generated TypeScript types (`artifacts.ts:79-89`).
- `generatePrismaClient()` runs Prisma generators (`artifacts.ts:92-110`).
- `validateArtifacts()` compares generated contents to written files and errors on drift (`artifacts.ts:30-50`).

Default output paths come from `getSystemPaths()`:

- Built config: `.keystone/config.js` (`system.ts:43-45`).
- Admin UI: `.keystone/admin` (`system.ts:45`).
- Generated TypeScript types: `node_modules/.keystone/types.ts` by default (`system.ts:27-29`, `50-52`).
- Prisma schema: `schema.prisma` by default or `config.db.prismaSchemaPath` (`system.ts:31-33`, `50-53`).
- GraphQL schema: `schema.graphql` by default or `config.graphql.schemaPath` (`system.ts:39-41`, `50-54`).

### Keystone Prisma schema printer

`/Users/junaid/code/keystone/packages/core/src/lib/core/prisma-schema-printer.ts` prints:

- A generated-file header (`prisma-schema-printer.ts:190-192`).
- `datasource` and `generator client` blocks (`:194-204`).
- One Prisma model per initialized list (`:211-239`).
- Scalar, enum, multi-field, and relation fields (`:47-122`).
- Relation ID fields and indexes for owned to-one relations (`:102-120`).
- Collected Prisma enums (`:131-166`).

This is the main reference for our schema printer, but should be adapted to our simpler metadata instead of copied wholesale.

---

## 2. Current TanStack state relevant to generator design

### Existing package scripts and dependencies

`tanstack-keystone-starter/package.json` currently has:

- `dev`: `vite dev --port 3000` (`package.json:9`).
- `build`: `vite build` (`package.json:10`).
- `test:cms`: `tsx scripts/validate-cms-crud.ts` (`package.json:13`).
- `test:cms:prisma`: `tsx scripts/validate-cms-prisma.ts` (`package.json:14`).
- `db:generate`: `prisma generate` (`package.json:18`).
- `db:push`: `prisma db push` (`package.json:19`).
- `db:seed`: `prisma db seed` (`package.json:20`).
- Prisma and `@prisma/client` are already dependencies (`package.json:28`, `43`).

Unlike NKS, `dev` and `build` do not run generation/validation today.

### Current config/list/field DSL exists but is thin

`src/features/cms/config.ts` already exposes Keystone-like names:

- `config(cmsConfig)` returns the object (`config.ts:22-24`).
- `list(listConfig)` returns the object (`config.ts:26-28`).
- `group(groupConfig)` returns the object (`config.ts:30-32`).
- `initialiseLists(cmsConfig)` normalizes list config to `CmsList[]` (`config.ts:80-82`).

`src/features/cms/fields/index.ts` has field factories for all starter field kinds:

- `text`, `password`, `checkbox`, `select`, `multiselect`, `relationship`, `document`, `timestamp`, `integer`, `float`, `decimal`, `bigInt`, `json`, `image` (`fields/index.ts:18-72`).

These are currently metadata factories only. They do not yet produce Keystone-style DB fields, GraphQL fragments, hooks, access semantics, or admin controller metadata.

### Current runtime is already list-driven but in-memory/inline

`src/features/cms/runtime.ts` currently generates SDL from `cmsLists`:

- Builds names from each list (`runtime.ts:21`).
- Defines common scalar/filter/adminMeta SDL (`runtime.ts:28-167`).
- Maps field kind to GraphQL output/input/filter types (`runtime.ts:206-255`).
- Generates list SDL: output type, where input, relation filters, create/update inputs, orderBy, relate-to-one/many inputs (`runtime.ts:261-356`).
- Generates root queries and single mutations for every list (`runtime.ts:359-392`).
- Builds resolvers for list/item/count and create/update/delete (`runtime.ts:475-506`).
- Resolves password as `{ isSet }` and relationships through adapter methods (`runtime.ts:508-527`).

`src/features/cms/graphql.ts` wraps the generated SDL/resolvers in Yoga:

- `createSchema<CmsContext>({ typeDefs: cmsTypeDefs, resolvers: cmsResolvers })` (`graphql.ts:5-7`).
- `createYoga` with endpoint `/api/graphql` and `context: ({ request }) => createCmsContext(request)` (`graphql.ts:7-14`).

This means our generator can initially reuse the existing runtime's logic and simply materialize its outputs to files. It does not need to invent an API from scratch.

### Current hand-authored Prisma schema is fixed to starter models

`prisma/schema.prisma` defines four models:

- `User` with `email @unique`, Boolean `password`, Role relation, Todo tasks (`schema.prisma:10-19`).
- `Role` with permission booleans and inverse users (`schema.prisma:21-32`).
- `Todo` with scalar fields, JSON document/image, Boolean password stub, User relation, TodoImage many-to-many (`schema.prisma:34-54`).
- `TodoImage` with JSON image/metadata and many-to-many todos (`schema.prisma:56-63`).

This schema is currently a source-of-truth risk: adding fields to `cmsLists` or the DSL does not update Prisma.

---

## 3. Which generated artifacts TanStack needs, excluding Next/Admin UI

TanStack does **not** need Keystone's `.keystone/admin` generated Next app, `next build`, or `next/dist/build` coupling. It does need the backend artifacts Keystone was producing under `--no-ui`.

### Needed for GraphQL Yoga runtime

1. **Runtime manifest**
   - Deterministic list/field/access/storage/session metadata consumed by the Yoga runtime.
   - Should be JSON-serializable where possible.
   - Functions such as access/hooks cannot be represented as pure JSON; for those, use generated TS helper exports or keep the config module import path in the manifest.

2. **GraphQL SDL**
   - Public schema snapshot for debugging, validation, dashboard query generation, and CI drift checks.
   - Generated from the same initialized lists used by runtime.
   - Equivalent role to Keystone's generated `schema.graphql`.

3. **Resolver/runtime helper exports**
   - A stable generated module that the app can import, e.g. `.cms/runtime.ts` or `.cms/index.ts`.
   - It should load the manifest/adminMeta and call source runtime code, not contain a giant generated resolver implementation at first.
   - This avoids runtime recomputation drift and gives Vite/TanStack a deterministic import.

4. **Internal/sudo schema metadata later**
   - Not required in the first generator slice, but the design must reserve room for an internal schema or manifest flag because official Keystone creates a public and internal schema (`system.ts:147-153`) and uses internal behavior for `context.sudo()`.

### Needed for Prisma

1. **Prisma schema**
   - Required for migrations, Prisma Client generation, and DB safety.
   - Should be generated from the same initialized lists used for GraphQL.
   - For compatibility with existing scripts and Prisma defaults, generate to `prisma/schema.prisma` initially.
   - If also writing `.cms/schema.prisma`, scripts must pass `--schema .cms/schema.prisma` consistently. Avoid two independent copies.

2. **Prisma Client generation wrapper**
   - Keystone build runs Prisma generators after writing schema (`artifacts.ts:92-110`).
   - Our `cms:generate` may optionally run `prisma generate`, but the safer script split is:
     - `cms:generate`: write artifacts.
     - `db:generate`: validate/generate artifacts, then run `prisma generate`.

3. **Migration safety tooling**
   - A drift check command like Keystone `validateArtifacts()` (`artifacts.ts:30-50`).
   - `db:migrate`/`db:push` must run generation or validation before changing the DB.

### Needed for dashboard

1. **adminMeta JSON**
   - Dashboard should not need to introspect source config at runtime.
   - Generate `.cms/admin-meta.json` from initialized lists.
   - This should match the GraphQL `keystone.adminMeta` shape currently returned by `getAdminMeta()`.

2. **Field/view manifest**
   - The current field metadata includes view modes, labels, groups, options, `fieldMeta`, and filter/order flags.
   - This can be part of `.cms/manifest.json` or `.cms/admin-meta.json`.
   - Later dashboard form builders will need create/update input shape and relationship metadata too.

### Needed for TypeScript/dev experience

1. **Generated CMS types**
   - Equivalent role to Keystone's `node_modules/.keystone/types.ts` (`system.ts:27-29`).
   - Should type list keys, item shapes, create/update inputs, relationship inputs, and context/session shape.
   - Recommended output: `.cms/types.ts` and a stable source re-export `src/features/cms/generated.ts` only if needed. Avoid writing into `node_modules`.

2. **Generated config map**
   - A typed map of list keys to names/paths/fields can be generated in `.cms/manifest.ts` for consumers that need tree-shakeable TS imports.
   - JSON remains better for validation and non-TS tooling.

---

## 4. Proposed config entrypoint: `keystone.ts` compatibility vs `cms.config.ts`

### Recommendation

Use **`cms.config.ts` as the canonical TanStack entrypoint**, with a transitional **`keystone.ts` compatibility shim**.

Proposed files:

```ts
// cms.config.ts
import { config } from './src/features/cms/config'
import { models } from './src/features/cms/models'

export default config({
  db: { provider: 'postgresql', url: process.env.DATABASE_URL ?? '' },
  lists: models,
  storage: { /* my_images */ },
  session: { /* later */ },
  ui: { isAccessAllowed: ({ session }) => session?.data.role?.canAccessDashboard ?? false },
  graphql: { extendGraphqlSchema: /* later */ },
})
```

```ts
// keystone.ts, optional compatibility only
export { default } from './cms.config'
```

### Why not only `keystone.ts`?

Pros of `keystone.ts`:

- Familiar to Keystone users.
- NKS already uses it.
- Easier migration of source model files.

Cons:

- Implies the official Keystone CLI/runtime is still in charge.
- Encourages `.keystone` artifact expectations and Next/admin assumptions.
- Confusing once imports are `src/features/cms/config` rather than `@keystone-6/core`.

### Why `cms.config.ts`?

Pros:

- Clearly marks this as TanStack-native CMS runtime.
- Avoids hidden dependency on Keystone CLI semantics.
- Lets us define config fields that intentionally differ from Keystone while preserving compatible `config()`, `list()`, `group()`, and field factory names.

Cons:

- Migration docs need a one-line shim or rename instruction.
- Existing Keystone examples still mention `keystone.ts`.

### Loader behavior

The generator should search in this order:

1. Explicit `--config <path>`.
2. `cms.config.ts` / `cms.config.mts` / `cms.config.js`.
3. `keystone.ts` / `keystone.js` compatibility fallback.

If both `cms.config.ts` and `keystone.ts` exist, prefer `cms.config.ts` and warn if they do not resolve to the same module.

---

## 5. Proposed generated output directory: `.cms` vs `.keystone`

### Recommendation

Use **`.cms/`** for TanStack-native generated artifacts.

Proposed structure:

```txt
.cms/
  config.cjs              # optional bundled config for generator/runtime diagnostics
  manifest.json           # normalized runtime config map
  manifest.ts             # optional typed manifest export
  admin-meta.json         # dashboard/adminMeta shape
  schema.graphql          # public GraphQL SDL
  schema.internal.graphql # later, sudo/internal schema snapshot
  types.ts                # generated CMS types
  runtime.ts              # helper exports consumed by app/runtime, if useful
  schema.prisma           # optional staging copy; see Prisma recommendation below
  artifact-hash.json      # hashes/source metadata for drift checks
```

Prisma output:

```txt
prisma/schema.prisma      # recommended initial Prisma schema path
```

### Why `.cms`?

- Avoids confusion with official Keystone `.keystone` outputs.
- Avoids accidental usage by Keystone CLI or Keystone-specific tooling.
- Signals that Next/Admin UI generation is intentionally absent.
- Keeps the door open for a compatibility shim without making compatibility the primary contract.

### Why not `.keystone`?

- Official Keystone uses `.keystone/config.js` and `.keystone/admin`; NKS has `.keystone/config.js` only because `keystone build --no-ui` bundled it.
- Reusing `.keystone` risks future agents/tools assuming official Keystone artifacts exist, including Admin UI code and `node_modules/.keystone/types.ts`.
- It makes it harder to enforce the ADR decision: build a TanStack-native runtime, not import Keystone's runtime.

### Compatibility option

If migration tooling later requires a Keystone-shaped path, generate an **explicit compatibility artifact**:

```txt
.keystone/config.js       # optional, generated only by `cms:generate --keystone-compat`
```

This should not be the default and should not include or imply Admin UI artifacts.

---

## 6. Exact artifacts to generate initially

Initial generator should produce deterministic artifacts from the existing registry/runtime metadata. It should not try to solve auth, upload, full hook lifecycle, or all Keystone field internals in slice 1.

### 6.1 `.cms/manifest.json`

Purpose: runtime and dashboard source of truth for normalized list config.

Contents:

```json
{
  "version": 1,
  "generatedAt": "<iso>",
  "source": {
    "configPath": "cms.config.ts or src/features/cms/registry.ts",
    "hash": "sha256:..."
  },
  "db": { "provider": "postgresql", "prismaSchemaPath": "prisma/schema.prisma" },
  "lists": [
    {
      "key": "Todo",
      "path": "todos",
      "label": "Todos",
      "singular": "Todo",
      "plural": "Todos",
      "graphql": { "names": { "itemQueryName": "todo", "listQueryName": "todos" } },
      "fields": [
        { "path": "label", "kind": "text", "validation": { "isRequired": true } }
      ]
    }
  ],
  "storage": { "my_images": { "kind": "s3", "type": "image" } },
  "capabilities": {
    "manyMutations": false,
    "authMutations": false,
    "uploads": false,
    "internalSchema": false
  }
}
```

Notes:

- For access/hooks functions, store stable IDs/paths in JSON and keep executable functions in a generated TS module or original config import. JSON should not pretend to serialize functions.
- Include `artifactVersion`/`runtimeVersion` to allow invalidation after generator format changes.

### 6.2 `.cms/admin-meta.json`

Purpose: dashboard can load metadata without invoking GraphQL in build-time contexts, while Yoga can still expose `keystone.adminMeta`.

Shape should match current `AdminMeta` from `src/features/cms/types.ts`:

- `AdminMeta.lists` (`types.ts:103-105`).
- Each list includes query names, labels, path, initial columns/search fields, flags, groups, fields (`types.ts:85-102`).
- Fields include label, view modes, `fieldMeta`, filter/order flags, nullability (`types.ts:67-83`).

### 6.3 `.cms/schema.graphql`

Purpose: public schema snapshot.

Initial generation can write `cmsTypeDefs` from `src/features/cms/runtime.ts:539` or, preferably, print the executable schema with `printSchema(cmsGraphQLSchema)`. Keystone writes a generated-file header (`artifacts.ts:12-18`); we should do the same with CMS wording.

Must include current list-generated GraphQL:

- Output object types for `Todo`, `User`, `Role`, `TodoImage` (`runtime.ts:303-306`).
- Where/create/update/order/relation inputs (`runtime.ts:308-355`).
- Root queries (`runtime.ts:364-367`).
- Single mutations (`runtime.ts:374-376`).
- `keystone.adminMeta` (`runtime.ts:384-386`, `541-547`).

Near-future: add many mutations using existing GraphQL name fields (`src/features/cms/gql-names.ts:30-52`; `types.ts:54-65`).

### 6.4 `prisma/schema.prisma`

Purpose: actual Prisma CLI schema.

Initial options:

1. **Generate the current fixed starter schema** from `cmsLists`.
   - Best for replacing `keystone build --no-ui` because it removes the current hand-authored schema drift risk.
   - The generator can start with a simple field-kind mapping that exactly reproduces current `prisma/schema.prisma`.

2. **Validate only** against the current hand-authored `prisma/schema.prisma`.
   - Lower risk for first artifact slice.
   - Does not fully answer the user's Prisma schema generation need.

Recommendation: implement **generate with `--check` mode**. First worker may start with validation-only if time is constrained, but the design target is generated Prisma.

Initial mapping to reproduce current schema:

- `id`: `String @id @default(cuid())`.
- `text`: `String` if required, `String?` otherwise.
- `checkbox`: `Boolean @default(false)` where default false.
- `integer`: `Int`, defaults/validation as comments or mapped defaults.
- `float`: `Float`.
- `decimal`: `String` initially to match current runtime (`budget String @default("0.00")`), not Prisma Decimal yet.
- `bigInt`: `String?` initially to match current runtime serialization.
- `timestamp`: `DateTime?`.
- `json`, `document`, `image`, `multiselect`: `Json?` or `Json @default("[]")` for tags to match current schema.
- `password`: `Boolean @default(false)` initially to match current stub; later switch to hashed `String?` with migration.
- To-one relationship: relation field plus `<field>Id String?`, e.g. `assignedToId`, `assignedTo User? @relation(fields: [assignedToId], references: [id], onDelete: SetNull)`.
- To-many inverse: `OtherModel[]`.
- Many-to-many: named relation, e.g. `Todo.todoImages TodoImage[] @relation("TodoImages")`, `TodoImage.todos Todo[] @relation("TodoImages")`.

Add generated header:

```prisma
// This file is automatically generated by the TanStack CMS generator; do not edit manually.
// Modify cms.config.ts / CMS model config and run `npm run cms:generate`.
```

### 6.5 `.cms/types.ts`

Purpose: typed app integrations and future context/query/db APIs.

Initial contents:

- `export type CmsListKey = 'Todo' | 'User' | 'Role' | 'TodoImage'`.
- Item interfaces or loose generated shapes matching current fields.
- `CmsCreateInputByList`, `CmsUpdateInputByList`, `CmsWhereInputByList` maps.
- Re-export or define `CmsSession`, `RoleData`, `CmsContext` matching `src/features/cms/adapters/types.ts:9-31`.

Do not block the first generator on perfect field-level TypeScript. A high-value first version can be list keys, GraphQL names, and manifest types.

### 6.6 `.cms/runtime.ts` / `.cms/index.ts` helper exports

Purpose: stable import target for runtime and scripts.

Possible initial file:

```ts
export { default as manifest } from './manifest.json'
export { default as adminMeta } from './admin-meta.json'
export type { CmsListKey } from './types'
```

If TS JSON imports are awkward, generate a `.ts` file with `as const` literal exports.

Later this can export executable config function bindings for access/hooks that cannot live in JSON.

### 6.7 Optional `.cms/config.cjs`

Purpose: match Keystone's reason for `.keystone/config.js`: avoid TS/ESM loader ambiguity in CLI scripts.

Use esbuild/tsx to load config. For first implementation, using `tsx` to import `cms.config.ts` may be enough. If bundling is needed, generate `.cms/config.cjs`, not `.keystone/config.js`.

---

## 7. Proposed package scripts replacing NKS scripts

Current TanStack scripts do not run generator before Vite/Prisma. Proposed script model:

```json
{
  "scripts": {
    "cms:generate": "tsx scripts/cms-generate.ts",
    "cms:check": "tsx scripts/cms-generate.ts --check",
    "cms:clean": "rm -rf .cms",

    "dev": "npm run cms:generate && vite dev --port 3000",
    "build": "npm run cms:check && vite build",
    "preview": "vite preview",

    "db:generate": "npm run cms:generate && prisma generate --schema prisma/schema.prisma",
    "db:push": "npm run cms:generate && prisma db push --schema prisma/schema.prisma",
    "db:migrate": "npm run cms:generate && prisma migrate deploy --schema prisma/schema.prisma",
    "db:migrate:dev": "npm run cms:generate && prisma migrate dev --schema prisma/schema.prisma",
    "db:seed": "prisma db seed",

    "test": "vitest run",
    "test:cms": "npm run cms:check && tsx scripts/validate-cms-crud.ts",
    "test:cms:prisma": "npm run cms:check && tsx scripts/validate-cms-prisma.ts"
  }
}
```

Notes:

- `dev` should generate rather than check to preserve NKS behavior (`keystone build --no-ui` generated before dev).
- `build` should probably use `cms:check` in CI to catch uncommitted stale generated files. If generated files are not committed, use `cms:generate` before `vite build` instead. Decide repository policy explicitly.
- `db:*` commands must never run against stale Prisma schema. Always generate/check first.
- If `prisma/schema.prisma` is generated but not committed, use `cms:generate` before every Prisma command.
- If committed, use `cms:check` in CI and `cms:generate` locally.

---

## 8. Implementation phases

### Phase 0 — Artifact policy decision

Decide before coding:

- Are `.cms/*` files committed? Recommended: commit `.cms/schema.graphql`, `.cms/admin-meta.json`, `.cms/manifest.json`, `.cms/types.ts` while the project is small, because drift checks are valuable and reviewers can see schema changes.
- Is `prisma/schema.prisma` committed? Recommended: yes, because Prisma migrations should be reviewable and schema changes are DB-impacting.
- Is `.cms/config.cjs` committed? Recommended: no, treat bundled config as cache/build output if generated.

### Phase 1 — Artifact-only generator from existing runtime/registry

Goal: replace the mechanical part of `keystone build --no-ui` without changing runtime behavior.

Tasks:

1. Add `scripts/cms-generate.ts`.
2. Load existing runtime/registry:
   - `cmsLists` from `src/features/cms/registry.ts`.
   - `getAdminMeta()` from `src/features/cms/admin-meta.ts`.
   - `cmsTypeDefs` or `cmsGraphQLSchema` from `src/features/cms/runtime.ts` / `graphql.ts`.
3. Write:
   - `.cms/manifest.json`.
   - `.cms/admin-meta.json`.
   - `.cms/schema.graphql`.
   - `.cms/types.ts` with minimal generated list/name types.
4. Implement `--check` by comparing would-be contents to disk, following Keystone's `validateArtifacts()` behavior (`artifacts.ts:30-50`).
5. Leave `prisma/schema.prisma` untouched in the very first slice if needed, but include it in artifact hashes as an unmanaged/manual schema warning.

Acceptance:

- `npm run cms:generate` writes deterministic files.
- `npm run cms:check` fails after manually editing a generated file.
- `npm run test:cms` still passes.
- No runtime behavior changes.

### Phase 2 — Generate Prisma schema for current starter models

Goal: remove hand-authored Prisma schema as independent source of truth.

Tasks:

1. Build a small `src/features/cms/prisma/schema-printer.ts` or script-local printer using `cmsLists`.
2. Reproduce current `prisma/schema.prisma` exactly except for generated header/formatting.
3. Format with Prisma formatting if available, or run `prisma format --schema prisma/schema.prisma` after writing.
4. Update `cms:check` to include Prisma schema drift.
5. Update `db:*` scripts to run generator first.

Acceptance:

- Generated `prisma/schema.prisma` is compatible with existing Prisma adapter and seed.
- `prisma generate --schema prisma/schema.prisma` succeeds.
- Existing `test:cms` and Prisma validation succeed where DB is configured.

### Phase 3 — Config entrypoint loader

Goal: move source of truth from hard-coded `cmsLists` to `cms.config.ts` while preserving the existing registry as generated/derived output.

Tasks:

1. Add root `cms.config.ts` using `src/features/cms/config` and field factories.
2. Optionally keep `keystone.ts` shim.
3. Extend generator to load config by path using `tsx` import or esbuild bundle.
4. Use `initialiseLists(cmsConfig)` (`config.ts:80-82`) to derive lists.
5. Generate a registry/manifest consumed by runtime.
6. Update runtime to use generated manifest or initialized config instead of importing `cmsLists` directly.

Acceptance:

- Adding a list in `cms.config.ts` generates GraphQL/adminMeta/Prisma artifacts.
- `src/features/cms/registry.ts` is no longer a second source of truth, or it is generated and marked as such.

### Phase 4 — Rich initialized-list model

Goal: make generator architecture closer to Keystone.

Tasks:

1. Introduce initialized field metadata: DB field, GraphQL fragments, input/output resolvers, defaults, access, hooks, admin metadata.
2. Move field-kind logic out of `runtime.ts` into field factories or initialized field descriptors.
3. Resolve relationships before printing Prisma schema.
4. Add internal/sudo schema artifact.
5. Add many mutations and richer nested inputs.

Acceptance:

- Field factories own DB/GraphQL/admin metadata.
- Prisma schema and GraphQL schema derive from the same initialized lists.
- Runtime can support dynamic config beyond the starter models.

### Phase 5 — Auth/session/storage artifacts

Goal: support the NKS config features in `features/keystone/index.ts`.

Tasks:

1. Represent `session`, `createAuth`-like config, and `ui.isAccessAllowed` in manifest/TS helper exports.
2. Add generated/auth SDL and resolver hooks for authenticated item, password auth, end session, init-first-item.
3. Add image storage manifest for `my_images`.
4. Add Upload scalar/multipart support later.

Acceptance:

- Fresh app can initialize first admin.
- Dashboard access checks use generated config/session shape.
- Image fields have a real storage/runtime contract.

---

## 9. Worker prompt for first generator slice

```md
Task: Implement the first CMS artifact generator slice for tanstack-keystone-starter. Do not change runtime behavior beyond adding scripts/artifact generation. Do not import official Keystone runtime.

Context:
- Design report: `cms-generator-design.md`.
- Current runtime generates SDL from registry in `src/features/cms/runtime.ts`:
  - `cmsTypeDefs` exported at line 539.
  - list SDL generation at lines 261-356.
  - root query/mutation SDL generation at lines 359-392.
- Yoga schema is in `src/features/cms/graphql.ts`; `cmsGraphQLSchema` is created from `cmsTypeDefs` and `cmsResolvers`.
- Admin metadata comes from `src/features/cms/admin-meta.ts` and current list source is `src/features/cms/registry.ts`.
- Existing thin DSL exists in `src/features/cms/config.ts` and `src/features/cms/fields/index.ts`, but do not migrate the registry to root `cms.config.ts` in this slice.
- Official Keystone reference:
  - `packages/core/src/artifacts.ts` shows build/generate/check behavior.
  - `packages/core/src/scripts/build.ts` shows `keystone build --no-ui` still generates GraphQL/Prisma/types/client and skips Admin UI.

Goal:
Add `scripts/cms-generate.ts` plus package scripts so `npm run cms:generate` writes deterministic generated artifacts under `.cms/`, and `npm run cms:check` validates drift.

Generate initially:
1. `.cms/manifest.json` from `cmsLists`, including list keys, paths, labels, fields, groups, GraphQL names from `getGraphQLNames`, source hash, artifact version, and capabilities.
2. `.cms/admin-meta.json` from `getAdminMeta()`.
3. `.cms/schema.graphql` from the executable `cmsGraphQLSchema` via `printSchema` if possible; fall back to `cmsTypeDefs` if printing causes toolchain issues. Add generated-file header.
4. `.cms/types.ts` with at least generated `CmsListKey`, `CmsGraphQLNamesByListKey`, and manifest/adminMeta type exports.
5. `.cms/artifact-hash.json` or equivalent content hashes to aid debugging (optional if `--check` directly compares contents).

Package scripts:
- Add `cms:generate`: `tsx scripts/cms-generate.ts`.
- Add `cms:check`: `tsx scripts/cms-generate.ts --check`.
- Do not wire `dev`/`build` to generator unless the task owner explicitly approves script behavior changes; if you do update scripts, use the design report recommendations.

Implementation notes:
- Create parent dirs recursively.
- Use stable JSON stringify with sorted keys or deterministic object construction to avoid flaky diffs.
- `--check` must compute all would-be outputs and fail with a clear list of stale/missing files, without writing files.
- Do not generate Prisma schema in this first slice unless the implementation is straightforward and exactly reproduces current `prisma/schema.prisma`; otherwise write a TODO/warning in manifest capabilities that Prisma schema is currently hand-authored.
- Do not touch Keystone source or NKS.

Validation:
- Run `npm run cms:generate`.
- Run `npm run cms:check`.
- Run `npm run test:cms`.
- If TypeScript/lint impact is possible, run `npm run build` or at least `npx tsc --noEmit` if configured.

Success criteria:
- The four `.cms` artifacts are generated deterministically.
- `cms:check` passes immediately after generation and fails after modifying an artifact.
- Existing CMS CRUD validation still passes.
- No Next/Admin UI generation and no official Keystone runtime import.
```

---

## 10. Risks and mitigations

### Stale generated files

Risk: Runtime, dashboard, Prisma, and generated artifacts diverge.

Mitigations:

- Implement `cms:check` immediately, modeled on Keystone `validateArtifacts()` (`artifacts.ts:30-50`).
- Run `cms:check` in CI and before `build` if generated files are committed.
- Include source hash and generator version in `.cms/manifest.json`.
- Add generated-file headers to all artifacts.

### Source-of-truth conflicts

Risk: `cmsLists`, `cms.config.ts`, generated manifest, and `prisma/schema.prisma` all become independent sources.

Mitigations:

- Phase 1: explicitly document `cmsLists` is still source of truth.
- Phase 2: make Prisma schema generated or validated from `cmsLists`.
- Phase 3: make `cms.config.ts` source of truth and make registry/manifest generated.
- Avoid editing generated `registry.ts` manually if one is introduced.

### Prisma migration safety

Risk: Automatically rewriting `prisma/schema.prisma` can create destructive migrations or hide DB changes.

Mitigations:

- Keep `prisma/schema.prisma` committed and reviewable.
- Require `cms:generate` before `prisma migrate dev/deploy`.
- Do not auto-run `prisma migrate` inside `dev` unless intentionally matching NKS. NKS runs `migrate deploy` on dev/build, but TanStack should be more conservative unless product explicitly wants that behavior.
- Use generated schema headers and drift checks.
- In the initial printer, reproduce current schema before changing field mappings (especially `password`, `decimal`, `bigInt`, `image`, and JSON defaults).

### Function serialization in manifest

Risk: Access rules, hooks, `ui.isAccessAllowed`, session callbacks, and `extendGraphqlSchema` are functions and cannot be represented in JSON.

Mitigations:

- JSON manifest stores serializable metadata and function reference IDs/paths only.
- Generated TS helper module imports original config for executable functions.
- Runtime should accept both JSON metadata and executable initialized config.

### False Keystone parity

Risk: Having generated artifacts may imply full Keystone behavior that does not exist yet.

Current gaps from existing reports:

- No dynamic registry -> Prisma schema/migration generation yet.
- No full hook lifecycle.
- No full access/filter behavior parity.
- No Keystone-style `context.db`/`context.query` APIs.
- No auth/session mutations/init-first-item.
- No upload/image storage implementation.
- No many mutations yet.
- Prisma adapter is first-pass.

Mitigation: Include manifest `capabilities` and keep docs honest.

### `.cms` ignored or committed incorrectly

Risk: Generated artifacts are accidentally omitted from repo or always dirty.

Mitigations:

- Decide artifact policy in Phase 0.
- If committed, do not gitignore `.cms/*.json`, `.cms/*.graphql`, `.cms/types.ts`; do ignore `.cms/config.cjs` if used as cache.
- Use stable formatting/sorted keys.

### Keystone source copying/licensing

Risk: Copying internals creates maintenance/license burden.

Mitigations:

- Use Keystone source as reference; rebuild small equivalents.
- Keystone core is MIT per existing audit, but preserve notices if substantial source is copied.
- Do not vendor `initialise-lists.ts`, `createSystem`, field factories, or Admin UI wholesale.

---

## 11. Design answers to user's specific questions

### Do we need a Keystone config file?

We need a **CMS config file**, yes. The recommended canonical file is `cms.config.ts`, with optional `keystone.ts` shim for migration compatibility. The config should preserve Keystone-like authoring (`config`, `list`, `group`, field factories) but import from our TanStack CMS modules, not `@keystone-6/core`.

### Do we need a generated config map?

Yes. Generate `.cms/manifest.json` and possibly `.cms/manifest.ts`. This becomes the stable config/list/field map for runtime, dashboard, and validation. It should include GraphQL names, field metadata, storage/session summaries, source hash, generator version, and capabilities.

### Do we need a generated Prisma schema?

Yes for the real replacement. Current `prisma/schema.prisma` is hand-authored and can drift from CMS config. Phase 2 should generate it from initialized list/field metadata. Initial generation should reproduce the current schema exactly before making semantic improvements.

### Do we need a generated GraphQL schema?

Yes. Generate `.cms/schema.graphql` from the executable Yoga schema or current SDL. It is the public schema artifact equivalent to Keystone's generated GraphQL schema and supports dashboard/query validation and CI drift checks.

### Do we need scripts?

Yes. Add at least `cms:generate` and `cms:check`, then wire `dev`, `build`, and `db:*` around them once approved. Keystone's NKS scripts put `keystone build --no-ui` before dev/build/migrate; TanStack should use `cms:generate`/`cms:check` instead.

### Do we need Next/Admin UI artifacts?

No. The replacement explicitly excludes `.keystone/admin`, generated Next pages, and Keystone Admin UI build. GraphQL Yoga remains embedded in TanStack Start (`src/features/cms/graphql.ts`). Dashboard should consume generated adminMeta/GraphQL runtime, not a Keystone-generated Next app.

---

## 12. Final recommended target pipeline

```txt
cms.config.ts (or keystone.ts compatibility)
  -> load/bundle config for Node scripts
  -> resolve defaults
  -> initialize lists/fields/relationships
  -> generate adminMeta
  -> generate GraphQL public SDL (+ internal later)
  -> generate Prisma schema
  -> generate TypeScript types
  -> write .cms/* and prisma/schema.prisma
  -> optionally run prisma generate
  -> TanStack Start imports generated/runtime helpers
  -> GraphQL Yoga serves schema/resolvers
  -> dashboard consumes adminMeta + CRUD GraphQL
```

This replaces the useful parts of `keystone build --no-ui` while keeping Next stripped out and keeping the runtime under project control.
