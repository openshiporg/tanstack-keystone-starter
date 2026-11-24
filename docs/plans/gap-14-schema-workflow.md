# GAP-14 implementation plan

## Goal

Make the isolated schema-change loop executable and safe: edit a CMS model, generate Keystone-compatible artifacts, create/inspect/apply a Prisma migration, refresh Prisma Client, exercise the dashboard GraphQL CRUD contract in a fresh process, build the app, and prove a guarded removal/revert with representative data.

## Constraints

- The state machine runs only in a temporary copy under `.cms-temp/` and removes it in `finally`.
- It does not use Git, Portless, a persistent server/database, `/central`, sibling source edits, or product dashboard view files.
- Keystone source/config behavior is used as the compatibility reference; Prisma remains responsible for migration SQL/data-loss analysis.

## Ordered slices

1. **Migration safety primitive**
   - Add SQL-risk classification and an explicit `--allow-destructive` guard.
   - Add focused unit tests for additive, rename/customized, and destructive SQL.
2. **Script pipeline fixes**
   - Route `migrate:gen`, `migrate`, `db:generate`, and `db:push` through generated-artifact freshness and client generation.
   - Preserve Prisma's `--create-only` customization workflow before applying migrations.
3. **Generated-state invalidation**
   - Add deterministic artifact version/hash metadata and ensure stale generated artifacts are detected before migration/build.
   - Preserve `customViewsIndex` and serializable custom-view metadata in generated AdminMeta.
   - Expose a runtime schema-cache reset for tests/fresh reload boundaries without touching dashboard view modules.
4. **Executable temporary-copy state machine**
   - Baseline SQLite fixture and populated data.
   - Add model/field/custom-view metadata; rename with a Prisma `@map` data-preserving transition; change type; add relation; remove with guard and acknowledged application; restore/revert.
   - Run generation, `cms:check`, migration creation/inspection/application, client refresh, fresh-process GraphQL CRUD, and a fresh build.
   - Emit `reports/gap-14-schema-workflow.md` with commands, states, migration SQL risk, data checks, build/process evidence, and cleanup.

## Acceptance criteria

- `npm run test:cms:workflow` passes from the repository root without external services and leaves no temp fixture behind.
- The workflow proves existing rows survive add, mapped rename, type change, and relation changes.
- A removal migration is not applied without `--allow-destructive`; the acknowledged run is preceded by a temporary backup and the backup is verified.
- `cms:check` fails before regeneration after every model edit and passes after generation.
- A fresh generated Prisma Client exposes the changed model/fields and a fresh process performs create/read/update/delete GraphQL operations.
- `npm run build` passes in the temporary copy after the final schema state.
- Existing CMS dynamic/Prisma tests remain green.

## Official guidance used

- Prisma development migrations use a shadow database, generate migrations, evaluate data loss, and support `--create-only` for customization: <https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production>
- Prisma shadow databases are temporary and used to detect drift/data loss during `migrate dev`: <https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/shadow-database>
- Prisma 7 requires rerunning `prisma generate` after schema/model changes: <https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/generating-prisma-client>
- TanStack Router's `router.invalidate({ sync: true })` is the documented active-route refresh boundary; this change records the boundary but does not modify owned dashboard view files: <https://tanstack.com/router/latest/docs/api/router/RouterType>
