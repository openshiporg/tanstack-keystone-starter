# CMS GraphQL Contract Snapshot

Status: adapter-backed prototype with memory as the default-safe adapter and Prisma available through `CMS_ADAPTER=prisma` plus `DATABASE_URL`.

## Supported lists

The runtime generates Keystone-style CRUD fields from `src/features/cms/registry.ts` for:

- `User`
- `Role`
- `Todo`
- `TodoImage`

`keystone.adminMeta` remains available for the dashboard metadata contract.

## Supported queries

Each list exposes:

```graphql
query {
  todo(where: { id: "todo_launch" }) { id label }
  todos(where: { status: { equals: "todo" } }, orderBy: [{ label: asc }], take: 20, skip: 0) {
    id
    label
    assignedTo { id name }
    todoImages { id altText }
    todoImagesCount
    secretNote { isSet }
  }
  todosCount(where: { isComplete: { equals: false } })
}
```

Equivalent item/list/count query names are generated for `users`, `roles`, and `todoImages`.

## Supported mutations

Each list exposes one-item create/update/delete mutations:

```graphql
mutation {
  createTodo(data: {
    label: "Persistent parity"
    todoImages: { connect: [{ id: "image_dashboard" }] }
  }) {
    id
    label
    status
    priority
    isComplete
    assignedTo { id name }
  }
}
```

```graphql
mutation {
  updateTodo(
    where: { id: "todo_launch" }
    data: {
      isComplete: true
      todoImages: { disconnect: [{ id: "image_wireframe" }] }
    }
  ) {
    id
    isComplete
    todoImagesCount
  }
}
```

```graphql
mutation {
  deleteTodo(where: { id: "todo_launch" }) { id label }
}
```

Relationship inputs currently support `connect`, `disconnect`, and `set`. Nested `create`, nested `update`, and nested `delete` remain parity gaps.

## Adapter selection

- `CMS_ADAPTER=memory` uses the in-process seeded memory adapter.
- `CMS_ADAPTER=prisma` uses Prisma.
- If `CMS_ADAPTER` is unset, the runtime selects Prisma only when `DATABASE_URL` is present; otherwise memory is used.

Memory validation:

```bash
npm run test:cms
```

Prisma setup and repeatable validation:

```bash
cp .env.example .env
# Edit DATABASE_URL to point at a safe PostgreSQL database.
npm run db:generate
DATABASE_URL=postgresql://junaid@localhost:55432/tanstack_keystone npm run db:push
DATABASE_URL=postgresql://junaid@localhost:55432/tanstack_keystone npm run db:seed
DATABASE_URL=postgresql://junaid@localhost:55432/tanstack_keystone CMS_ADAPTER=prisma npm run test:cms:prisma
CMS_ADAPTER=prisma npm run dev
```

`test:cms:prisma` runs the generated GraphQL schema against the Prisma adapter and expects the seed data to be present. It covers list/count queries, scalar and relationship filters, relationship reads, create/update/delete mutations, to-many connect/disconnect/set, to-one connect/disconnect, and password-field secrecy (`PasswordState { isSet }` only).

## Known gaps

- No Keystone runtime import is used, but this is still a compact compatibility slice rather than full Keystone parity.
- No many mutations (`createTodos`, `updateTodos`, `deleteTodos`).
- No auth/session cookies; a development fallback admin session and `x-cms-user-id` header remain in use.
- Password fields return `{ isSet }`, but real password hashing/auth mutations are not implemented.
- Image fields are JSON metadata stubs; upload/storage is not implemented.
- Prisma schema is hand-authored for the four starter models; registry-to-Prisma schema generation is not implemented.
- Hooks and access lifecycle are approximated only for the source starter rules needed by current CRUD.
