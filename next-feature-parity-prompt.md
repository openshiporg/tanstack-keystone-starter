# Next feature parity worker prompt: config-driven access + real sudo (with hook/context seams)

Task: Implement the next backend parity slice after generator/DSL work. Focus on replacing hard-coded starter access rules with config/list/field-driven access evaluation and making `context.sudo()` an actual access bypass. Do not work on dashboard UI. Do not import official Keystone runtime.

## Why this slice

The repo already has the high-impact CRUD/generator-adjacent work in place or underway:

- Many mutations are already implemented in `src/features/cms/runtime.ts` and validated by `scripts/validate-cms-crud.ts` / `scripts/validate-cms-prisma.ts` (`backend-many-mutations-output.md`).
- Thin local DSL exists in `src/features/cms/config.ts` and `src/features/cms/fields/index.ts`, but it is metadata-only and the runtime still imports `cmsLists` from `src/features/cms/registry.ts`.
- Prisma is still hand-authored/model-specific, but access/hook/context parity blocks correct behavior for both GraphQL and future Prisma schema generation.

The next highest-impact parity slice is **access/context semantics**, not dashboard work: current access logic is duplicated/hard-coded in `runtime.ts`, `adapters/memory.ts`, and `adapters/prisma.ts`, and `sudo()` is currently a shallow copy that does not bypass access.

## Current target evidence

Read these files before editing:

- `src/features/cms/types.ts`
  - Current `CmsField`/`CmsList` have no `access` or `hooks` metadata.
  - `GraphQLNames` already includes many mutation names and `updateManyInputName`.
- `src/features/cms/config.ts`
  - `config()`, `list()`, `group()`, `initialiseLists()` are thin normalizers only.
- `src/features/cms/registry.ts`
  - Fixed starter lists and fields. This is still the runtime source of truth.
  - Port starter rules here or through a derived config layer for this slice; do not require root `cms.config.ts` unless generator work has already made it canonical.
- `src/features/cms/runtime.ts`
  - `createCmsContext()` currently sets `sudo: () => ({ ...context, session })` and `withSession()` only.
  - `can()` / `assertOperationAccess()` hard-code operation access for `Role`, `TodoImage`, `Todo`, and `User`.
  - Resolvers call `assertOperationAccess()` at resolver entry, while adapters enforce query/update/delete filtering and some field write rules.
- `src/features/cms/adapters/types.ts`
  - `CmsContext` currently has only `adapter`, `session`, `sudo()`, and `withSession()`.
- `src/features/cms/adapters/memory.ts`
  - `accessFilter()` hard-codes query/update/delete filters.
  - `canWriteField()` hard-codes field create/update access for `User.role`, `User.tasks`, `User.password`, and `Todo.assignedTo`.
  - `applyTodoAssignedToDefault()` is a hard-coded hook-like behavior; leave it functional but create a seam to move it to hooks next.
- `src/features/cms/adapters/prisma.ts`
  - Duplicates the adapter-level `accessFilter()` logic and has no field-level write access equivalent, so memory/Prisma can drift.
- Validation scripts:
  - `scripts/validate-cms-crud.ts` covers memory CRUD, many mutations, relationships, and password state.
  - `scripts/validate-cms-prisma.ts` covers Prisma CRUD/many mutations when `DATABASE_URL` is configured.

Official Keystone references to mirror behavior shape, not copy wholesale:

- `/Users/junaid/code/keystone/packages/core/src/lib/core/access-control.ts`
  - `getOperationAccess()` returns booleans and validates return type.
  - `getAccessFilters()` returns `boolean | where-filter`, validates/coerces filters, and honors `context.__internal.sudo`.
  - `enforceListLevelAccessControl()` and `enforceFieldLevelAccessControl()` validate item/field access and throw clear access errors.
- `/Users/junaid/code/keystone/packages/core/src/lib/context/createContext.ts`
  - `sudo()` constructs an internal context with `__internal.sudo: true`; `withSession()` reconstructs context with the supplied session.
  - Full `context.db/query/graphql` is out of scope unless easy to add as stubs, but design the context shape so this can follow.
- `/Users/junaid/code/keystone/packages/core/src/lib/core/hooks.ts` and `fields/resolve-hooks.ts`
  - Use as reference for the next hooks slice. This task should add hook-friendly seams but does not need full hook lifecycle.

## Goal

Add a target-owned access module and metadata shape so access is resolved generically from list/field config instead of duplicated hard-coded code.

Implement at minimum:

1. Types/config shape
   - Add `access` metadata to `CmsList` and `CmsField` (or an initialized-list wrapper if generator/DSL work already introduced one).
   - Support list-level:
     - `access.operation.query/create/update/delete` returning `boolean`.
     - `access.filter.query/update/delete` returning `boolean | where`.
     - Optional `access.item.create/update/delete` if small enough; otherwise explicitly leave as TODO with a stable type seam.
   - Support field-level `access.read/create/update` returning `boolean`.
   - Preserve existing registry/list behavior when access config is omitted via defaults equivalent to allow-all where currently appropriate.

2. Central access resolver
   - Create a single module, e.g. `src/features/cms/access.ts`, with helpers like:
     - `getOperationAccess(listKey, operation, context)`
     - `assertOperationAccess(listKey, operation, context)`
     - `getAccessFilter(listKey, operation, context)`
     - `assertFieldAccess(listKey, field, operation, item, inputData, context)`
     - `isSudoContext(context)`
   - Validate access return values. Non-boolean operation/field returns and invalid filter returns should throw clear errors mentioning the list/field/access phase.
   - If `context.__internal?.sudo` is true, bypass operation/filter/field access.

3. Real sudo context
   - Extend `CmsContext` with an internal flag, e.g. `__internal: { sudo: boolean }`.
   - `createCmsContext()` should construct `__internal.sudo: false`.
   - `context.sudo()` should return a context with `__internal.sudo: true` and the same session/adapter.
   - `withSession()` should preserve the current sudo/internal state unless intentionally changed.

4. Port starter access rules into config/metadata
   - Express current rules in one place, not in runtime and both adapters.
   - Preserve existing behavior:
     - Anonymous users cannot query protected lists under the current dev/session model.
     - `Role`: query requires signed-in; create/update/delete require `role.canManageRoles`.
     - `TodoImage`: query requires signed-in; create/update/delete require `role.canCreateTodos` (matching current behavior).
     - `Todo`: create requires `role.canCreateTodos`; query requires signed-in plus existing owner/private visibility filter; update/delete are all todos for `canManageAllTodos`, otherwise assigned-to current user.
     - `User`: create allowed when `PUBLIC_SIGNUPS_ALLOWED=true` or `role.canManagePeople`; delete requires `canManagePeople`; query filters to self unless `canSeeOtherPeople`; update filters to self unless `canEditOtherPeople`.
     - Field writes: preserve current `User.role`, `User.tasks`, `User.password`, and `Todo.assignedTo` write restrictions.

5. Remove duplicated hard-coded access from adapters/runtime
   - Runtime resolvers should call the central `assertOperationAccess()`.
   - Memory and Prisma adapters should call the same `getAccessFilter()` for query/update/delete filtering.
   - Memory field writes should call the central field access helper.
   - Prisma create/update should enforce field write access too if it currently misses it.

6. Tests/validation
   - Update `scripts/validate-cms-crud.ts` to prove sudo bypasses access. Example: create an editor or anonymous context and show a normal restricted query/update is denied/filtered, then `context.sudo()` can query/update across access filters.
   - Add coverage that invalid access return values fail clearly if practical (can be a small unit-ish script path or targeted temporary list/config if the architecture supports it).
   - Keep many mutation validation passing.

## Hard constraints

- No dashboard UI work.
- No imports from `@keystone-6/*` or official Keystone runtime.
- Do not edit `/Users/junaid/code/keystone`; it is reference-only.
- Do not weaken existing access behavior while centralizing it.
- Keep memory and Prisma adapter behavior aligned.
- If generator/DSL work is actively changing source-of-truth files, adapt to the current branch state instead of reintroducing a second source of truth.

## Suggested implementation approach

1. Add access types to local CMS types and/or initialized metadata.
2. Add `src/features/cms/access.ts` that can find a list/field by key and evaluate defaults/configured functions.
3. Put starter access rules beside the current list metadata (or in a new `starter-access.ts`) and attach them to list/field metadata during initialization.
4. Extend `CmsContext` with `__internal.sudo` and update `createCmsContext()`, `sudo()`, `withSession()`.
5. Replace `runtime.ts` `can()` / `assertOperationAccess()` with imports from the central access module.
6. Replace adapter-local `accessFilter()` implementations with the central resolver. In Prisma, map returned CMS where filters through existing `mapWhere()` as today.
7. Replace memory `canWriteField()` with central field access; add equivalent Prisma field-access enforcement before `mapCreateData()` / `mapUpdateData()` or inside those mappers.
8. Run memory validation, then Prisma validation if a local Postgres `DATABASE_URL` is available.

## Validation criteria

Must pass:

```bash
npm run test:cms
npm run lint
npm run build
```

If Postgres is available, also run:

```bash
DATABASE_URL=postgresql://junaid@localhost:55432/tanstack_keystone npm run db:push
DATABASE_URL=postgresql://junaid@localhost:55432/tanstack_keystone npm run db:seed
DATABASE_URL=postgresql://junaid@localhost:55432/tanstack_keystone CMS_ADAPTER=prisma npm run test:cms:prisma
```

Add/confirm targeted assertions:

- `context.sudo()` bypasses operation/filter/field access in memory.
- Prisma adapter uses the same access filters as memory for query/update/delete.
- Field write restrictions still block unauthorized `User.role`, `User.tasks`, `User.password`, and `Todo.assignedTo` changes.
- Existing many mutations remain in SDL and continue passing validation.

## Stop/escalation rules

- If generator/DSL work has already introduced initialized list metadata, integrate access there; do not keep patching `registry.ts` as a competing source of truth.
- If deciding between access and full hook lifecycle becomes necessary, stop after access + sudo seams; hooks are the next slice.
- If adding full `context.db/query/graphql` would substantially expand scope, leave it for a follow-up context slice and only add the internal/sudo state needed for access.
