# TanStack Keystone Starter readiness

**Status date:** 2026-08-13  
**Pinned behavior oracle:** `@keystone-6/core@6.5.1`, `@keystone-6/auth@8.1.0`, `@keystone-6/fields-document@9.1.1`, `@keystone-6/document-renderer@1.1.2`.

## Verdict

All applicable gaps identified by the independent `REAUDIT.md` have been implemented or reconciled with executable evidence. The CMS remains a TanStack Start/Vite/Nitro/Yoga/Prisma 7 implementation with zero install/build/runtime dependency on Keystone or Next.js.

This is behavioral compatibility with the pinned versions, not a claim that TanStack implements non-applicable Keystone CLI, Express, Next.js Admin UI, webpack, or package-internal APIs. Such configuration remains explicitly rejected rather than silently ignored.

The current external Firefox binary exits before opening WebDriver BiDi. Production builds and servers start, but current browser assertions cannot run. Prior browser evidence exists; this current environment failure is not represented as a pass.

## Reconciled re-audit requirements

### Core GraphQL API

`src/features/cms/keystone/core.ts` now exposes the Core 6.5.1 construction surface using the same GraphQL-TS releases as the oracle:

- scalar descriptors and exact JSON, Upload, Decimal, BigInt, DateTime, CalendarDay and Empty scalar behavior;
- `arg`, `enum`, `enumValues`, `inputObject`, `list`, `nonNull`, `scalar`;
- context-bound `field`, `fields`, `object`, `interface`, `interfaceField`, `union`;
- `extend`, `wrap`, `bindGraphQLSchemaAPIToContext` and base-schema type lookup;
- resolver, argument and output semantics, including safe rebinding when a base schema already owns a named scalar.

Evidence: `npm run test:cms:graphql-builder`.

### Auth 8.1

- password-reset send, validate and redeem operations/types are conditional on configuration;
- magic-link request/redeem operations, injected hidden token fields, result union, success/failure types and error codes are implemented;
- token creation, expiry bounds/default, replay handling, callback context and session-start behavior follow Auth 8.1;
- malformed `sessionData` fails at schema startup;
- arbitrary auth list/identity/secret naming remains supported;
- `skipKeystoneWelcome` is retained as config metadata; the generated Next welcome screen itself is non-applicable.

Evidence: `npm run test:cms:auth:8.1`, `test:cms:auth`, and `test:cms:auth:continuity`.

### Documents, structure, and renderer

- fields-document 9.1.1 `structure` is exported with exact schema/input/output naming, recursive defaults, form/object/array/conditional/relationship behavior, partial updates, raw/hydrated JSON, and SQLite JSON-string polyfill behavior;
- document links use the pinned sanitize-url predicate, accepting safe relative URLs such as `/relative` while rejecting unsafe protocols;
- advanced feature normalization is retained;
- component form/object/array/conditional/child/relationship props are normalized and validated server-side;
- component and inline relationships store trusted IDs and hydrate labels/selections through configured lists;
- `DocumentRenderer`, `defaultRenderers`, and `DocumentRendererProps` compatibility exports cover marks, links, relationships, paragraphs, headings, blockquotes, code, dividers, lists, layouts, component blocks and child prop paths;
- renderer snapshots and normalization/hydration tests are checked in.

Evidence: document validators within `test:cms` and `tests/cms-document-renderer.test.tsx`.

### Prisma providers

Ordinary Prisma client creation dispatches accepted configs to Prisma 7's PostgreSQL, better-sqlite3, or MariaDB adapter. Generated live SQLite and disposable live MariaDB clients pass CRUD; SQLite additionally passes CMS relationship and structure behavior.

### Runtime matrices

The exact disposable Keystone oracle matrix now covers:

- one/list/count denial and nested target-list item/count access;
- scalar, logical and relationship filters;
- ordering, take/skip, cursor-zero/positive skip and inaccessible cursors;
- `context.query` and `context.db` reads;
- access callback throws and invalid return values;
- every mutation hook phase, error paths and ordering;
- many-mutation ordered data/errors and persisted state.

The local memory runtime intentionally rolls back an item when its `afterOperation` hook fails, while Keystone 6.5.1 leaves the item persisted. This stronger local atomicity is asserted as an intentional security/data-integrity deviation rather than disguised as equality.

Additional matrices cover Context raw/run/sudo/internal/withSession/withRequest/transaction/prisma state, access on memory/PostgreSQL, relationship cardinalities/nested writes, provider schema generation, storage lifecycle, dynamic AdminMeta, auth continuity and migrations.

## Intentional stronger/different contracts

| Area                    | Contract                                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cookie cutover          | Local cookies do not import or accept Keystone Iron cookies. Existing Keystone users reauthenticate; local sessions remain continuous with the same strong secret.                |
| Production adapter      | Production fails closed without explicit persistence configuration.                                                                                                               |
| Auth abuse controls     | Built-in login/reset limits remain; multiple replicas require a shared/upstream limiter.                                                                                          |
| Failed `afterOperation` | Local top-level item transactions roll back the item; Keystone 6.5.1 persists it before the failing hook.                                                                         |
| Memory transactions     | Snapshot rollback and a process-wide queue are deterministic but not a claim of database isolation equivalence. Production parity uses Prisma.                                    |
| Prisma lifecycle        | Prisma 7 schema/client/migration mechanics replace Keystone's Prisma 5 CLI lifecycle while preserving applicable model/data behavior.                                             |
| Framework hooks         | Express/HTTP-server hooks, Apollo objects, arbitrary generated paths, query-limit objects, Next Admin additional files/middleware/public pages and custom health paths fail fast. |
| Admin UI                | AdminMeta and CMS workflows are implemented in the TanStack dashboard. Next page generation and Keystone Admin UI package/plugin internals are non-applicable.                    |

## Current verification

Passed in the current tree:

```text
npm test                                      # 55 files, 254 tests
npm run test:cms
npm run test:cms:dynamic
npm run test:cms:graphql-builder
npm run test:cms:structure
npm run test:cms:document:links
npm run test:cms:providers                    # live SQLite + disposable MariaDB
npm run test:cms:differential                 # 11 exact-oracle groups
npm run test:cms:access:parity                # memory + disposable PostgreSQL
npm run test:cms:hooks:parity
npm run test:cms:context:semantics
npm run test:cms:auth:8.1
npm run test:cms:auth:continuity
npm run test:cms:calendar-day
npm run test:cms:storage
npx tsx scripts/validate-gap10-provider-continuity.ts
npx tsx scripts/validate-cms-admin-meta.ts
npx tsx scripts/validate-cms-actions.ts
npx vitest run tests/cms-prisma-provider-matrix.test.ts \
  tests/gap08-relationship-matrix.test.ts \
  tests/cms-prisma-one-to-one.test.ts \
  tests/cms-migration-safety.test.ts       # 16 tests
npm run test:providers:local
npm run test:production:baseline
npm run build
npm run cms:check
npm run test:dependencies
npx tsc --noEmit
npx eslint .
npm run check
npm audit --omit=dev                       # 0 vulnerabilities
npm audit                                  # 0 vulnerabilities
```

`npm run test:cms:relationships:matrix` completed its disposable PostgreSQL schema/runtime work after explicit authorization but reached the same external Firefox BiDi failure during its generated browser route phase. No browser assertion ran.

## Dependency and output boundary

- no `@keystone-6/*` or `next` package is declared, locked, installed or resolvable;
- the exact oracle packages are installed only in a newly created disposable temporary project by the differential driver;
- GraphQL-TS, Decimal and graphql-upload are independent libraries used to reproduce the public Core construction/scalar contract, not Keystone dependencies;
- output/runtime scans remain mandatory and pass.

## Production acceptance boundary

Before cutover, operators must still:

1. apply migrations and use Prisma explicitly;
2. configure a strong shared `SESSION_SECRET` and communicate forced reauthentication from Keystone cookies;
3. provide a shared auth limiter for multiple replicas;
4. run S3/SMTP acceptance with real deployment credentials and representative existing objects;
5. repair/update Firefox or provide a working BiDi-capable browser and rerun the browser matrix;
6. keep exact differential, PostgreSQL access, dependency/output, build and security gates required in CI.
