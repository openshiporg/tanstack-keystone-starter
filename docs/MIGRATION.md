# Migrating from next-keystone-starter

This repository preserves the `next-keystone-starter` PostgreSQL and GraphQL contracts while replacing the Next.js integration and Keystone runtime with TanStack Start, local TypeScript, Prisma 7, and GraphQL Yoga.

`READINESS.md` is the authoritative cutover verdict. Passing the database procedure below does **not** by itself authorize removing Keystone packages; rich-document UI, provider continuity, and the remaining gates still apply.

## Migration history

`prisma/migrations` contains the seven migrations copied unchanged from the audited sibling:

1. `20250529211349_initial_migration`
2. `20250618162316_add_description_field_to_todo`
3. `20250621232051_add_all_fields`
4. `20250704004833_add_image_field`
5. `20250704011715_make_todoimage_a_separate_model`
6. `20250806014640_update_user_to_include_reset_token_field`
7. `20250815215522_add_multi_select_field_to_todo_model`

The local `20260718000000_prisma7_join_table_primary_key` migration is the only adaptation. Prisma 5 represented `_Todo_todoImages.(A,B)` with a unique index; Prisma 7 expects the same columns to be the composite primary key. The migration drops only that redundant unique index and adds the primary-key constraint. It does not rewrite or delete relationship rows.

## Executable cutover rehearsal

Docker must be available. Run:

```bash
npm run test:source-cutover
```

The bounded test creates a disposable PostgreSQL 16 container and always removes it. It:

1. deploys only the seven original source migrations;
2. inserts representative users, roles, todos, documents, JSON, decimals, bigint values, images, and many-to-many rows;
3. takes a source-state `pg_dump` backup;
4. deploys the Prisma 7 adaptation through `npm run migrate`;
5. verifies migration status and zero database/schema drift;
6. reads and updates the source-created records through the replacement Prisma/GraphQL runtime;
7. restores the pre-cutover dump into a separate rollback database; and
8. verifies the original data, relationship row, and Prisma 5 unique-index shape.

No external database or sibling file is modified.

## Production cutover procedure

Do not use `prisma db push` for this migration.

1. Stop writes to the source application or place it in maintenance mode.
2. Record the current deployment version and environment configuration.
3. Create and verify a full PostgreSQL backup:

   ```bash
   pg_dump --format=custom --no-owner --file=pre-tanstack-cutover.dump "$DATABASE_URL"
   pg_restore --list pre-tanstack-cutover.dump >/dev/null
   ```

4. Confirm the database migration history contains the seven source migration names.
5. Run the repository checks against a restored staging copy first:

   ```bash
   npm ci
   npm run cms:check
   npm run audit:next-source
   npm run test:source-cutover
   ```

6. Apply the one pending adaptation:

   ```bash
   npm run migrate
   npx prisma migrate status
   npx prisma migrate diff \
     --from-config-datasource \
     --to-schema prisma/schema.prisma \
     --exit-code
   ```

7. Run application-level smoke tests against representative records before reopening writes.
8. Keep the source deployment and backup available until the observation window is complete.

## Rollback

Prisma Migrate does not provide automatic down migrations. The supported rollback is restore-based:

1. stop writes immediately;
2. redeploy the recorded source application version;
3. restore `pre-tanstack-cutover.dump` into a new database or replace the failed cutover database according to the platform runbook;
4. point the source deployment at the restored database;
5. verify users, todos, `_Todo_todoImages`, uploads, and authentication before reopening traffic.

Do not attempt to drop the composite primary key in place after application writes have resumed. A backup restore is the only tested way to reverse both schema and data changes together.

## Remaining release gates

Before removing `@keystone-6/*` or Next.js packages from a real consumer, complete every applicable item in `READINESS.md`, including rich-document behavior, live S3/SMTP continuity, representative production data, provider rollback, security, and browser acceptance.
