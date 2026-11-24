# Keystone Parity Roadmap for TanStack Start

## Goal

Make `tanstack-keystone-starter` behave like `next-keystone-starter`, but with Keystone's Next-coupled runtime stripped out and replaced by a TanStack-native CMS runtime inside the app.

This means parity with Keystone's **dynamic config/list/field/GraphQL runtime**, not just dashboard metadata.

## Non-goals for early phases

- Do not prioritize dashboard polish before the GraphQL/runtime contract works.
- Do not build one-off Todo-only APIs.
- Do not import Keystone runtime into production TanStack code as the final solution.
- Do not claim parity until Prisma-backed CRUD, access, hooks, sessions, relationships, and generated schema behavior are validated.

## Source references

### Keystone source clone

- `/Users/junaid/code/keystone`

Key files:

- `packages/core/src/schema.ts` — public `config`, `list`, `group` wrappers.
- `packages/core/src/lib/createSystem.ts` — runtime pipeline: resolve config, initialise lists, create adminMeta, create GraphQL schema, create context.
- `packages/core/src/lib/core/initialise-lists.ts` — turns list/field config into initialized runtime metadata.
- `packages/core/src/lib/createGraphQLSchema.ts` — root GraphQL schema composition.
- `packages/core/src/lib/core/queries/*` — query field and resolver behavior.
- `packages/core/src/lib/core/mutations/*` — mutation resolver behavior and nested relationship inputs.
- `packages/core/src/lib/core/where-inputs.ts` — where/filter generation and resolution.
- `packages/core/src/lib/core/access-control.ts` — access control execution.
- `packages/core/src/fields/types/*/index.ts` — field type definitions and DB/GraphQL behavior.
- `packages/core/src/fields/filters/*` — field filter behavior.
- `packages/core/src/fields/resolve-hooks.ts` — hook resolution behavior.

### Source starter

- `/Users/junaid/code/next-keystone-starter/features/keystone/index.ts`
- `/Users/junaid/code/next-keystone-starter/features/keystone/context.ts`
- `/Users/junaid/code/next-keystone-starter/pages/api/graphql.ts`
- `/Users/junaid/code/next-keystone-starter/features/keystone/models/{User,Role,Todo,TodoImage}.ts`
- `/Users/junaid/code/next-keystone-starter/features/keystone/access.ts`

### Target starter

- `/Users/junaid/code/tanstack-keystone-starter/src/features/cms`
- `/Users/junaid/code/tanstack-keystone-starter/src/routes/api/graphql.ts`

## Current state

Implemented:

- TanStack Start app scaffold.
- shadcn/base UI setup.
- `keystone.adminMeta` GraphQL query.
- Adapter-backed, list-driven GraphQL CRUD runtime for `User`, `Role`, `Todo`, `TodoImage`.
- Memory adapter with resettable seed data and GraphQL CRUD validation script.
- Hand-authored Prisma schema/seed for the four starter models.
- Prisma adapter selectable via `CMS_ADAPTER=prisma` when `DATABASE_URL` is configured.
- Generated root queries/mutations from `cmsLists`.
- Basic relationship resolution, where/order inputs, access approximations, dev fallback session.

Not yet parity:

- No dynamic registry -> Prisma schema/migration generation.
- No full Keystone hooks lifecycle.
- No full access/filter behavior parity.
- No `context.db`/`context.query` Keystone-style APIs.
- No auth/session mutations or init-first-item flow.
- No upload/image storage implementation.
- No many mutations (`createTodos`, `updateTodos`, `deleteTodos`).
- No full nested relationship create/update/delete behavior.
- Prisma adapter has first-pass CRUD mapping only and still needs DB-backed integration validation in a configured database.
- Dashboard still mostly skeleton/static.

## Architecture target

```txt
src/features/cms/
  config.ts                 # public config/list/group DSL
  fields/                   # field factories: text, checkbox, relationship, image, password, etc.
  system/
    resolve-defaults.ts
    initialise-lists.ts
    create-system.ts
  graphql/
    create-schema.ts
    queries.ts
    mutations.ts
    filters.ts
    inputs.ts
    output-fields.ts
  access/
    resolve-access.ts
    apply-filter-access.ts
  hooks/
    resolve-hooks.ts
    run-hooks.ts
  adapters/
    types.ts
    memory.ts
    prisma.ts
  prisma/
    schema-printer.ts       # later phase
    migrations.ts           # later phase
  session/
    stateless.ts
    auth.ts
  storage/
    image.ts
    local.ts
    s3.ts
```

## Phase 1 — Stabilize runtime boundary and tests

**Purpose:** make the current in-memory runtime an explicit adapter-backed prototype instead of a pile of direct store logic.

Tasks:

1. Extract `CmsAdapter` interface.
   - Methods: `findUnique`, `findMany`, `count`, `create`, `update`, `delete`, `transaction?`.
   - Move seeded store logic into `adapters/memory.ts`.
   - Runtime resolvers call adapter, not module-level arrays.

2. Add GraphQL runtime tests.
   - In-process execute against `cmsGraphQLSchema` or Yoga.
   - Cover adminMeta, list/item/count, create/update/delete, relationship connect/set/disconnect, password secrecy.
   - Add reset/seed helper for memory adapter.

3. Document supported GraphQL contract.
   - Write `docs/graphql-contract.md` with sample queries/mutations and known gaps.

Acceptance:

- `npm run lint` passes.
- `npm run build` passes.
- Test command validates required GraphQL operations.
- No root resolver directly mutates global seeded arrays outside memory adapter.

## Phase 2 — Prisma-backed starter models

**Purpose:** make the starter real, persistent, and close to `next-keystone-starter` for the known four models.

Tasks:

1. Add Prisma dependencies and setup.
   - `prisma`, `@prisma/client`.
   - `prisma/schema.prisma` for `User`, `Role`, `Todo`, `TodoImage`.
   - `.env.example` with `DATABASE_URL`.
   - Scripts: `db:generate`, `db:migrate`, `db:push`, `db:seed`.

2. Implement `PrismaCmsAdapter`.
   - Map list keys to Prisma model delegates.
   - Convert where/order/take/skip to Prisma args.
   - Implement create/update/delete.
   - Relationship connect/disconnect/set maps to Prisma relation writes.

3. Add seed script matching source starter demo data.

4. Add runtime adapter selection.
   - Dev defaults to Prisma when `DATABASE_URL` exists.
   - Memory adapter allowed for tests.

Acceptance:

- Fresh DB can migrate/push and seed.
- `/api/graphql` returns persisted data.
- Required sample queries/mutations work after server restart.
- No data reset per process when Prisma adapter is active.

## Phase 3 — Keystone-style config/list/field DSL

**Purpose:** move from custom `cmsLists` objects to a Keystone-compatible config authoring model.

Tasks:

1. Implement `config()`, `list()`, `group()` wrappers.
2. Implement field factories for source starter fields:
   - `text`, `checkbox`, `integer`, `float`, `decimal`, `bigInt`, `timestamp`, `json`, `select`, `multiselect`, `relationship`, `password`, `image`, `document` stub.
3. Port source models into `src/features/cms/schema.ts` using the DSL.
4. Build `initialiseLists()` that produces runtime metadata from the DSL.
5. Keep old registry only as generated/derived output, then remove it.

Acceptance:

- Source-style model files can be authored without Keystone imports.
- GraphQL/adminMeta output remains compatible.
- Adding a list through `list({ fields })` creates GraphQL fields automatically.

## Phase 4 — Access, hooks, and context parity

**Purpose:** support enough Keystone runtime semantics that source starter access/hooks can be ported cleanly.

Tasks:

1. Implement list/field operation access resolution.
2. Implement filter access for query/update/delete.
3. Implement field read/create/update access.
4. Implement hook lifecycle:
   - `resolveInput`
   - `validateInput`
   - `validateDelete`
   - `beforeOperation`
   - `afterOperation`
5. Implement `context` shape:
   - `context.session`
   - `context.sudo()`
   - `context.withSession()`
   - `context.query`
   - `context.db`
   - `context.prisma` for Prisma adapter.

Acceptance:

- Source access functions can be ported with minimal changes.
- Hook order is tested for create/update/delete.
- Sudo bypass behavior is explicit and tested.

## Phase 5 — GraphQL parity expansion

**Purpose:** close API shape gaps with Keystone.

Tasks:

1. Add many mutations:
   - `createUsers`, `updateUsers`, `deleteUsers`, etc.
2. Add full nested relationship mutation inputs:
   - nested create/update/delete where feasible.
3. Add full scalar filter operators by field type.
4. Add field omit/isFilterable/isOrderable behavior.
5. Add unique constraints beyond `User.email`.
6. Add GraphQL schema snapshot tests vs expected Keystone-like SDL.

Acceptance:

- Dashboard's dynamic query builders can rely on Keystone-like names/types.
- Most Keystone Admin UI-generated queries work against the TanStack runtime for starter fields.

## Phase 6 — Auth/session/init-first-item

**Purpose:** replace Keystone auth/session package behavior used by the starter.

Tasks:

1. Implement stateless cookie sessions.
2. Implement password hashing and password field behavior.
3. Implement auth mutations:
   - authenticate by password.
   - end session.
   - init first item.
   - password reset token flow later.
4. Implement `redirectToInit` extension equivalent.
5. Wire dashboard route protection.

Acceptance:

- Fresh app can create first admin.
- Sign in/out works through GraphQL/dashboard.
- `ui.isAccessAllowed` equivalent uses `session.data.role.canAccessDashboard`.

## Phase 7 — Storage/image/document

**Purpose:** support the source starter's image/document fields.

Tasks:

1. Implement local image storage first.
2. Implement S3-compatible image storage with config key `my_images`.
3. Add Upload scalar/multipart support to Yoga route.
4. Implement Keystone-like image output shape.
5. Implement document field as JSON AST first; editor later.

Acceptance:

- `Todo.coverImage` and `TodoImage.image` can upload and query metadata.
- Storage config mirrors source starter enough to port settings.

## Phase 8 — Dashboard rebuild

**Purpose:** rebuild the custom Keystone dashboard on top of the TanStack GraphQL runtime.

Use `dashboard-handoff-context.md`.

Tasks:

1. Switch dashboard loaders to GraphQL boundary.
2. Rebuild list page with filters/sort/pagination.
3. Rebuild item/create forms.
4. Port field view registry/controllers.
5. Port relationship selectors.
6. Port image/document views.
7. Add auth screens/init flow.
8. Add AI sidebar only after core dashboard works.

Acceptance:

- Dashboard can manage all four starter lists through the TanStack GraphQL API.

## Checkpoints

After each phase:

- `npm run lint`
- `npm run build`
- GraphQL operation tests
- Update docs/gaps
- No new Next or Keystone runtime dependency unless explicitly documented

## Parallel work opportunities

Safe parallel work:

- Prisma adapter implementation after adapter interface is defined.
- Dashboard field-view analysis while GraphQL runtime progresses.
- Auth/session design doc while Prisma work happens.
- Tests for existing runtime.

Sequential work:

- Adapter interface before Prisma adapter.
- DSL/initialise-lists before registry removal.
- Prisma persistence before dashboard relies on real data.
- Auth/session before production dashboard access.
