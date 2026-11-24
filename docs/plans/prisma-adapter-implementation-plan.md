# Prisma Adapter Implementation Plan

## Purpose

Move `tanstack-keystone-starter` from in-memory demo CRUD to a real persistent GraphQL API backed by Prisma, while keeping the runtime list-driven and preparing for full Keystone parity.

This is the next required milestone after the first generated CRUD slice.

## Current status

`src/features/cms/runtime.ts` now owns GraphQL schema/resolver generation and operation-level access checks, while data operations are behind `src/features/cms/adapters/*`:

- `adapters/types.ts` defines `CmsAdapter`.
- `adapters/memory.ts` owns seeded in-memory data, reset helpers, filtering/order/pagination, defaults/validation, and relationship sync.
- `adapters/prisma.ts` is a first-pass Prisma-backed adapter for the four starter models.
- `CMS_ADAPTER=memory|prisma` selects the adapter; memory remains the default-safe path without `DATABASE_URL`.

Remaining Prisma work should harden the adapter against Keystone behavior rather than moving store logic back into runtime.

## Target adapter interface

Create `src/features/cms/adapters/types.ts`:

```ts
export type CmsListKey = string
export type CmsItem = Record<string, unknown> & { id: string }

export type FindManyArgs = {
  where?: unknown
  orderBy?: unknown
  take?: number
  skip?: number
  cursor?: { id: string }
  context: CmsContext
}

export type CreateArgs = {
  data: Record<string, unknown>
  context: CmsContext
}

export type UpdateArgs = {
  where: { id: string }
  data: Record<string, unknown>
  context: CmsContext
}

export interface CmsAdapter {
  findUnique(listKey: CmsListKey, where: { id: string }): Promise<CmsItem | null>
  findMany(listKey: CmsListKey, args: FindManyArgs): Promise<CmsItem[]>
  count(listKey: CmsListKey, args: Omit<FindManyArgs, 'take' | 'skip' | 'cursor' | 'orderBy'>): Promise<number>
  create(listKey: CmsListKey, args: CreateArgs): Promise<CmsItem>
  update(listKey: CmsListKey, args: UpdateArgs): Promise<CmsItem>
  delete(listKey: CmsListKey, where: { id: string }): Promise<CmsItem>
  transaction?<T>(fn: (adapter: CmsAdapter) => Promise<T>): Promise<T>
}
```

The exact types can change, but the design goal is stable: GraphQL resolvers depend on `CmsAdapter`, not memory arrays or Prisma directly.

## Task 1 — Extract memory adapter

**Description:** Move current store/seed behavior out of `runtime.ts` into `src/features/cms/adapters/memory.ts`.

Acceptance criteria:

- `runtime.ts` imports an adapter instance or factory.
- Seed data lives in memory adapter.
- Tests/dev can reset seed data.
- Existing CRUD GraphQL operations still work.

Verification:

- `npm run lint`
- `npm run build`
- In-process GraphQL smoke query/mutation works.

Likely files:

- `src/features/cms/runtime.ts`
- `src/features/cms/adapters/types.ts`
- `src/features/cms/adapters/memory.ts`
- `src/features/cms/adapters/index.ts`

## Task 2 — Add Prisma schema for starter models

**Description:** Add a hand-authored Prisma schema matching source starter `User`, `Role`, `Todo`, `TodoImage`.

Why hand-authored first:

- Faster path to a working persistent starter.
- Keeps registry -> Prisma schema printing as a later, isolated problem.
- Lets us validate runtime/adapter design before codegen complexity.

Initial model shape:

```prisma
model User {
  id        String @id @default(cuid())
  name      String
  email     String @unique
  password  String?
  roleId    String?
  role      Role?  @relation(fields: [roleId], references: [id])
  tasks     Todo[]
  createdAt DateTime @default(now())
}

model Role {
  id                    String @id @default(cuid())
  name                  String @unique
  canCreateTodos        Boolean @default(false)
  canManageAllTodos     Boolean @default(false)
  canSeeOtherPeople     Boolean @default(false)
  canEditOtherPeople    Boolean @default(false)
  canManagePeople       Boolean @default(false)
  canManageRoles        Boolean @default(false)
  canAccessDashboard    Boolean @default(false)
  assignedTo            User[]
}

model Todo {
  id          String @id @default(cuid())
  label       String
  description Json?
  isComplete  Boolean @default(false)
  status      String @default("pending")
  priority    Int @default(1)
  assignedToId String?
  assignedTo  User? @relation(fields: [assignedToId], references: [id])
  secretNote  String?
  metadata    Json?
  createdAt   DateTime @default(now())
  dueDate     DateTime?
  todoImages  TodoImage[] @relation("TodoImages")
}

model TodoImage {
  id        String @id @default(cuid())
  image     Json?
  imagePath String?
  altText   String?
  metadata  Json?
  todos     Todo[] @relation("TodoImages")
}
```

Adjust fields after comparing source model details.

Acceptance criteria:

- Prisma client generates.
- DB push/migrate works against configured database.
- Seed script inserts roles/users/todos/images.

Likely files:

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `package.json`
- `.env.example`

## Task 3 — Implement Prisma adapter

**Description:** Add `src/features/cms/adapters/prisma.ts` implementing `CmsAdapter`.

Implementation notes:

- Map list keys to Prisma delegates: `User -> prisma.user`, etc.
- Convert normalized runtime where/order args to Prisma where/order args.
- Keep first conversion limited to supported filters; throw clear errors for unsupported filter kinds.
- Convert relationship inputs:
  - to-one `connect` => `{ field: { connect: { id } } }`
  - to-one `disconnect` => `{ field: { disconnect: true } }`
  - to-many `set` => `{ field: { set: ids.map(id => ({ id })) } }`
  - to-many `connect`/`disconnect` similarly.
- Wrap create/update relation sync in Prisma writes instead of manual inverse sync.

Acceptance criteria:

- GraphQL CRUD works with Prisma adapter.
- Restarting dev server preserves data.
- Required sample operations work.

Likely files:

- `src/features/cms/adapters/prisma.ts`
- `src/features/cms/adapters/index.ts`
- `src/features/cms/runtime.ts`
- `src/features/cms/context.ts` maybe

## Task 4 — Adapter selection and environment

**Description:** Choose memory or Prisma adapter based on environment.

Options:

- `CMS_ADAPTER=memory|prisma`
- default to Prisma if `DATABASE_URL` exists, memory in tests.

Acceptance criteria:

- Tests can force memory adapter.
- Local dev can force Prisma.
- Missing Prisma DB errors are clear.

## Task 5 — Integration tests

**Description:** Add tests that run the same GraphQL operations against memory and Prisma adapters.

Acceptance criteria:

- Shared operation tests pass for memory.
- Prisma tests pass when `DATABASE_URL` is available or a local sqlite/postgres test DB is configured.
- Password/secret fields are never exposed.

## Validation commands

Minimum every slice:

```bash
npm run test:cms
npm run lint
npm run build
```

Prisma milestone:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

GraphQL smoke examples:

```graphql
query {
  todos {
    id
    label
    status
    isComplete
    assignedTo { id name }
    todoImages { id altText }
  }
  todosCount
}
```

```graphql
mutation {
  createTodo(data: { label: "Persistent parity" }) {
    id
    label
    status
    priority
    isComplete
    assignedTo { id }
  }
}
```

## Risks

| Risk | Mitigation |
|---|---|
| Runtime where format is not Prisma-compatible | Normalize filters in runtime before adapter call; write converter tests. |
| Relationship inverse sync differs between memory and Prisma | Let Prisma own relation sync; memory adapter should mimic Prisma behavior. |
| Hand-authored Prisma schema diverges from future registry | Treat hand-authored schema as Phase 2 only; add schema printer in later phase. |
| Access rules become adapter-specific | Keep access in runtime/context layer before adapter calls. |
| JSON/image/document stubs block real dashboard | Document stubs and implement storage in a later phase. |
