# TanStack Keystone Starter

A TanStack Start starter with a local TypeScript/GraphQL Yoga/Prisma implementation of useful Keystone-compatible concepts. It does not depend on Next.js or the Keystone runtime.

This is substantial but not yet a production replacement release for every Keystone consumer. Read the evidence-backed [`READINESS.md`](./READINESS.md) before removing packages from an existing app.

## Implemented

- Keystone-style `config`, `list`, `group`, fields, models, access, and hooks
- Generated GraphQL schema, Prisma schema, admin metadata, manifest, and TypeScript artifacts
- Memory adapter and Prisma 7 PostgreSQL driver-adapter persistence
- Single/many CRUD, filters, order, relationships, nested writes, and context APIs
- Auth/session/init/reset flows and password hashing
- Local/S3-oriented storage, image/file uploads, virtual fields, and document runtime
- Slate-based rich document editing with structured JSON, formatting, lists, links, dividers, alignment, and undo/redo
- TanStack Start dashboard routes and field controllers
- Public/internal GraphQL schemas and a GraphQL Yoga route at `/api/graphql`

## Requirements

- Node.js 22 (the current assessment used 22.22.3)
- npm 10+
- PostgreSQL for persistent Prisma mode

## Install and verify

```bash
npm ci
npm run cms:check
npm run audit:next-models
npm run test:openfront-consumers
npm run test:providers:local
npm run db:generate
npm test
npm run test:cms
npm run test:cms:dynamic
npm run test:dashboard:http
npm run test:dashboard:browser # requires Firefox; starts/stops bounded processes
npm run test:source-cutover    # requires Docker; source history + rollback
npm run test:dependencies
npm run lint
npm run check
npx tsc --noEmit
npm run build
npm audit
```

The production build is emitted under `.output/` by Nitro. `npm run dev` also has a bounded startup regression proof; its generated view-order import is statically resolvable by Vite.

## Direct source migration audit

When `../next-keystone-starter` is available, run:

```bash
npm run audit:next-source
```

This read-only audit compares the actual sibling GraphQL and Prisma schemas rather than relying on historical reports. Its schema `removalGate` passes: the Prisma schema diff is empty and GraphQL has no missing source types, root/input differences, breaking changes, or dangerous changes. `npm run test:openfront-consumers` also bundles the unchanged model registries and GraphQL extensions from `../opensource.builders` and `../os.org` through the local compatibility layer; all 15 lists and 157 fields produce zero Prisma SQL and zero GraphQL breaking or dangerous changes. `npm run test:source-cutover` separately proves the adopted source migration history, the Prisma 7 join-table adaptation, representative data, and dump/restore rollback. This is not the overall package-removal verdict; advanced rich-document parity, live providers, and production-sized cutover evidence remain open in `READINESS.md`.

## Generated artifacts

`cms.config.ts` is the model/config source of truth. Generate artifacts with:

```bash
npm run cms:generate
```

The generator writes `.cms/*` and the canonical `prisma/schema.prisma`. Check drift with:

```bash
npm run cms:check
```

Do not hand-edit generated schema files.

## Runtime modes

Memory mode is safe for bounded local tests:

```bash
CMS_ADAPTER=memory npm run test:cms
```

Persistent Prisma mode requires a PostgreSQL `DATABASE_URL`:

```bash
npm run db:generate
npm run migrate
npm run db:seed
CMS_ADAPTER=prisma npm run test:cms:prisma
CMS_ADAPTER=prisma npm run test:cms:prisma:auth
```

Use `npm run migrate:gen` during development to generate and apply a reviewed migration. Use `npm run migrate` (`prisma migrate deploy`) in deployment automation. The repository includes an initial migration under `prisma/migrations/`.

## Development

Copy `.env.example` to `.env`, set a strong `SESSION_SECRET`, and configure `DATABASE_URL` if using Prisma. Configure the source-compatible S3 and SMTP variables before using uploads or password-reset delivery. Production session creation/verification fails closed without `SESSION_SECRET`; the development auth fallback is disabled by default and cannot activate in production.

```bash
npm run dev
```

## Architecture

```text
cms.config.ts / model files
  -> initialize lists and fields
  -> generate .cms artifacts + prisma/schema.prisma
  -> public/internal GraphQL schemas and adminMeta
  -> access/hooks/context runtime
  -> memory or Prisma adapter
  -> GraphQL Yoga in TanStack Start
  -> dashboard
```

Key source:

- `src/features/cms/`
- `src/components/dashboard/`
- `src/routes/`
- `scripts/`
- `tests/`

## Documentation

- [`READINESS.md`](./READINESS.md) — authoritative capability/removal matrix
- [`docs/report-consolidation-plan.md`](./docs/report-consolidation-plan.md) — historical report policy
- [`docs/graphql-contract.md`](./docs/graphql-contract.md) — GraphQL contract notes (some sections remain historical)
- [`docs/MIGRATION.md`](./docs/MIGRATION.md) — migration background (some sections remain historical)
- [`docs/decisions/ADR-001-keystone-parity-tanstack-runtime.md`](./docs/decisions/ADR-001-keystone-parity-tanstack-runtime.md) — architecture decision

## Official references

- TanStack Start: https://tanstack.com/start/latest/docs/framework/react/overview
- Prisma: https://www.prisma.io/docs/orm
- GraphQL Yoga: https://the-guild.dev/graphql/yoga-server
- Keystone source oracle: https://github.com/keystonejs/keystone
