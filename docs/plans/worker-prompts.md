# Worker Prompts for Keystone Parity Implementation

Use these prompts in order. Each worker must read the referenced docs before editing.

## Shared instruction for all workers

You are working in `/Users/junaid/code/tanstack-keystone-starter`.

Before edits, read:

- `docs/decisions/ADR-001-keystone-parity-tanstack-runtime.md`
- `docs/plans/keystone-parity-roadmap.md`
- `keystone-core-parity-audit.md`

Source references:

- Keystone source: `/Users/junaid/code/keystone`
- Source starter: `/Users/junaid/code/next-keystone-starter`

Hard constraints:

- Build toward Keystone feature parity with Next stripped out.
- Do not make one-off Todo-only APIs.
- Preserve dynamic list-driven behavior.
- Do not import `@keystone-6/core` runtime into target app unless explicitly approved.
- Run `npm run lint` and `npm run build`; clean `.output`.

## Prompt 1 — Adapter boundary extraction

Implement Phase 1 Task 1 from `docs/plans/keystone-parity-roadmap.md` and `docs/plans/prisma-adapter-implementation-plan.md`.

Goal:
Extract the current in-memory store from `src/features/cms/runtime.ts` into an explicit adapter boundary.

Requirements:

- Add `src/features/cms/adapters/types.ts` with a `CmsAdapter` interface.
- Add `src/features/cms/adapters/memory.ts` containing current seed data and all direct memory CRUD operations.
- Refactor `runtime.ts` so GraphQL resolvers call the adapter instead of direct module-level arrays.
- Preserve existing GraphQL API behavior exactly.
- Add reset/seed helper for tests/dev.
- Add or update docs with adapter architecture notes.

Validation:

- `npm run lint`
- `npm run build`
- In-process GraphQL smoke operations still pass:
  - `todos/todosCount`
  - `createTodo`
  - `users/roles/todoImages` relationship query

Output:
Summarize changed files, adapter interface, validation, and remaining runtime direct-store references if any.

## Prompt 2 — Prisma schema and seed

Implement Phase 2 Task 1 from `docs/plans/prisma-adapter-implementation-plan.md`.

Goal:
Add Prisma dependencies, schema, and seed data for the starter models.

Requirements:

- Install `prisma`, `@prisma/client`, and any seed runner dependency if needed.
- Add `prisma/schema.prisma` for `User`, `Role`, `Todo`, `TodoImage` matching source model intent.
- Add `.env.example` with `DATABASE_URL`.
- Add package scripts:
  - `db:generate`
  - `db:push` or `db:migrate`
  - `db:seed`
- Add `prisma/seed.ts` or equivalent with demo roles/users/todos/images.
- Do not wire GraphQL to Prisma yet unless trivial; this task is schema/seed foundation.

Validation:

- `npx prisma generate`
- If a safe local DB URL is available, `npx prisma db push` and seed.
- `npm run lint`
- `npm run build`

Output:
Summarize schema choices, commands run, and any environment setup required.

## Prompt 3 — Prisma adapter implementation

Implement Phase 2 Tasks 2-4 from `docs/plans/prisma-adapter-implementation-plan.md`.

Goal:
Wire GraphQL CRUD to a persistent Prisma adapter while keeping memory adapter for tests.

Requirements:

- Add `src/features/cms/adapters/prisma.ts` implementing `CmsAdapter`.
- Map list keys to Prisma delegates.
- Convert supported where/order/pagination args to Prisma.
- Map relationship create/update inputs to Prisma `connect`, `disconnect`, `set`.
- Add adapter selection via `CMS_ADAPTER=memory|prisma` or equivalent.
- Keep access/default/validation in runtime layer where possible.
- Preserve `keystone.adminMeta`.
- Preserve memory adapter behavior.

Validation:

- `npm run lint`
- `npm run build`
- With Prisma DB configured and seeded, verify:
  - `todos { id label assignedTo { id name } }`
  - `createTodo(data: { label: "Persistent parity" })`
  - restart and confirm data persists.

Output:
Summarize adapter behavior, GraphQL operations verified, and remaining Prisma gaps.

## Prompt 4 — Keystone-style DSL and initialise-lists

Goal:
Move from hand-authored `cmsLists` descriptors toward a Keystone-compatible authoring DSL.

Requirements:

- Implement local `config()`, `list()`, `group()` helpers.
- Implement field factory stubs for source fields: `text`, `checkbox`, `integer`, `float`, `decimal`, `bigInt`, `timestamp`, `json`, `select`, `multiselect`, `relationship`, `password`, `image`, `document`.
- Port source starter models into target CMS schema files using this local DSL.
- Implement `initialiseLists()` that converts DSL configs into current runtime metadata.
- Keep GraphQL API behavior stable.

References:

- `/Users/junaid/code/keystone/packages/core/src/schema.ts`
- `/Users/junaid/code/keystone/packages/core/src/lib/core/initialise-lists.ts`
- `/Users/junaid/code/keystone/packages/core/src/fields/types/*/index.ts`

Validation:

- Existing GraphQL smoke operations pass.
- Adding a list through local `list({ fields })` automatically appears in adminMeta and GraphQL.

## Prompt 5 — Access/hooks/context parity

Goal:
Implement Keystone-like access/hook/context semantics for the target runtime.

Requirements:

- Port source access functions with minimal rewrites.
- Implement operation access, filter access, item access, and field access.
- Implement hook lifecycle and order.
- Add `context.query`, `context.db`, `context.sudo()`, `context.withSession()`.
- Add tests for access denial/filtering and hook order.

References:

- `/Users/junaid/code/keystone/packages/core/src/lib/core/access-control.ts`
- `/Users/junaid/code/keystone/packages/core/src/fields/resolve-hooks.ts`
- `/Users/junaid/code/next-keystone-starter/features/keystone/access.ts`

## Prompt 6 — Dashboard rebuild after runtime parity

Do not run until GraphQL runtime + Prisma + auth basics are working.

Read:

- `dashboard-handoff-context.md`

Goal:
Rebuild dashboard from scratch on TanStack Start, using GraphQL API and reusing field view/controller concepts from source dashboard.
