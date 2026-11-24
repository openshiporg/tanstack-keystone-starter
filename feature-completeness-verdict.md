# Feature-completeness verdict: TanStack Keystone runtime vs original Keystone backend/runtime

Date: 2026-05-11

Scope: Keystone backend/runtime parity only. This verdict intentionally excludes Keystone's Next.js server runner, official Admin UI React app, and Admin UI build output. It includes the backend/runtime functionality needed by an in-app dashboard: config/list/field DSL, initialized list metadata, `adminMeta`, CRUD GraphQL, Prisma, access, hooks, context APIs, auth/session, storage/upload, code generation, and schema/artifact generation.

## 1. Verdict

**No. This TanStack Keystone version is not feature-complete with original Keystone.**

It is **not the same as original Keystone**. It is a **TanStack-native, clean-room partial runtime** that currently implements enough fixed-list CRUD to support the four starter models (`Todo`, `User`, `Role`, `TodoImage`) and a read-oriented dashboard prototype.

Bluntly:

- **`adminMeta`: partially implemented.** Good enough for basic dashboard metadata, but not generated from Keystone's initialized field/list system and not access/hook/UI-runtime equivalent.
- **CRUD creation: partially implemented.** Single and many CRUD mutations exist for all four fixed lists and pass memory validation; Prisma validation exists and was previously reported passing with local Postgres. This is still not Keystone CRUD parity because lifecycle hooks, nested writes, field input resolvers, access semantics, transactions, and official error behavior are missing.
- **GraphQL creation: partially implemented.** GraphQL Yoga is wired and schema is generated from `cmsLists`, but there is no Keystone-style `createSystem()`, public/internal schema pair, `extendGraphqlSchema`, action fields, full field-owned GraphQL fragments, or official type semantics.
- **Prisma: partially implemented.** There is a hand-authored Prisma schema and model-specific Prisma adapter for the four starter models. There is no registry/config-driven Prisma schema printer, generated artifacts, generic adapter, migration/codegen pipeline, or Keystone Prisma field mapping parity.
- **Everything else needed for backend parity: not complete.** Auth/session, password hashing, storage/upload, hooks lifecycle, dynamic access config, context APIs, nested relationship mutations, field factories, and artifact generation are still major gaps.

Current practical status: **usable fixed starter CRUD prototype**, not Keystone-compatible backend/runtime.

Estimated parity after the recent many-mutation work:

| Area | Verdict |
|---|---|
| Fixed four-list GraphQL CRUD demo | Moderate partial parity |
| In-app dashboard read metadata/listing needs | Early partial parity |
| Keystone-compatible configurable backend runtime | Low partial parity |
| Original Keystone backend feature completeness excluding Next/Admin UI | **Not feature-complete** |

## 2. What is currently implemented and validated

### Implemented in the TanStack runtime

- **Four starter lists are represented** in a hand-authored registry: `Todo`, `User`, `Role`, `TodoImage` (`src/features/cms/registry.ts`).
- **GraphQL Yoga endpoint exists** at `/api/graphql`:
  - `src/features/cms/graphql.ts` creates a Yoga schema from `cmsTypeDefs`/`cmsResolvers`.
  - `src/routes/api/graphql.ts` routes GET/POST to Yoga.
- **`keystone.adminMeta` exists**:
  - `src/features/cms/admin-meta.ts` converts `cmsLists` into dashboard metadata.
  - `src/features/cms/runtime.ts` exposes `Query.keystone.adminMeta`.
- **List-driven GraphQL schema generation exists** for the fixed registry:
  - output types,
  - where inputs,
  - order inputs,
  - create/update inputs,
  - relationship connect/disconnect/set inputs,
  - item/list/count queries,
  - single create/update/delete mutations,
  - many create/update/delete mutations.
- **Many mutations are now present** for all four lists:
  - `createTodos`, `updateTodos`, `deleteTodos`,
  - `createUsers`, `updateUsers`, `deleteUsers`,
  - `createRoles`, `updateRoles`, `deleteRoles`,
  - `createTodoImages`, `updateTodoImages`, `deleteTodoImages`.
- **Memory adapter exists** with seeded data, relationship resolution, basic filters/order/pagination, basic access filtering, scalar coercion/defaults, and basic validation (`src/features/cms/adapters/memory.ts`).
- **Prisma adapter exists** for the four fixed models (`src/features/cms/adapters/prisma.ts`). It maps list keys to hard-coded Prisma delegates and supports basic find/count/create/update/delete plus relationship reads/writes.
- **Prisma schema exists** for the four starter models (`prisma/schema.prisma`). It includes `User`, `Role`, `Todo`, and `TodoImage`.
- **A Keystone-like DSL foundation exists**:
  - `config()`, `list()`, `group()` in `src/features/cms/config.ts`,
  - metadata-only field factories in `src/features/cms/fields/index.ts`.
  These are additive skeletons, not the runtime source of truth.
- **Dashboard read path has started**:
  - dashboard list metadata/counts and list pages use GraphQL through `src/features/cms/graphql-client.ts` and related dashboard files per `dashboard-worker-output.md`.

### Validated

- I ran the memory CRUD validator during this audit:

```bash
cd /Users/junaid/code/tanstack-keystone-starter && npm run test:cms
```

Result:

```txt
CMS GraphQL memory CRUD validation passed.
```

- `scripts/validate-cms-crud.ts` validates:
  - `keystone.adminMeta`,
  - list/count queries,
  - relationship reads/counts,
  - password secrecy via `PasswordState { isSet }`,
  - `createTodo`, `updateTodo`, `deleteTodo`,
  - `createTodos`, `updateTodos`, `deleteTodos`,
  - `createRoles`, `updateRoles`, `deleteRoles`.
- `scripts/validate-cms-prisma.ts` exists and validates the Prisma adapter when `DATABASE_URL` and seed data are available. It covers fixed-list queries/counts, relationships, scalar and relationship filters, single CRUD, many mutations, password secrecy, and cleanup.
- `backend-many-mutations-output.md` reports successful prior validation with local Postgres:
  - `npm run db:push`,
  - `npm run db:seed`,
  - `CMS_ADAPTER=prisma npm run test:cms:prisma`,
  - `npm run lint`,
  - `npm run build`.

## 3. What is still missing, grouped by subsystem

### A. Keystone public config/list/field runtime

Missing or incomplete:

- No production `cms.config.ts`/`keystone.ts` source-of-truth runtime config.
- The current runtime still uses hand-authored `cmsLists` from `src/features/cms/registry.ts`.
- `config()`, `list()`, and `group()` exist, but they are thin wrappers/normalizers, not equivalent to Keystone config resolution.
- Field factories are metadata factories only. They do not return Keystone-style DB fields, GraphQL input/output fragments, hooks, access config, admin metadata, storage behavior, or field-owned resolvers.
- No reserved `fields.id` validation/default id injection equivalent.
- No full default resolution for db/graphql/server/ui/session options.

Official Keystone reference:

- `packages/core/src/schema.ts` validates `fields.id`, injects an id field, validates db provider, sets defaults, and defines `extendGraphqlSchema` defaults.
- `packages/core/src/lib/core/initialise-lists.ts` calls each field factory with `{ provider, lists, listKey, fieldKey }` and composes DB/GraphQL/access/hook metadata.

### B. System creation and initialized-list architecture

Missing or incomplete:

- No Keystone-style `createSystem()` equivalent.
- No initialized list object comparable to Keystone's `InitialisedList`.
- No public/internal GraphQL schema pair.
- No true internal/sudo schema with omit/access disabled.
- No system-level artifact paths, config loading, or runtime manifest.

Official Keystone reference:

- `packages/core/src/lib/system.ts` runs `initialiseLists(config) -> createAdminMeta(config, lists) -> createGraphQLSchema(...)` and builds both public and internal schemas.

Current target evidence:

- `src/features/cms/runtime.ts` directly generates SDL from `cmsLists` and creates resolvers.
- `src/features/cms/adapters/types.ts` context only has `adapter`, `session`, `sudo()`, and `withSession()`.

### C. GraphQL schema parity

Implemented only partially:

- Queries and mutations exist for fixed lists.
- Many mutations exist now.
- Basic filters/order inputs exist.

Still missing:

- `config.graphql.extendGraphqlSchema`.
- Keystone action fields.
- Keystone `graphql.omit`/`isEnabled` semantics.
- Full official input nullability/defaults.
- Full `where` semantics, including field-owned `where.resolve` behavior and coercion.
- Full `orderBy` semantics and dynamic order access.
- `maxTake`/default arg behavior.
- Official error formatting/ordering.
- Cache hints/telemetry are absent.
- Many mutations do **not** implement Keystone's ordered `Promise.allSettled` behavior; current implementation loops sequentially and fails at first thrown adapter operation.

Official Keystone reference:

- `packages/core/src/lib/graphql.ts` composes schema and calls `extendGraphqlSchema`.
- `packages/core/src/lib/core/mutations/index.ts` builds single and many mutations and uses ordered all-settled behavior.
- `packages/core/src/lib/core/where-inputs.ts` resolves where inputs through field-owned resolvers.

### D. Relationship mutations

Implemented:

- To-one `connect` and `disconnect`.
- To-many `connect`, `disconnect`, and `set`.
- Relationship output resolution and relationship counts.

Missing:

- Nested relationship `create` in create/update inputs.
- Nested update/delete behavior.
- Keystone nested mutation ordering.
- Keystone relationship error aggregation and validation semantics.
- Full related-item existence and access checks.
- Transactional nested writes.

Official Keystone reference:

- `packages/core/src/lib/core/initialise-lists.ts` includes nested `create` on relate-to-one and relate-to-many inputs.
- `packages/core/src/lib/core/mutations/nested-mutation-one-input-resolvers.ts` and `nested-mutation-many-input-resolvers.ts` implement nested mutation behavior.

Current target evidence:

- `src/features/cms/runtime.ts` relationship inputs only expose connect/disconnect/set.
- `src/features/cms/adapters/memory.ts` comments explicitly say nested create is intentionally omitted.

### E. Access control

Implemented:

- Hard-coded starter access approximations exist in `runtime.ts`, `memory.ts`, and `prisma.ts`.
- Query/update/delete filters constrain some `Todo` and `User` operations.
- Some field write checks exist for `User.role`, `User.tasks`, `User.password`, and `Todo.assignedTo`.

Missing:

- Config-driven `access.operation`.
- Config-driven `access.filter`.
- Config-driven `access.item`.
- Field-level read/create/update access parity.
- Access return validation.
- Dynamic filter/order access.
- Sudo bypass. Current `sudo()` does not bypass access; it shallow-copies context.
- Access behavior is duplicated/hard-coded in memory and Prisma adapters.

Official Keystone reference:

- `packages/core/src/lib/core/access-control.ts` resolves operation/filter/item/field access and validates access return values.

### F. Hooks lifecycle

Missing except for hard-coded behavior:

- No generic field/list `resolveInput` hooks.
- No `validateInput`/`validateDelete` hook lifecycle.
- No `beforeOperation` hooks.
- No `afterOperation` hooks.
- No nested after-operation queue.
- The Todo `assignedTo` default is hard-coded in adapters, not modeled as a Keystone `resolveInput` hook.

Official Keystone reference:

- `packages/core/src/lib/core/initialise-lists.ts` parses field/list hooks.
- `packages/core/src/lib/core/mutations/index.ts` runs input resolvers, relationship resolvers, hooks, validation, before/after operation.

Current target evidence:

- `src/features/cms/adapters/memory.ts` has `applyTodoAssignedToDefault()`.
- `src/features/cms/adapters/prisma.ts` has a matching hard-coded Todo default in `mapCreateData()`.

### G. Context API

Current context is minimal:

- `adapter`,
- `session`,
- `sudo()`,
- `withSession()`.

Missing:

- `context.db`.
- `context.query`.
- `context.prisma`.
- `context.graphql.raw`.
- `context.graphql.run`.
- `context.graphql.schema`.
- `context.transaction`.
- `context.withRequest`.
- `context.internal()`.
- `context.req`/`context.res`.
- `context.sessionStrategy`.
- `context.__internal`.
- Real sudo/internal schema behavior.

Official Keystone reference:

- `packages/core/src/lib/context/createContext.ts` constructs all of the above and wires public/internal schemas.

### H. Auth/session runtime

Missing or prototype only:

- No stateless cookie sessions.
- No stored session strategy.
- No cookie/Bearer token parsing.
- No response `Set-Cookie` handling.
- No `authenticatedItem` query.
- No `authenticateUserWithPassword` mutation.
- No `endSession` mutation.
- No init-first-item flow.
- No password reset flow.
- No session data loader equivalent.
- Current auth is a development fallback session using `user_admin` and optional `x-cms-user-id`/`x-cms-anonymous` headers.

Official Keystone reference:

- `packages/core/src/session.ts` implements stateless/stored sessions.
- `packages/auth/src/gql/getBaseAuthSchema.ts` implements base auth GraphQL fields.

Security verdict:

- The current session behavior is not production-safe. It is a development shim.

### I. Field type parity

Implemented partially:

- The registry includes field kinds for id, text, password, checkbox, select, multiselect, relationship, document, timestamp, integer, float, decimal, bigInt, json, image.
- Basic scalar coercion/defaults/validation exist for some fields.
- Password output is hidden behind `PasswordState { isSet }`.

Missing or stubbed:

- **Password:** stored as Boolean, not a bcrypt/KDF hash. No compare/hash behavior. No real secret storage. No password validation parity.
- **Image:** stored as JSON, not Keystone's multi-column image metadata. No `Upload` input. No `ImageFieldOutput` type with storage-backed URL resolver. No local/S3 storage.
- **Document:** JSON stub only; no Keystone document field behavior/editor schema parity.
- **Text:** missing full default/null/empty-string semantics, match/length validation, unique where behavior.
- **Select/multiselect:** partial option validation, but not full field factory/admin/controller parity.
- **Decimal/BigInt:** represented as strings and basic filters only; not provider-aware field semantics.
- **Relationship:** only fixed refs; no full relationship validation/ownership/prisma relation-name resolution for arbitrary config.
- **Virtual/actions:** not meaningfully implemented.

Official Keystone reference:

- `packages/core/src/fields/types/password/index.ts` uses bcrypt/KDF and exposes `PasswordState`.
- `packages/core/src/fields/types/image/index.ts` uses `Upload`, storage strategies, metadata fields, and `ImageFieldOutput`.
- `packages/core/src/fields/types/*/index.ts` define per-field DB, GraphQL, validation, hooks, and admin metadata.

### J. Prisma/schema/codegen/artifacts

Implemented:

- `prisma/schema.prisma` manually defines `User`, `Role`, `Todo`, and `TodoImage`.
- `scripts/validate-cms-prisma.ts` validates the fixed Prisma adapter when database setup is available.
- Package scripts include `db:generate`, `db:push`, and `db:seed`.

Missing:

- No config/registry-driven Prisma schema printer.
- No generated GraphQL schema artifact.
- No generated TypeScript types equivalent to Keystone's generated types.
- No `.cms` manifest/admin-meta/schema/types artifact generation.
- No artifact drift validation.
- No migration wrapper that validates/generated artifacts before Prisma commands.
- Prisma adapter is model-specific via hard-coded `modelNameByListKey`.
- Adding a list/field to `cmsLists` will not update Prisma schema or migrations.

Official Keystone reference:

- `packages/core/src/lib/core/prisma-schema-printer.ts` prints Prisma schema from initialized lists.
- `packages/core/src/artifacts.ts` generates/validates Prisma schema, GraphQL schema, and types.

### K. Storage/upload

Missing:

- No `Upload` scalar or multipart upload handling configured for Keystone-style image/file fields.
- No local storage strategy.
- No S3-compatible storage strategy for `my_images`.
- No storage URL resolver.
- No file field parity.
- Images are JSON metadata stubs only.

### L. Dashboard backend-readiness

Implemented:

- Dashboard can fetch `adminMeta`, list counts, and list pages through the current GraphQL boundary.

Still backend-blocked:

- Create/update forms cannot be truly Keystone-compatible until field input serialization, hooks, access, nested relationships, auth, and storage exist.
- Relationship pickers cannot be fully correct until relationship mutation/access semantics are correct.
- Password, image, and document views cannot be correct until field runtime parity exists.
- Auth-gated dashboard behavior cannot be correct until session/auth runtime exists.

## 4. Does the current implementation import/bring in official Keystone?

**No. It does not bring in official Keystone runtime.**

It is a clean-room implementation under `src/features/cms`, using Keystone source as a reference.

Evidence:

- `package.json` has no `@keystone-6/core`, `@keystone-6/auth`, or other `@keystone-6/*` dependency.
- Source grep under `src/` found no `@keystone`, `keystone-6`, or `/Users/junaid/code/keystone` imports.
- Current runtime files import local modules only (`src/features/cms/runtime.ts`, `graphql.ts`, adapters, registry, admin-meta).
- ADR-001 explicitly accepts building a TanStack-native runtime and rejects importing Keystone's runtime directly.

This is the right architectural direction for the stated goal, but it means parity must be earned subsystem by subsystem. We did not get Keystone parity "for free" by importing Keystone.

## 5. Exact next implementation milestones to reach backend feature parity

These are the next backend milestones, in the order they should happen. Dashboard parity should wait behind these.

### Milestone 1 — Make CMS config the real source of truth

Deliverables:

- Add canonical `cms.config.ts`.
- Optionally add `keystone.ts` shim that re-exports `cms.config.ts` for migration familiarity.
- Port `Todo`, `User`, `Role`, and `TodoImage` models from `cmsLists` into local Keystone-style `config({ lists })`/`list({ fields })` files using local field factories.
- Make runtime derive `cmsLists`/adminMeta/GraphQL metadata from `initialiseLists(cmsConfig)`, not from a static registry.
- Add default id field injection and reserved `fields.id` validation.
- Keep current GraphQL output stable while changing the source of truth.

Acceptance:

- Adding a field through the DSL updates adminMeta and GraphQL without editing `registry.ts`.
- Existing `npm run test:cms` and Prisma validation still pass.

### Milestone 2 — Build an initialized-list layer

Deliverables:

- Introduce an internal initialized list/field model with:
  - list names,
  - field keys,
  - DB metadata,
  - GraphQL read/create/update/filter/order fragments,
  - access config,
  - hook config,
  - relationship metadata,
  - admin metadata fragments.
- Move current `fieldOutputType`, `fieldInputType`, `fieldFilterType`, orderability, and adminMeta behavior into field-owned methods/fragments.
- Validate relationships in a separate relationship resolution pass.

Acceptance:

- Runtime is no longer a pile of switch statements over `CmsField.kind` for every subsystem.
- Relationship refs are validated before serving GraphQL.

### Milestone 3 — Implement Keystone-like system/context architecture

Deliverables:

- Add `createCmsSystem(config)` equivalent:
  - resolve defaults,
  - initialize lists,
  - create adminMeta,
  - create public GraphQL schema,
  - create internal/sudo GraphQL schema.
- Implement real `context` shape:
  - `context.db`,
  - `context.query`,
  - `context.prisma`,
  - `context.graphql.raw/run/schema`,
  - `context.transaction`,
  - `context.withRequest`,
  - `context.withSession`,
  - `context.internal()`,
  - `context.sudo()` with actual access/omit bypass.

Acceptance:

- Source-style code can call `context.db.User.findMany`, `context.query.Todo.findMany`, and `context.sudo()`.
- Sudo behavior is tested and actually bypasses access.

### Milestone 4 — Replace hard-coded access with config-driven access

Deliverables:

- Implement list `access.operation`.
- Implement list `access.filter`.
- Implement list `access.item` where needed.
- Implement field read/create/update access.
- Implement dynamic filter/order access.
- Port current starter role rules into config functions instead of adapters/runtime.
- Remove duplicate hard-coded access rules from memory and Prisma adapters.

Acceptance:

- Access behavior is the same across memory and Prisma adapters.
- Invalid access return values throw clear errors.
- Tests cover admin, editor, anonymous, and sudo contexts.

### Milestone 5 — Implement hooks and input resolution lifecycle

Deliverables:

- Field and list `resolveInput` hooks.
- Field and list `validate` hooks.
- `beforeOperation` and `afterOperation` hooks.
- Nested after-operation queue.
- Move Todo `assignedTo` default into a hook.
- Field-owned input resolvers before adapter writes.

Acceptance:

- Hook order is tested for create/update/delete.
- Existing behavior is preserved, but no longer hard-coded into adapters.

### Milestone 6 — Complete GraphQL mutation/query parity for starter needs

Deliverables:

- Add nested relationship `create` for to-one and to-many create/update inputs.
- Add nested update/delete where feasible.
- Implement Keystone-like relationship validation/error behavior.
- Implement field-owned where input resolution.
- Improve unique filters beyond `id` where fields are unique and exposed.
- Add `maxTake`, default args, and official null/list semantics.
- Implement ordered `Promise.allSettled` error behavior for many mutations.
- Implement `extendGraphqlSchema` and support source starter's `redirectToInit`-style extension.

Acceptance:

- GraphQL SDL snapshot is compared against expected Keystone-like starter SDL.
- Dashboard form/query builders do not need target-specific hacks.

### Milestone 7 — Implement field type parity for starter fields

Deliverables:

- Password field:
  - hash secrets with bcrypt/KDF,
  - compare secrets for auth,
  - keep `PasswordState { isSet }` output,
  - never store Boolean stand-ins in production.
- Image field:
  - `Upload` input,
  - `ImageFieldOutput`,
  - metadata columns/shape,
  - storage URL resolver.
- Document field:
  - JSON AST behavior first,
  - editor/controller contract later.
- Text/select/multiselect/scalar validation parity.
- Relationship field DB ownership/relation naming parity for arbitrary config.

Acceptance:

- Existing starter models can be expressed with local field factories and behave like Keystone for backend operations.

### Milestone 8 — Implement Prisma artifact generation

Deliverables:

- Generate Prisma schema from initialized lists.
- Generate `.cms/schema.graphql` from public schema.
- Generate `.cms/admin-meta.json`.
- Generate `.cms/manifest.json`.
- Generate `.cms/types.ts` or equivalent generated TS types.
- Add artifact drift check.
- Make `dev`, `build`, and `db:*` scripts validate or generate artifacts before use.

Acceptance:

- Adding/changing a field updates Prisma schema deterministically.
- Drift is caught in CI.
- Prisma Client generation runs from generated schema.

### Milestone 9 — Implement auth/session/init-first-item

Deliverables:

- Stateless cookie sessions.
- Optional stored sessions later.
- `authenticatedItem` query.
- `authenticateUserWithPassword` mutation.
- `endSession` mutation.
- Init-first-item flow.
- Password reset flow later.
- Session data loading equivalent to source starter.
- Remove or production-gate dev fallback header/session behavior.

Acceptance:

- Fresh app can create first admin.
- Login/logout works through GraphQL and dashboard.
- Dashboard gating uses role/session data, not dev fallback assumptions.

### Milestone 10 — Implement storage/upload

Deliverables:

- Upload scalar/multipart handling in Yoga.
- Local image storage.
- S3-compatible `my_images` storage.
- Image metadata extraction and URL resolution.
- File field later if required.

Acceptance:

- `Todo.coverImage` and `TodoImage.image` can upload and query Keystone-like metadata/URLs.

## 6. Risks if dashboard parity is attempted before backend parity

The risk is high. Dashboard parity before backend parity will create false confidence and rework.

Specific risks:

1. **The dashboard will bake in non-Keystone API behavior.** Current image fields are JSON, passwords are booleans, nested relationship create is missing, and access/hook semantics are not Keystone-compatible.
2. **Form builders will be wrong.** Without field-owned create/update input resolvers, hooks, validation, and field controller metadata, create/update forms will serialize data in ways the later backend will reject or reinterpret.
3. **Relationship UI will be fragile.** Current relationship writes only cover connect/disconnect/set. Keystone-style nested create/update/delete and access-filtered relationship selectors are not ready.
4. **Security will be misleading.** Current sessions use dev fallback admin and optional headers. Building dashboard gating on this will hide real auth/session work and can produce unsafe assumptions.
5. **Prisma drift will break UI unexpectedly.** The Prisma schema is hand-authored. Adding dashboard-supported fields/lists will not automatically update migrations/schema/client.
6. **Access-aware adminMeta is not real yet.** Dashboard may show fields/actions that should be hidden or disabled once real access is implemented.
7. **Upload/document/password views cannot be correct.** These fields are stubs at runtime. Any polished UI for them will need rework after field parity lands.
8. **Testing will validate the wrong contract.** UI tests written now will lock in partial runtime behavior rather than Keystone-compatible behavior.
9. **Mutation UX will be built around current failure modes.** Keystone's many mutation error ordering, validation lifecycle, nested operation errors, and field errors are not implemented.
10. **Scope will sprawl.** Dashboard work will repeatedly discover backend gaps mid-UI implementation, causing churn across both layers.

Recommendation: continue dashboard read-only/listing work only as a thin consumer of current GraphQL. Do not claim dashboard parity or build full create/update/delete/image/document/auth flows until backend milestones 1-9 are substantially complete.

## Bottom line

This repo has brought in **some Keystone concepts**, not original Keystone itself.

It currently has:

- fixed-list `adminMeta`,
- generated CRUD GraphQL for four lists,
- many mutations,
- memory validation,
- a hand-authored Prisma schema and fixed Prisma adapter,
- early dashboard GraphQL consumption.

It does **not** yet have:

- official Keystone backend parity,
- full configurable runtime parity,
- real Keystone auth/session,
- real password/image/document behavior,
- full access/hooks/context semantics,
- generated Prisma/schema/types artifacts,
- or a production-safe dashboard backend foundation.

So the direct answer is: **No, the TanStack Keystone version is not the same as original Keystone and is not feature-complete yet. It is a clean-room partial runtime that implements a useful fixed CRUD slice, with many critical Keystone backend/runtime subsystems still missing.**
