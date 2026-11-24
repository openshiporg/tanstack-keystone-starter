# Provider / relationship reconciliation worker

## Scope and oracle

Reviewed `REAUDIT.md` A10, A11, A12 and A15 directly, and the unpacked `@keystone-6/core@6.5.1` TypeScript under `/private/tmp/tanstack-keystone-parity-packages/keystone-6-core-6.5.1/package/src`. No Keystone package was added. The local multiselect field is an explicitly documented extension and is excluded from Core parity claims.

Protected areas were not edited: auth, documents, `keystone/core.ts`, Context core, storage and AdminMeta.

## Reconciled behavior

### Fields, filters, ordering and pagination (A10/A11)

Core's built-ins reviewed: text, password, checkbox, select (string/integer/enum), timestamp, calendarDay, integer, float, decimal, bigInt, JSON, relationship, file, image and virtual. Core's shipped source also contains multiselect, but the audit classifies the local implementation as a non-Core extension, so it is not used as parity evidence.

The local generated/runtime filter surface has dedicated nullable/non-null filters and coercion paths for strings, booleans, integers, floats, Decimal, BigInt, DateTime, CalendarDay and password `isSet`; relationships expose one-side `is/isNot` and many-side `some/none/every`. JSON/document/file/image/virtual remain intentionally non-filterable/non-orderable where configured. Existing executable coverage is in the CMS validators and differential suite; cursor behavior includes missing/inaccessible cursor, access-filter application, ordering before cursor/skip/take, missing cursor returning no rows, and non-negative `take` validation. Memory ordering is still an approximation; production claims remain Prisma-backed.

### Relationship and nested mutation matrix (A12)

The existing metadata-derived GAP-08 executable matrix is the authoritative matrix rather than a duplicate hand-written fixture. It derives every relationship from generated AdminMeta and Prisma schema and covers:

- one-to-one, one-to-many, many-to-one and many-to-many;
- self relationships and one-sided relationships;
- ownership, foreign keys, mapped names, implicit join tables and referential actions;
- connect, create, disconnect, set and delete behavior;
- required relationship rejection, inverse replacement and deletion effects;
- transaction rollback for nested sibling failures, access/hook/storage failures, and concurrency;
- GraphQL errors plus direct PostgreSQL state/no-orphan checks.

Run with `npm run test:cms:relationships:matrix` when the disposable PostgreSQL container is available. Focused non-heavy contracts are `tests/gap08-relationship-matrix.test.ts` and `tests/cms-prisma-one-to-one.test.ts`.

### Prisma providers and lifecycle (A15)

Fixed a generator defect: MySQL Decimal fields now emit the same configured native precision/scale declaration as PostgreSQL (`@db.Decimal(p, s)`). SQLite correctly omits native types, represents CalendarDay and enum-select as strings, and PostgreSQL/MySQL use native Date and enum representations. The new executable provider schema matrix covers provider declaration, enum fallback, native date/decimal, indexes and mapped columns.

Prisma 7 is a platform replacement, not source-compatible Keystone 6.5.1/Prisma 5 lifecycle parity. PostgreSQL is the production runtime proven by disposable migrate/deploy/build/CRUD/rollback gates. SQLite schema generation/validation is available and its driver adapter dependency is present, but the checked-in `createCmsPrismaClient` remains PostgreSQL-wired. MySQL schema generation is tested; a Prisma 7 MySQL/MariaDB driver adapter and disposable server are not installed, so MySQL runtime/migration execution is **not claimed**. Custom migration prompt text, generated client location and CLI output are likewise not claimed equal to Keystone.

Lifecycle evidence remains `scripts/cms-migrate.ts`, `scripts/validate-cms-schema-workflow.mjs`, migration safety tests, disposable PostgreSQL GAP-08 and workflow harnesses, plus generated-schema/client checks. These establish the replacement's lifecycle, not byte-for-byte or CLI-for-CLI oracle identity.

## Verification

- `npx vitest run tests/cms-prisma-provider-matrix.test.ts tests/gap08-relationship-matrix.test.ts tests/cms-prisma-one-to-one.test.ts tests/cms-migration-safety.test.ts`
- `npx eslint src/features/cms/prisma-schema.ts tests/cms-prisma-provider-matrix.test.ts`
- `npx tsc --noEmit`

External boundary: no MySQL server/Prisma 7 MySQL adapter was available. A fresh PostgreSQL heavy-matrix attempt reached its unique disposable database and then Prisma 7 refused the destructive schema reset because the CLI requires a new, exact user-consent message in `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`; the harness cleaned that attempt. I did not bypass the consent gate or interfere with another concurrently running shared-repo GAP-08 process. PostgreSQL heavy execution remains available through the existing residue-safe lifecycle command once explicitly authorized.
