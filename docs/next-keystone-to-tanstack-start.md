# Migrating `next-keystone-starter` to TanStack Start + shadcn/base UI

## 1. What `next-keystone-starter` is today

`/Users/junaid/code/next-keystone-starter` is a Next.js application that embeds a Keystone-style CMS/dashboard inside the application rather than exposing Keystone's generated hosted Admin UI. The important architectural split is:

- **Keystone is still the backend/codegen engine.** It owns list definitions, access/session/auth configuration, Prisma schema generation, generated `.keystone` types/config, GraphQL CRUD schema generation, `adminMeta`, and the runtime `keystoneContext`.
- **The visible dashboard is custom.** The app recreates the Keystone Admin UI screens with shadcn/Radix/Tailwind components under the app's own `/dashboard` routes. The Keystone Admin UI is disabled with `keystone build --no-ui`.
- **Next.js is the host framework.** Next App Router renders dashboard pages/layouts; a Pages API route hosts GraphQL Yoga; server actions fetch Keystone GraphQL data; React server components are used for SSR data flow.

In development and production builds, the app first runs Keystone code generation/build, applies Prisma migrations, then starts/builds Next. That means the current application is not merely importing a reusable Keystone library; it relies on Keystone's CLI and generated artifacts being valid before the Next runtime starts.

## 2. Specific source code paths and responsibilities

### Package scripts and dependency shape

Source: `/Users/junaid/code/next-keystone-starter/package.json`

Key scripts:

```json
{
  "dev": "keystone build --no-ui && npm run migrate && next dev",
  "build": "keystone build --no-ui && npm run migrate && next build",
  "migrate:gen": "keystone build --no-ui && tsx features/keystone/view-order/generate-view-order.ts && keystone prisma migrate dev",
  "migrate": "prisma migrate deploy"
}
```

Implications:

1. Keystone must run before Next because it generates `.keystone/config.js`, `.keystone/types`, Prisma artifacts, GraphQL schema, and the Prisma schema used by migrations.
2. The dashboard is intentionally not Keystone's Admin UI (`--no-ui`), but the backend still depends on Keystone packages and CLI behavior.
3. The package override pins Keystone's internal Next dependency:
   `"@keystone-6/core": { "next": "14.2.35" }`, which is a strong signal that Keystone's internals bring Next along even when the hosted Admin UI is disabled.

### Keystone entry point

Source: `/Users/junaid/code/next-keystone-starter/keystone.ts`

```ts
import config from './features/keystone';
export default config;
```

This is the CLI-facing entry point. Keystone loads this file to discover the app config.

### Keystone configuration

Source: `/Users/junaid/code/next-keystone-starter/features/keystone/index.ts`

Responsibilities:

- Creates auth with `@keystone-6/auth/createAuth`.
- Uses `@keystone-6/core/config` and `statelessSessions`.
- Registers lists from `features/keystone/models`.
- Configures PostgreSQL with `DATABASE_URL`.
- Configures S3-compatible image storage (`my_images`).
- Defines `ui.isAccessAllowed` based on `session.data.role.canAccessDashboard`.
- Extends GraphQL with custom mutations from `features/keystone/mutations`.
- Defines `initFirstItem` for the first admin user and default Admin role.
- Includes password reset email plumbing.

### Keystone context bridge

Source: `/Users/junaid/code/next-keystone-starter/features/keystone/context.ts`

Responsibilities:

- Calls `getContext(config, PrismaModule)` from `@keystone-6/core/context`.
- Imports generated `Context` from `.keystone/types`.
- Stores `keystoneContext` on `globalThis` in development to avoid multiple Prisma clients during hot reload.

This is the runtime bridge between generated Keystone internals and the application. The dashboard and GraphQL route ultimately depend on this object.

### GraphQL endpoint

Source: `/Users/junaid/code/next-keystone-starter/pages/api/graphql.ts`

Responsibilities:

- Disables Next's body parser for upload compatibility.
- Uses `graphql-upload/processRequest.js` for multipart form data.
- Creates a GraphQL Yoga handler at `/api/graphql`.
- Serves `keystoneContext.graphql.schema`.
- Builds request context with `keystoneContext.withRequest(req, res)`.
- Replaces default GraphiQL with Apollo's embedded sandbox.

This file is Pages Router-specific (`NextApiRequest`, `NextApiResponse`) and cannot be copied directly into TanStack Start. The concept can be ported: a TanStack Start server route should create a Fetch API-compatible Yoga endpoint.

### Dashboard routes

Source: `/Users/junaid/code/next-keystone-starter/app/dashboard`

Important paths:

- `app/dashboard/(admin)/layout.tsx` fetches admin meta and the authenticated user on the server, then renders `DashboardLayout`.
- `app/dashboard/(admin)/page.tsx` renders the dashboard home screen.
- `app/dashboard/(admin)/[listKey]/page.tsx` renders a list table.
- `app/dashboard/(admin)/[listKey]/create/page.tsx` renders an item create form.
- `app/dashboard/(admin)/[listKey]/[id]/page.tsx` renders an item detail/edit form.
- `app/dashboard/signin`, `signup`, `reset`, `init`, and `no-access` are auth/onboarding routes.

These are Next App Router files and use Next's routing conventions, server component model, and sometimes Next-only imports.

### Dashboard actions/components/views/lib

Source root: `/Users/junaid/code/next-keystone-starter/features/dashboard`

Key groups:

- `actions/*`: Next server actions that call Keystone GraphQL or implement auth/item/list mutations.
- `actions/getAdminMetaAction.ts`: runs Keystone's `adminMeta` GraphQL query and enhances each list with GraphQL operation names via `lib/getGqlNames.ts`.
- `lib/keystoneClient.ts`: GraphQL client wrapper for calling `/api/graphql`.
- `lib/getGqlNames.ts`: copied Keystone-style name generation for CRUD query/mutation names.
- `components/*`: dashboard layout, sidebar, breadcrumbs, filtering, sorting, pagination, table, and shared UI pieces.
- `screens/*`: page-level dashboard screens such as Home, List, Item, Create, SignIn, Reset, Init.
- `views/*`: field-controller/view implementations that mirror Keystone Admin UI behavior for field types: text, checkbox, password, relationship, select, multiselect, timestamp, document, image, JSON, numeric types, virtual fields, etc.

The reusable concepts are valuable, but most files need adaptation before running in TanStack Start because they use Next-specific imports (`next/link`, server actions, server components, route params, app layouts) and assume Keystone-generated `adminMeta` shape.

### Keystone model examples

Source root: `/Users/junaid/code/next-keystone-starter/features/keystone/models`

- `User.ts`: authentication user, role relationship, password field, tasks relationship, access rules.
- `Role.ts`: RBAC booleans such as `canAccessDashboard`, `canManagePeople`, `canManageRoles`, `canCreateTodos`, and `canManageAllTodos`.
- `Todo.ts`: representative content model with text, document, grouped fields, checkbox, select, multiselect, timestamp, float, decimal, BigInt, JSON, password, image, and relationships.
- `TodoImage.ts`: image/file model related to Todo.
- `index.ts`: exports `{ User, Role, Todo, TodoImage }` as `models`.

For this TanStack Start port, `Todo`, `User`, and `Role` metadata are good seed examples for a framework-neutral CMS registry, but the first implementation should not import Keystone packages.

## 3. Why Keystone should not be treated as a drop-in TanStack Start dependency long term

Keystone can likely be forced to run adjacent to a non-Next framework for some backend-only use cases, but it is not a clean long-term dependency for this target:

1. **Keystone's generated/runtime internals are deeply tied to Next.** Even when the Admin UI is disabled, Keystone packages and CLI workflows still generate app-specific internals and include Next assumptions.
2. **The current starter already avoids Keystone's hosted UI.** It uses `keystone build --no-ui` and recreates admin screens manually, which means the main retained value is now backend primitives/code generation rather than UI.
3. **The package override is a maintenance/security warning.** The current app pins Keystone's internal Next to `14.2.35`, while the app itself uses newer Next. This creates a hidden framework dependency and a security/update surface unrelated to the target runtime.
4. **TanStack Start route/server conventions differ from Next.** Next server actions, RSC conventions, Pages API handlers, `next/link`, and App Router layouts do not map 1:1 to Start.
5. **Generated `.keystone` artifacts couple application code to a CLI lifecycle.** A TanStack-native starter should eventually be able to build, migrate, and serve without first asking Keystone to synthesize framework-specific files.
6. **The desired product is Keystone-compatible behavior, not necessarily Keystone itself.** The target can preserve the useful contract: list schemas, fields, admin metadata, GraphQL CRUD, access rules, session/auth, Prisma integration, uploads, and a dashboard.

The recommended path is therefore a staged replacement: start with a decoupled registry and placeholder dashboard, then progressively recreate the backend/CMS primitives that the custom dashboard needs.

## 4. Proposed TanStack-native successor architecture

### High-level layers

```text
TanStack Start app
├─ src/routes
│  ├─ dashboard/*                 # Admin/dashboard UI routes
│  └─ api/graphql                 # Future GraphQL Yoga endpoint
├─ src/features/cms
│  ├─ registry/types              # Framework-neutral list and field DSL
│  ├─ admin-meta                  # Keystone-compatible adminMeta generation
│  ├─ graphql                     # CRUD schema generation with GraphQL Yoga
│  ├─ prisma                      # Prisma schema/migration integration
│  ├─ access                      # Operation/filter access rules
│  ├─ session/auth                # Cookie/session/password reset/init flow
│  └─ storage/uploads             # Local/S3 upload handling
└─ src/features/dashboard-shell   # TanStack/shadcn/base UI dashboard components
```

### Own schema/list registry

Create a small TypeScript DSL that captures only the primitives needed by the dashboard and backend:

- `listKey`, `path`, `label`, `singular`, `plural`, `description`.
- `fields` keyed by field path.
- Field types: `id`, `text`, `password`, `checkbox`, `select`, `multiselect`, `relationship`, `document`, `timestamp`, `integer`, `float`, `decimal`, `bigInt`, `json`, `image`, `virtual`.
- Field UI metadata: label, description, create/item/list field modes, list columns, grouping, card fields, inline relationship options.
- Access metadata: operation access and filter access hooks.
- Hooks metadata: initially stored but not necessarily executable until mutation handling exists.

The first skeleton in this repo should keep this registry static and framework-neutral. Later phases can make it executable.

### Admin meta generation

Generate Keystone-like `adminMeta` from the registry so that the copied/adapted dashboard can continue to think in familiar terms:

- list fields: `key`, `path`, `label`, `singular`, `plural`, `description`, `initialColumns`, `initialSearchFields`, `pageSize`, `labelField`, `isSingleton`, `isHidden`, `hideCreate`, `hideDelete`.
- field metadata: `path`, `label`, `description`, `fieldMeta`, `viewsIndex`, `isOrderable`, `isFilterable`, `createView`, `itemView`, `listView`.
- groups: group label/description and field paths.
- GraphQL names: Keystone-compatible names such as `createTodo`, `todos`, `todosCount`, `TodoWhereInput`, etc.

### GraphQL Yoga endpoint via TanStack Start

Add a Start server route at `src/routes/api/graphql.ts` (or equivalent route convention used by the project) with:

```ts
export const Route = createFileRoute('/api/graphql')({
  server: {
    handlers: {
      GET: async ({ request }) => yoga.fetch(request),
      POST: async ({ request }) => yoga.fetch(request),
    },
  },
})
```

Future Yoga schema responsibilities:

- `keystone.adminMeta` equivalent query backed by the local registry.
- CRUD queries and mutations for each list.
- Relationship traversal and count fields.
- Auth mutations (authenticate, end session, password reset, init first item).
- Multipart upload handling compatible with the target deployment platform.

### Prisma integration

Recreate the useful Keystone behavior without depending on Keystone:

1. Registry-to-Prisma model generation for supported field types.
2. Stable naming rules for relation fields and mapped columns that match or intentionally migrate from current Keystone output.
3. `prisma generate`, `prisma migrate dev`, and `prisma migrate deploy` scripts owned by this repo.
4. A singleton Prisma client utility for dev hot reload.
5. Optional compatibility mode that can ingest the current generated `schema.prisma` while the registry generator is being built.

### Auth/session/access

Target behavior should match the current starter's semantics:

- Stateless cookie/session support or a database-backed session option.
- Password hashing and password reset fields on User.
- First-item initialization with an Admin role.
- Operation-level access functions.
- Filter-level access functions that compile to Prisma `where` clauses.
- Dashboard access check equivalent to `session.data.role.canAccessDashboard`.

### Dashboard UI

Use TanStack Router and shadcn/base UI components:

- `/dashboard`: list cards from registry/adminMeta.
- `/dashboard/signin`: placeholder sign-in page, later wired to auth mutation.
- `/dashboard/$listKey`: list metadata/table placeholder, later wired to GraphQL CRUD.
- Later: `/dashboard/$listKey/create` and `/dashboard/$listKey/$id`.

Copy/adapt dashboard pieces from the Next starter only after removing framework assumptions:

- Replace `next/link` with `@tanstack/react-router` `Link`.
- Replace server actions with `createServerFn`, route loaders, or GraphQL client calls.
- Replace Next layouts with TanStack pathless/nested routes where useful.
- Keep shadcn/base UI primitives instead of introducing Radix-only duplicates unless required.

### Upload handling

Recreate the storage abstraction currently represented by Keystone's `storage.my_images`:

- Storage adapters: local filesystem for development, S3-compatible adapter for production.
- Image metadata fields: id/key, filesize, width, height, extension.
- Signed URL support where needed.
- GraphQL upload mutation(s) or multipart field support.
- Dashboard image field view adapted from the source starter.

### Migrations/codegen

Replace `keystone build --no-ui` with repo-owned scripts:

- `cms generate prisma`: registry to Prisma schema.
- `cms generate graphql`: registry to GraphQL schema/types if persisted SDL is desired.
- `cms migrate dev/deploy`: Prisma migration wrappers.
- `cms generate admin-meta`: optional static artifact for build-time validation.
- Type generation for list item shapes and field controller metadata.

## 5. Copy vs rewrite strategy and phased implementation plan

### Copy/adapt candidates

Good candidates to copy with edits:

- Dashboard visual patterns: list cards, page containers, side navigation, breadcrumbs, list table layout.
- Field view implementations under `features/dashboard/views`, especially pure client UI/controller logic.
- Utility logic such as `getGqlNames`, filter/sort builders, field enhancement helpers.
- Access-rule semantics from `features/keystone/access.ts`.
- Model concepts from `features/keystone/models/User.ts`, `Role.ts`, `Todo.ts`, and `TodoImage.ts`.

### Rewrite candidates

Should be rewritten for TanStack/native CMS:

- Next App Router route files in `app/dashboard`.
- Next server actions in `features/dashboard/actions`.
- `pages/api/graphql.ts` request/response handler.
- Keystone config/context/bootstrap code.
- Any imports from `.keystone/*` generated types.
- Any code that assumes React Server Components as the primary data-fetching model.

### Phase 0: Repository setup and design handoff

- Document current architecture and migration path. (This file.)
- Repair shadcn/base UI config so generated components target `src/styles.css`.
- Add theme CSS variables required by generated components.
- Add TanStack dashboard route skeletons.
- Add framework-neutral CMS registry/adminMeta stub with User/Role/Todo examples.

### Phase 1: Dashboard shell and adminMeta compatibility

- Build a lightweight dashboard shell using TanStack Router and shadcn/base UI.
- Render list cards and per-list field metadata from local `adminMeta`.
- Add `/dashboard/$listKey/create` and `/dashboard/$listKey/$id` placeholder routes.
- Add route loaders or server functions for fetching adminMeta.
- Port pure utilities (`getGqlNames`, field grouping/enhancement) as needed.

### Phase 2: GraphQL adminMeta endpoint

- Add `src/routes/api/graphql.ts` with GraphQL Yoga.
- Implement `keystone.adminMeta` query from the local registry.
- Add basic list count/list item queries against fixture data or Prisma.
- Point dashboard data hooks at the new endpoint.

### Phase 3: Prisma-backed CRUD

- Add Prisma and `@prisma/client` dependencies.
- Generate or hand-author an initial Prisma schema matching User/Role/Todo/TodoImage.
- Implement CRUD GraphQL resolvers with access checks.
- Add migrations and seed/init workflow.

### Phase 4: Auth/session/access

- Implement password hashing, sign-in/sign-out, session cookie, authenticated item query.
- Implement first-item initialization flow.
- Enforce operation/filter access in GraphQL resolvers and dashboard navigation.
- Port password reset behavior.

### Phase 5: Field views and relationship UX

- Port field views incrementally by field type.
- Start with text, checkbox, select, multiselect, timestamp, numeric, JSON.
- Then relationship inline connect/create/edit.
- Then document editor and image upload fields.

### Phase 6: Code generation and Keystone dependency removal

- Add registry-to-Prisma generator.
- Add registry-to-GraphQL/type generation.
- Replace any temporary compatibility shims.
- Ensure no `@keystone-6/*`, `.keystone/*`, or `next/*` imports remain.

## 6. Known risks/open questions

1. **Exact Keystone compatibility level.** Do we need wire-compatible GraphQL/adminMeta for existing dashboard code, or only a similar user experience? The current plan starts with Keystone-like metadata to maximize reuse.
2. **Data migration.** Existing databases use Keystone-generated Prisma naming. We need to decide whether to preserve table/column names exactly or provide a migration path.
3. **Document field implementation.** Keystone's document field has complex editor/controller behavior. It should be ported after core CRUD and simpler fields.
4. **Relationship semantics.** Keystone supports nested create/connect/disconnect and many relation UI modes. The replacement should implement the subset needed by target apps first.
5. **Access-rule compilation.** Filter access must become safe Prisma `where` clauses and be consistently applied to reads, writes, counts, relationships, and nested mutations.
6. **Uploads in TanStack Start deployments.** Multipart parsing and S3 streaming behavior need validation for the selected runtime/adapter.
7. **TanStack Start API stability.** Start is still evolving; server route conventions and Nitro integration should be verified as dependencies change.
8. **shadcn/base UI registry drift.** Generated base UI components depend on CSS tokens; config and theme variables must remain aligned.
9. **Auth/session storage.** Stateless sessions match current Keystone behavior, but database sessions may be easier to revoke/audit.
10. **Codegen ownership.** Recreating Keystone's generator is the biggest scope item; it should be built incrementally around real app needs.

## 7. Validation checklist

Current/near-term validation:

- [ ] `components.json` points shadcn to `src/styles.css`.
- [ ] `src/styles.css` includes Tailwind 4 theme token mappings and light/dark CSS variables used by generated components.
- [ ] `npm run build` succeeds.
- [ ] `/dashboard` renders list cards from local CMS metadata.
- [ ] `/dashboard/signin` renders a placeholder sign-in screen without Next imports.
- [ ] `/dashboard/$listKey` renders list metadata for `Todo`, `User`, and `Role` paths.
- [ ] The repo contains no new `@keystone-6/*` imports.
- [ ] The repo contains no new `next/*` imports.

Future validation:

- [ ] GraphQL Yoga endpoint responds to `keystone.adminMeta` query.
- [ ] Generated adminMeta matches the fields consumed by dashboard screens/views.
- [ ] Prisma schema/migrations can be generated without Keystone.
- [ ] CRUD operations enforce operation and filter access.
- [ ] Auth/session flows work for sign in, sign out, first item init, and password reset.
- [ ] Uploads work locally and with S3-compatible storage.
- [ ] Existing Keystone starter data can be migrated or intentionally reset.
