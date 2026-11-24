# GAP-14 schema workflow evidence

Status: PASS
Run ID: gap14-VTeAps-87320
Run hash: 820ea79296a7921561922652ed54c516a37ccbc2984d3dbc8b4257cd776dc86d
Source hash: 6fa247cd9677a5b89144bbfed7401135373510280faf47f3995ea36c4c0b6e16
Source generated-artifact/schema fingerprint: fe0c4ead0551e95eb7f43b2bd5b72b4740804d247588f636edd917fc92e71ea6
Source writable-cache fingerprint: 9c818d35693a6f25aec0ab2970834f41ba00db15fdde99d2c9bd0e67a7c98615
Date: 2026-08-18T11:55:10.050Z

The bounded state machine ran in a temporary repository copy against unique disposable PostgreSQL. Cleanup completed before this PASS report was written.

## States

baseline -> add model/field -> rename (customized Prisma SQL) -> type change -> relation -> remove (guarded, acknowledged after backup) -> revert

## Evidence

### $ docker exec tks-gap14-87320-1787054063560 pg_isready -U cms -d cms [exit 2]

```text
$ docker exec tks-gap14-87320-1787054063560 pg_isready -U cms -d cms [exit 2]
/var/run/postgresql:5432 - no response
```

### $ docker exec tks-gap14-87320-1787054063560 pg_isready -U cms -d cms [exit 2]

```text
$ docker exec tks-gap14-87320-1787054063560 pg_isready -U cms -d cms [exit 2]
/var/run/postgresql:5432 - no response
```

### $ docker exec tks-gap14-87320-1787054063560 pg_isready -U cms -d cms [exit 2]

```text
$ docker exec tks-gap14-87320-1787054063560 pg_isready -U cms -d cms [exit 2]
/var/run/postgresql:5432 - no response
```

### $ npm run cms:check [exit 1]

```text
$ npm run cms:check [exit 1]
> cms:check
> tsx scripts/cms-generate.ts --check && tsx scripts/compare-cms-prisma-schema.ts && tsx scripts/check-cms-prisma-delegates.ts

[cms][memory] bootstrap mode=seeded(default)
/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-generate.ts:317
      throw new Error(
            ^

Error: CMS generated artifacts are out of date. Run npm run cms:generate. Drifted files: .cms/manifest.json, .cms/admin-meta.json, .cms/schema.graphql, .cms/view-order.json, .cms/view-order.ts, .cms/view-modules.ts, .cms/types.ts, .cms/schema.prisma, prisma/schema.prisma, .cms/artifact-hash.json
    at main (/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-generate.ts:317:13)
    at async <anonymous> (/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-generate.ts:332:1)

Node.js v22.22.3
```

### $ npx --no-install tsx scripts/cms-generate.ts

```text
$ npx --no-install tsx scripts/cms-generate.ts
[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.
```

### $ npx --no-install tsx scripts/cms-generate.ts --check

```text
$ npx --no-install tsx scripts/cms-generate.ts --check
[cms][memory] bootstrap mode=seeded(default)
CMS generated artifacts are up to date.
```

### $ npm run migrate:gen -- --name gap14_baseline

```text
$ npm run migrate:gen -- --name gap14_baseline
> migrate:gen
> tsx scripts/cms-migrate.ts --name gap14_baseline


> cms:generate
> tsx scripts/cms-generate.ts

[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.
Datasource "db": PostgreSQL database "cms", schema "public" at "127.0.0.1:32796"

Prisma Migrate created the following migration without applying it 20260818115427_gap14_baseline

You can now edit it and apply it by running prisma migrate dev.
Migration 20260818115427_gap14_baseline: non-destructive
Datasource "db": PostgreSQL database "cms", schema "public" at "127.0.0.1:32796"

1 migration found in prisma/migrations

Applying migration `20260818115427_gap14_baseline`

The following migration(s) have been applied:

migrations/
  └─ 20260818115427_gap14_baseline/
    └─ migration.sql

All migrations have been successfully applied.

> db:generate
> npm run cms:generate && DATABASE_URL=${DATABASE_URL:-postgresql://cms_generate:cms_generate@127.0.0.1:1/cms_generate} prisma generate


> cms:generate
> tsx scripts/cms-generate.ts

[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.

✔ Generated Prisma Client (7.9.1) to ./src/generated/prisma in 11ms

Applied and refreshed Prisma Client for gap14_baseline.
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
```

### $ npx --no-install tsx scripts/validate-cms-workflow-runtime.ts

```text
$ npx --no-install tsx scripts/validate-cms-workflow-runtime.ts
[cms][memory] bootstrap mode=seeded(default)
{"projectId":"cmsylup2v0000xyuzpsfkbjdb"}
```

### baseline project id: cmsylup2v0000xyuzpsfkbjdb

```text
baseline project id: cmsylup2v0000xyuzpsfkbjdb
```

### $ npm run cms:check [exit 1]

```text
$ npm run cms:check [exit 1]
> cms:check
> tsx scripts/cms-generate.ts --check && tsx scripts/compare-cms-prisma-schema.ts && tsx scripts/check-cms-prisma-delegates.ts

[cms][memory] bootstrap mode=seeded(default)
/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-generate.ts:317
      throw new Error(
            ^

Error: CMS generated artifacts are out of date. Run npm run cms:generate. Drifted files: .cms/manifest.json, .cms/admin-meta.json, .cms/schema.graphql, .cms/types.ts, .cms/schema.prisma, prisma/schema.prisma, .cms/artifact-hash.json
    at main (/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-generate.ts:317:13)
    at async <anonymous> (/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-generate.ts:332:1)

Node.js v22.22.3
```

### $ npx --no-install tsx scripts/cms-generate.ts

```text
$ npx --no-install tsx scripts/cms-generate.ts
[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.
```

### $ npx --no-install tsx scripts/cms-generate.ts --check

```text
$ npx --no-install tsx scripts/cms-generate.ts --check
[cms][memory] bootstrap mode=seeded(default)
CMS generated artifacts are up to date.
```

### $ npm run migrate:gen -- --name gap14_add

```text
$ npm run migrate:gen -- --name gap14_add
> migrate:gen
> tsx scripts/cms-migrate.ts --name gap14_add


> cms:generate
> tsx scripts/cms-generate.ts

[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.
Datasource "db": PostgreSQL database "cms", schema "public" at "127.0.0.1:32796"

Prisma Migrate created the following migration without applying it 20260818115432_gap14_add

You can now edit it and apply it by running prisma migrate dev.
Migration 20260818115432_gap14_add: non-destructive
Datasource "db": PostgreSQL database "cms", schema "public" at "127.0.0.1:32796"

2 migrations found in prisma/migrations

Applying migration `20260818115432_gap14_add`

The following migration(s) have been applied:

migrations/
  └─ 20260818115432_gap14_add/
    └─ migration.sql

All migrations have been successfully applied.

> db:generate
> npm run cms:generate && DATABASE_URL=${DATABASE_URL:-postgresql://cms_generate:cms_generate@127.0.0.1:1/cms_generate} prisma generate


> cms:generate
> tsx scripts/cms-generate.ts

[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.

✔ Generated Prisma Client (7.9.1) to ./src/generated/prisma in 18ms

Applied and refreshed Prisma Client for gap14_add.
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
```

### $ npm run cms:check

```text
$ npm run cms:check
> cms:check
> tsx scripts/cms-generate.ts --check && tsx scripts/compare-cms-prisma-schema.ts && tsx scripts/check-cms-prisma-delegates.ts

[cms][memory] bootstrap mode=seeded(default)
CMS generated artifacts are up to date.
Generated .cms/schema.prisma matches prisma/schema.prisma after whitespace/header normalization.
Prisma Client exposes delegates for all initialized CMS lists.
```

### $ npx --no-install tsx scripts/validate-cms-workflow-runtime.ts

```text
$ npx --no-install tsx scripts/validate-cms-workflow-runtime.ts
[cms][memory] bootstrap mode=seeded(default)
{"phase":"add","projectId":"cmsylup2v0000xyuzpsfkbjdb","fieldPaths":["id","name","legacyText","customLabel","priority"],"customViewMarker":"gap14-custom-view","rank":null,"ownerId":null}
```

### add: {"phase":"add","projectId":"cmsylup2v0000xyuzpsfkbjdb","fieldPaths":["id","name","legacyText","customLabel","priority"],"customViewMarker":"gap14-custom-view","rank":null,"ownerId":null}

```text
add: {"phase":"add","projectId":"cmsylup2v0000xyuzpsfkbjdb","fieldPaths":["id","name","legacyText","customLabel","priority"],"customViewMarker":"gap14-custom-view","rank":null,"ownerId":null}
```

### $ npm run cms:check [exit 1]

```text
$ npm run cms:check [exit 1]
> cms:check
> tsx scripts/cms-generate.ts --check && tsx scripts/compare-cms-prisma-schema.ts && tsx scripts/check-cms-prisma-delegates.ts

[cms][memory] bootstrap mode=seeded(default)
/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-generate.ts:317
      throw new Error(
            ^

Error: CMS generated artifacts are out of date. Run npm run cms:generate. Drifted files: .cms/manifest.json, .cms/admin-meta.json, .cms/schema.graphql, .cms/types.ts, .cms/schema.prisma, prisma/schema.prisma, .cms/artifact-hash.json
    at main (/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-generate.ts:317:13)
    at async <anonymous> (/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-generate.ts:332:1)

Node.js v22.22.3
```

### $ npx --no-install tsx scripts/cms-generate.ts

```text
$ npx --no-install tsx scripts/cms-generate.ts
[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.
```

### $ npx --no-install tsx scripts/cms-generate.ts --check

```text
$ npx --no-install tsx scripts/cms-generate.ts --check
[cms][memory] bootstrap mode=seeded(default)
CMS generated artifacts are up to date.
```

### $ npm run migrate:gen -- --name gap14_rename [exit 1]

```text
$ npm run migrate:gen -- --name gap14_rename [exit 1]
> migrate:gen
> tsx scripts/cms-migrate.ts --name gap14_rename


> cms:generate
> tsx scripts/cms-generate.ts

[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.
-- AlterTable
ALTER TABLE "Project" DROP COLUMN "priority",
ADD COLUMN     "rank" INTEGER DEFAULT 0;

Migration 20260818115437_gap14_rename: destructive (drop-column)
Loaded Prisma config from prisma.config.ts.

Prisma migrate dev is non-interactive here; created prisma/migrations/20260818115437_gap14_rename with prisma migrate diff for the same schema transition.
Error: Destructive Prisma migration "gap14_rename" requires explicit acknowledgement. Detected operations: drop-column. Customize/inspect the migration first, then rerun with --allow-destructive only after a verified backup.
    at assertMigrationIsSafe (/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/src/features/cms/migration-safety.ts:40:9)
    at main (/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-migrate.ts:135:3)
    at async <anonymous> (/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-migrate.ts:145:1)
```

### Customized Prisma rename migration to preserve populated data with ALTER TABLE ... RENAME COLUMN.

```text
Customized Prisma rename migration to preserve populated data with ALTER TABLE ... RENAME COLUMN.
```

### $ npm run migrate:gen -- --name gap14_rename --allow-destructive

```text
$ npm run migrate:gen -- --name gap14_rename --allow-destructive
> migrate:gen
> tsx scripts/cms-migrate.ts --name gap14_rename --allow-destructive


> cms:generate
> tsx scripts/cms-generate.ts

[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.
Migration 20260818115437_gap14_rename: non-destructive
Datasource "db": PostgreSQL database "cms", schema "public" at "127.0.0.1:32796"

3 migrations found in prisma/migrations

Applying migration `20260818115437_gap14_rename`

The following migration(s) have been applied:

migrations/
  └─ 20260818115437_gap14_rename/
    └─ migration.sql

All migrations have been successfully applied.

> db:generate
> npm run cms:generate && DATABASE_URL=${DATABASE_URL:-postgresql://cms_generate:cms_generate@127.0.0.1:1/cms_generate} prisma generate


> cms:generate
> tsx scripts/cms-generate.ts

[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.

✔ Generated Prisma Client (7.9.1) to ./src/generated/prisma in 17ms

Applied and refreshed Prisma Client for gap14_rename.
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
```

### $ npm run cms:check

```text
$ npm run cms:check
> cms:check
> tsx scripts/cms-generate.ts --check && tsx scripts/compare-cms-prisma-schema.ts && tsx scripts/check-cms-prisma-delegates.ts

[cms][memory] bootstrap mode=seeded(default)
CMS generated artifacts are up to date.
Generated .cms/schema.prisma matches prisma/schema.prisma after whitespace/header normalization.
Prisma Client exposes delegates for all initialized CMS lists.
```

### $ npx --no-install tsx scripts/validate-cms-workflow-runtime.ts

```text
$ npx --no-install tsx scripts/validate-cms-workflow-runtime.ts
[cms][memory] bootstrap mode=seeded(default)
{"phase":"rename","projectId":"cmsylup2v0000xyuzpsfkbjdb","fieldPaths":["id","name","legacyText","customLabel","rank"],"customViewMarker":"gap14-custom-view","rank":7,"ownerId":null}
```

### rename: {"phase":"rename","projectId":"cmsylup2v0000xyuzpsfkbjdb","fieldPaths":["id","name","legacyText","customLabel","rank"],"customViewMarker":"gap14-custom-view","rank":7,"ownerId":null}

```text
rename: {"phase":"rename","projectId":"cmsylup2v0000xyuzpsfkbjdb","fieldPaths":["id","name","legacyText","customLabel","rank"],"customViewMarker":"gap14-custom-view","rank":7,"ownerId":null}
```

### $ npm run cms:check [exit 1]

```text
$ npm run cms:check [exit 1]
> cms:check
> tsx scripts/cms-generate.ts --check && tsx scripts/compare-cms-prisma-schema.ts && tsx scripts/check-cms-prisma-delegates.ts

[cms][memory] bootstrap mode=seeded(default)
/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-generate.ts:317
      throw new Error(
            ^

Error: CMS generated artifacts are out of date. Run npm run cms:generate. Drifted files: .cms/manifest.json, .cms/admin-meta.json, .cms/schema.graphql, .cms/view-order.json, .cms/view-order.ts, .cms/view-modules.ts, .cms/schema.prisma, prisma/schema.prisma, .cms/artifact-hash.json
    at main (/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-generate.ts:317:13)
    at async <anonymous> (/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-generate.ts:332:1)

Node.js v22.22.3
```

### $ npx --no-install tsx scripts/cms-generate.ts

```text
$ npx --no-install tsx scripts/cms-generate.ts
[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.
```

### $ npx --no-install tsx scripts/cms-generate.ts --check

```text
$ npx --no-install tsx scripts/cms-generate.ts --check
[cms][memory] bootstrap mode=seeded(default)
CMS generated artifacts are up to date.
```

### $ npm run migrate:gen -- --name gap14_type

```text
$ npm run migrate:gen -- --name gap14_type
> migrate:gen
> tsx scripts/cms-migrate.ts --name gap14_type


> cms:generate
> tsx scripts/cms-generate.ts

[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.
Datasource "db": PostgreSQL database "cms", schema "public" at "127.0.0.1:32796"

Prisma Migrate created the following migration without applying it 20260818115443_gap14_type

You can now edit it and apply it by running prisma migrate dev.
Migration 20260818115443_gap14_type: non-destructive
Datasource "db": PostgreSQL database "cms", schema "public" at "127.0.0.1:32796"

4 migrations found in prisma/migrations

Applying migration `20260818115443_gap14_type`

The following migration(s) have been applied:

migrations/
  └─ 20260818115443_gap14_type/
    └─ migration.sql

All migrations have been successfully applied.

> db:generate
> npm run cms:generate && DATABASE_URL=${DATABASE_URL:-postgresql://cms_generate:cms_generate@127.0.0.1:1/cms_generate} prisma generate


> cms:generate
> tsx scripts/cms-generate.ts

[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.

✔ Generated Prisma Client (7.9.1) to ./src/generated/prisma in 16ms

Applied and refreshed Prisma Client for gap14_type.
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
```

### $ npm run cms:check

```text
$ npm run cms:check
> cms:check
> tsx scripts/cms-generate.ts --check && tsx scripts/compare-cms-prisma-schema.ts && tsx scripts/check-cms-prisma-delegates.ts

[cms][memory] bootstrap mode=seeded(default)
CMS generated artifacts are up to date.
Generated .cms/schema.prisma matches prisma/schema.prisma after whitespace/header normalization.
Prisma Client exposes delegates for all initialized CMS lists.
```

### $ npx --no-install tsx scripts/validate-cms-workflow-runtime.ts

```text
$ npx --no-install tsx scripts/validate-cms-workflow-runtime.ts
[cms][memory] bootstrap mode=seeded(default)
{"phase":"type","projectId":"cmsylup2v0000xyuzpsfkbjdb","fieldPaths":["id","name","legacyText","customLabel","rank"],"customViewMarker":"gap14-custom-view","rank":7,"ownerId":null}
```

### type: {"phase":"type","projectId":"cmsylup2v0000xyuzpsfkbjdb","fieldPaths":["id","name","legacyText","customLabel","rank"],"customViewMarker":"gap14-custom-view","rank":7,"ownerId":null}

```text
type: {"phase":"type","projectId":"cmsylup2v0000xyuzpsfkbjdb","fieldPaths":["id","name","legacyText","customLabel","rank"],"customViewMarker":"gap14-custom-view","rank":7,"ownerId":null}
```

### $ npm run cms:check [exit 1]

```text
$ npm run cms:check [exit 1]
> cms:check
> tsx scripts/cms-generate.ts --check && tsx scripts/compare-cms-prisma-schema.ts && tsx scripts/check-cms-prisma-delegates.ts

[cms][memory] bootstrap mode=seeded(default)
/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-generate.ts:317
      throw new Error(
            ^

Error: CMS generated artifacts are out of date. Run npm run cms:generate. Drifted files: .cms/manifest.json, .cms/admin-meta.json, .cms/schema.graphql, .cms/view-order.json, .cms/view-order.ts, .cms/view-modules.ts, .cms/types.ts, .cms/schema.prisma, prisma/schema.prisma, .cms/artifact-hash.json
    at main (/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-generate.ts:317:13)
    at async <anonymous> (/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-generate.ts:332:1)

Node.js v22.22.3
```

### $ npx --no-install tsx scripts/cms-generate.ts

```text
$ npx --no-install tsx scripts/cms-generate.ts
[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.
```

### $ npx --no-install tsx scripts/cms-generate.ts --check

```text
$ npx --no-install tsx scripts/cms-generate.ts --check
[cms][memory] bootstrap mode=seeded(default)
CMS generated artifacts are up to date.
```

### $ npm run migrate:gen -- --name gap14_relation

```text
$ npm run migrate:gen -- --name gap14_relation
> migrate:gen
> tsx scripts/cms-migrate.ts --name gap14_relation


> cms:generate
> tsx scripts/cms-generate.ts

[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.
-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "owner" TEXT,
ALTER COLUMN "rank" SET DEFAULT 0,
ALTER COLUMN "rank" SET DATA TYPE INTEGER;

-- CreateIndex
CREATE INDEX "Project_owner_idx" ON "Project"("owner");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_owner_fkey" FOREIGN KEY ("owner") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

Migration 20260818115448_gap14_relation: non-destructive
Datasource "db": PostgreSQL database "cms", schema "public" at "127.0.0.1:32796"

5 migrations found in prisma/migrations

Applying migration `20260818115448_gap14_relation`

The following migration(s) have been applied:

migrations/
  └─ 20260818115448_gap14_relation/
    └─ migration.sql

All migrations have been successfully applied.

> db:generate
> npm run cms:generate && DATABASE_URL=${DATABASE_URL:-postgresql://cms_generate:cms_generate@127.0.0.1:1/cms_generate} prisma generate


> cms:generate
> tsx scripts/cms-generate.ts

[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.

✔ Generated Prisma Client (7.9.1) to ./src/generated/prisma in 18ms

Applied and refreshed Prisma Client for gap14_relation.
Loaded Prisma config from prisma.config.ts.

Prisma migrate dev is non-interactive here; created prisma/migrations/20260818115448_gap14_relation with prisma migrate diff for the same schema transition.
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
```

### $ npm run cms:check

```text
$ npm run cms:check
> cms:check
> tsx scripts/cms-generate.ts --check && tsx scripts/compare-cms-prisma-schema.ts && tsx scripts/check-cms-prisma-delegates.ts

[cms][memory] bootstrap mode=seeded(default)
CMS generated artifacts are up to date.
Generated .cms/schema.prisma matches prisma/schema.prisma after whitespace/header normalization.
Prisma Client exposes delegates for all initialized CMS lists.
```

### $ npx --no-install tsx scripts/validate-cms-workflow-runtime.ts

```text
$ npx --no-install tsx scripts/validate-cms-workflow-runtime.ts
[cms][memory] bootstrap mode=seeded(default)
{"phase":"relation","projectId":"cmsylup2v0000xyuzpsfkbjdb","fieldPaths":["id","name","legacyText","customLabel","rank","owner"],"customViewMarker":"gap14-custom-view","rank":8,"ownerId":"cmsylv5x9000055uzlt96nz4c"}
```

### relation: {"phase":"relation","projectId":"cmsylup2v0000xyuzpsfkbjdb","fieldPaths":["id","name","legacyText","customLabel","rank","owner"],"customViewMarker":"gap14-custom-view","rank":8,"ownerId":"cmsylv5x9000055uzlt96nz4c"}

```text
relation: {"phase":"relation","projectId":"cmsylup2v0000xyuzpsfkbjdb","fieldPaths":["id","name","legacyText","customLabel","rank","owner"],"customViewMarker":"gap14-custom-view","rank":8,"ownerId":"cmsylv5x9000055uzlt96nz4c"}
```

### $ npm run build

```text
$ npm run build
> build
> npm run cms:generate && vite build


> cms:generate
> tsx scripts/cms-generate.ts

[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.
vite v8.1.5 building client environment for production...
[2Ktransforming...✓ 2298 modules transformed.
rendering chunks...
computing gzip size...
.output/public/assets/geist-cyrillic-wght-normal-CHSlOQsW.woff2    14.69 kB
.output/public/assets/geist-latin-ext-wght-normal-DMtmJ5ZE.woff2   15.30 kB
.output/public/assets/geist-latin-wght-normal-Dm3htQBi.woff2       28.40 kB
.output/public/assets/globals-BzmcnV6H.css                        108.38 kB │ gzip:  17.67 kB
.output/public/assets/not-found-i5RsCZif.js                         0.11 kB │ gzip:   0.11 kB
.output/public/assets/loader-circle-CPCZHts7.js                     0.13 kB │ gzip:   0.14 kB
.output/public/assets/plus-B2MO-F6O.js                              0.14 kB │ gzip:   0.14 kB
.output/public/assets/rotate-ccw-CGMxlfgp.js                        0.19 kB │ gzip:   0.17 kB
.output/public/assets/dashboard-server-B6jvZFYA.js                  0.19 kB │ gzip:   0.16 kB
.output/public/assets/database-DNh6IVyp.js                          0.23 kB │ gzip:   0.19 kB
.output/public/assets/useRouter-DI30jI4j.js                         0.26 kB │ gzip:   0.22 kB
.output/public/assets/useSuspenseQuery-Dmj-_zdF.js                  0.29 kB │ gzip:   0.24 kB
.output/public/assets/dashboard-CgsL3L1E.js                         0.37 kB │ gzip:   0.28 kB
.output/public/assets/_listKey-BG7W0LgH.js                          1.32 kB │ gzip:   0.64 kB
.output/public/assets/useMatch-D7UbkMXm.js                          1.49 kB │ gzip:   0.74 kB
.output/public/assets/breadcrumb-Bx56BVF1.js                        1.71 kB │ gzip:   0.69 kB
.output/public/assets/routes-C9r_ViHE.js                            1.78 kB │ gzip:   0.76 kB
.output/public/assets/card-By6aQbLT.js                              1.86 kB │ gzip:   0.69 kB
.output/public/assets/page-container-D5d2JmdA.js                    2.24 kB │ gzip:   0.77 kB
.output/public/assets/label-BVkifGnP.js                             2.50 kB │ gzip:   1.16 kB
.output/public/assets/toaster-DWDNfGeC.js                           2.62 kB │ gzip:   1.12 kB
.output/public/assets/logo-BpuQe06O.js                              2.90 kB │ gzip:   1.16 kB
.output/public/assets/no-access-B8C14xh5.js                         3.06 kB │ gzip:   1.17 kB
.output/public/assets/error-boundary-R1dNDH_a.js                    4.18 kB │ gzip:   1.51 kB
.output/public/assets/_listKey.create-CLLR13fd.js                   5.02 kB │ gzip:   1.99 kB
.output/public/assets/use-prevent-navigation-CL5cb2_s.js            5.34 kB │ gzip:   1.84 kB
.output/public/assets/dashboard-TiZ1XVU2.js                         5.51 kB │ gzip:   1.48 kB
.output/public/assets/signup-EOFXTPgK.js                            5.71 kB │ gzip:   1.96 kB
.output/public/assets/init-Ck2Obt8l.js                              5.81 kB │ gzip:   2.02 kB
.output/public/assets/signin-B0anVZ0_.js                            6.12 kB │ gzip:   1.95 kB
.output/public/assets/reset-Ccc60cuo.js                             6.81 kB │ gzip:   2.03 kB
.output/public/assets/input-Bxv6cBpo.js                             7.22 kB │ gzip:   3.35 kB
.output/public/assets/item-page-actions-BgoWjd8t.js                 7.75 kB │ gzip:   2.78 kB
.output/public/assets/useBaseQuery-qCmXCV76.js                      9.47 kB │ gzip:   3.56 kB
.output/public/assets/_listKey._id-BIABVObY.js                     17.81 kB │ gzip:   4.60 kB
.output/public/assets/jsx-dev-runtime-Dg75gIvu.js                  25.98 kB │ gzip:   8.34 kB
.output/public/assets/dropdown-menu-Mrvzl2Kj.js                    41.63 kB │ gzip:  13.97 kB
.output/public/assets/link-BEFiSopK.js                             41.73 kB │ gzip:  14.10 kB
.output/public/assets/button-Cz_Hhvjn.js                           42.85 kB │ gzip:  14.78 kB
.output/public/assets/dashboard-DJVxusgg.js                        44.60 kB │ gzip:  12.01 kB
.output/public/assets/_listKey-BxQdiusF.js                         63.98 kB │ gzip:  16.11 kB
.output/public/assets/sidebar-D7Vwl6qt.js                         127.85 kB │ gzip:  41.59 kB
.output/public/assets/graphql-error-details-Bw438KqG.js           357.64 kB │ gzip:  90.65 kB
.output/public/assets/index-DApVXzT2.js                           536.05 kB │ gzip: 162.44 kB

✓ built in 626ms
vite v8.1.5 building ssr environment for production...
[2Ktransforming...✓ 213 modules transformed.
rendering chunks...
computing gzip size...
.nitro-build/vite/services/ssr/assets/geist-cyrillic-wght-normal-CHSlOQsW.woff2    14.69 kB
.nitro-build/vite/services/ssr/assets/geist-latin-ext-wght-normal-DMtmJ5ZE.woff2   15.30 kB
.nitro-build/vite/services/ssr/assets/geist-latin-wght-normal-Dm3htQBi.woff2       28.40 kB
.nitro-build/vite/services/ssr/assets/globals-BzmcnV6H.css                        108.38 kB │ gzip: 17.67 kB
.nitro-build/vite/services/ssr/assets/start-BRont_2I.js                             0.15 kB │ gzip:  0.13 kB
.nitro-build/vite/services/ssr/assets/empty-plugin-adapters-CykxgOdX.js             0.23 kB │ gzip:  0.16 kB
.nitro-build/vite/services/ssr/assets/init-B6dlP_5p.js                              0.46 kB │ gzip:  0.27 kB
.nitro-build/vite/services/ssr/assets/signin-CpejL3DW.js                            0.56 kB │ gzip:  0.33 kB
.nitro-build/vite/services/ssr/assets/dashboard-Cg951d0i.js                         0.58 kB │ gzip:  0.35 kB
.nitro-build/vite/services/ssr/assets/signup-CPVLeJKr.js                            0.68 kB │ gzip:  0.40 kB
.nitro-build/vite/services/ssr/assets/reset-Dd0RCS4B.js                             0.68 kB │ gzip:  0.36 kB
.nitro-build/vite/services/ssr/assets/theme-script-BdrRdlRG.js                      0.74 kB │ gzip:  0.39 kB
.nitro-build/vite/services/ssr/assets/input-C_ImqHI9.js                             1.13 kB │ gzip:  0.62 kB
.nitro-build/vite/services/ssr/assets/dashboard-auth.functions-fD4YxxWF.js          1.16 kB │ gzip:  0.53 kB
.nitro-build/vite/services/ssr/assets/_listKey.create-DtsHXMEd.js                   1.36 kB │ gzip:  0.55 kB
.nitro-build/vite/services/ssr/assets/_listKey._id-BsSTodSQ.js                      1.37 kB │ gzip:  0.62 kB
.nitro-build/vite/services/ssr/assets/dashboard-server-D9IVVr41.js                  1.39 kB │ gzip:  0.60 kB
.nitro-build/vite/services/ssr/assets/dashboard-route-guards-BgpEcu8n.js            1.84 kB │ gzip:  0.57 kB
.nitro-build/vite/services/ssr/assets/_listKey-4o7cCwrr.js                          1.96 kB │ gzip:  0.79 kB
.nitro-build/vite/services/ssr/assets/gql-names-1xT87xXZ.js                         2.10 kB │ gzip:  0.72 kB
.nitro-build/vite/services/ssr/assets/label-C9om2tZY.js                             2.39 kB │ gzip:  1.03 kB
.nitro-build/vite/services/ssr/assets/card-BqmQVMtB.js                              2.42 kB │ gzip:  0.77 kB
.nitro-build/vite/services/ssr/assets/routes-DoRiFevc.js                            2.50 kB │ gzip:  0.84 kB
.nitro-build/vite/services/ssr/assets/breadcrumb-pCT_sDq4.js                        2.56 kB │ gzip:  0.80 kB
.nitro-build/vite/services/ssr/assets/_listKey-DOk-oF2D.js                          2.94 kB │ gzip:  1.14 kB
.nitro-build/vite/services/ssr/assets/button-yokujyud.js                            3.06 kB │ gzip:  1.18 kB
.nitro-build/vite/services/ssr/assets/no-access-BVbHUPan.js                         3.61 kB │ gzip:  1.05 kB
.nitro-build/vite/services/ssr/assets/page-container-DhxrQ5K-.js                    3.82 kB │ gzip:  1.02 kB
.nitro-build/vite/services/ssr/assets/toaster-BD0zwd3m.js                           4.01 kB │ gzip:  1.32 kB
.nitro-build/vite/services/ssr/assets/logo-D0SViIMe.js                              4.01 kB │ gzip:  1.36 kB
.nitro-build/vite/services/ssr/assets/_tanstack-start-manifest_v-Bei7oVqJ.js        4.51 kB │ gzip:  1.10 kB
.nitro-build/vite/services/ssr/assets/dropdown-menu-abBoxLAC.js                     5.63 kB │ gzip:  1.45 kB
.nitro-build/vite/services/ssr/assets/use-prevent-navigation-GvvQ3uhJ.js            6.15 kB │ gzip:  1.67 kB
.nitro-build/vite/services/ssr/assets/error-boundary-CMm36eB9.js                    6.28 kB │ gzip:  1.75 kB
.nitro-build/vite/services/ssr/assets/dashboard-DZQLU5WO.js                         8.37 kB │ gzip:  1.84 kB
.nitro-build/vite/services/ssr/assets/_listKey.create-DpzKyPdu.js                   8.97 kB │ gzip:  2.67 kB
.nitro-build/vite/services/ssr/assets/signup-Dr6akTYh.js                            9.11 kB │ gzip:  2.52 kB
.nitro-build/vite/services/ssr/assets/init-COrSB8ea.js                              9.15 kB │ gzip:  2.56 kB
.nitro-build/vite/services/ssr/assets/signin-Db7QUfmO.js                           10.00 kB │ gzip:  2.52 kB
.nitro-build/vite/services/ssr/assets/item-page-actions-DVINgy_9.js                10.15 kB │ gzip:  2.43 kB
.nitro-build/vite/services/ssr/assets/reset-CRAk9BYZ.js                            10.82 kB │ gzip:  2.59 kB
.nitro-build/vite/services/ssr/assets/sidebar-D-RLsXUl.js                          27.88 kB │ gzip:  5.81 kB
.nitro-build/vite/services/ssr/assets/_listKey._id-D-Pk63Zu.js                     29.14 kB │ gzip:  5.47 kB
.nitro-build/vite/services/ssr/assets/graphql-client-CWkj-Jzw.js                   41.02 kB │ gzip:  8.51 kB
.nitro-build/vite/services/ssr/assets/prisma-C7VZWDGm.js                           43.02 kB │ gzip: 10.73 kB
.nitro-build/vite/services/ssr/assets/router-CVKe1G_g.js                           45.53 kB │ gzip: 12.24 kB
.nitro-build/vite/services/ssr/assets/dashboard-daSBwOBW.js                        53.54 kB │ gzip:  9.74 kB
.nitro-build/vite/services/ssr/index.js                                            67.35 kB │ gzip: 17.22 kB
.nitro-build/vite/services/ssr/assets/_listKey-rjVnrveW.js                         92.19 kB │ gzip: 16.66 kB
.nitro-build/vite/services/ssr/assets/mutation-state-CmybAhSX.js                  100.98 kB │ gzip: 21.81 kB
.nitro-build/vite/services/ssr/assets/dashboard-auth-MMwGmhdG.js                  180.59 kB │ gzip: 35.13 kB
.nitro-build/vite/services/ssr/assets/graphql-error-details-8QcouSJU.js           246.63 kB │ gzip: 41.16 kB

✓ built in 316ms
vite v8.1.5 building nitro environment for production...
[2Ktransforming...✓ 2962 modules transformed.
rendering chunks...
computing gzip size...
.output/server/_ssr/start-BRont_2I.mjs                             0.13 kB │ gzip:   0.12 kB
.output/server/_ssr/empty-plugin-adapters-CykxgOdX.mjs             0.22 kB │ gzip:   0.16 kB
.output/server/_ssr/init-B6dlP_5p.mjs                              0.50 kB │ gzip:   0.32 kB
.output/server/_ssr/signin-CpejL3DW.mjs                            0.61 kB │ gzip:   0.37 kB
.output/server/_libs/direction.mjs                                 0.62 kB │ gzip:   0.42 kB
.output/server/_libs/is-plain-object.mjs                           0.65 kB │ gzip:   0.36 kB
.output/server/_ssr/dashboard-Cg951d0i.mjs                         0.69 kB │ gzip:   0.41 kB
.output/server/_ssr/signup-CPVLeJKr.mjs                            0.72 kB │ gzip:   0.44 kB
.output/server/_ssr/reset-Dd0RCS4B.mjs                             0.73 kB │ gzip:   0.40 kB
.output/server/_ssr/theme-script-BdrRdlRG.mjs                      0.76 kB │ gzip:   0.41 kB
.output/server/_libs/react.mjs                                     0.80 kB │ gzip:   0.40 kB
.output/server/_libs/graphql-ts__schema.mjs                        0.91 kB │ gzip:   0.40 kB
.output/server/_chunks/ssr-renderer.mjs                            0.95 kB │ gzip:   0.48 kB
.output/server/_ssr/dashboard-auth.functions-fD4YxxWF.mjs          1.07 kB │ gzip:   0.51 kB
.output/server/_libs/hookable.mjs                                  1.16 kB │ gzip:   0.51 kB
.output/server/_libs/scroll-into-view-if-needed.mjs                1.21 kB │ gzip:   0.61 kB
.output/server/_ssr/input-C_ImqHI9.mjs                             1.24 kB │ gzip:   0.66 kB
.output/server/_listKey.create-DtsHXMEd.mjs                        1.41 kB │ gzip:   0.59 kB
.output/server/_listKey._id-BsSTodSQ.mjs                           1.42 kB │ gzip:   0.66 kB
.output/server/_libs/graphql-yoga__logger.mjs                      1.43 kB │ gzip:   0.55 kB
.output/server/_ssr/dashboard-server-D9IVVr41.mjs                  1.49 kB │ gzip:   0.66 kB
.output/server/_libs/graphql-tools__utils.mjs                      1.55 kB │ gzip:   0.62 kB
.output/server/_runtime.mjs                                        1.86 kB │ gzip:   0.85 kB
.output/server/_ssr/dashboard-route-guards-BgpEcu8n.mjs            1.87 kB │ gzip:   0.60 kB
.output/server/_ssr/gql-names-1xT87xXZ.mjs                         2.13 kB │ gzip:   0.74 kB
.output/server/_libs/ufo.mjs                                       2.19 kB │ gzip:   0.71 kB
.output/server/_listKey-4o7cCwrr.mjs                               2.22 kB │ gzip:   0.86 kB
.output/server/_ssr/label-C9om2tZY.mjs                             2.42 kB │ gzip:   1.06 kB
.output/server/_ssr/card-BqmQVMtB.mjs                              2.69 kB │ gzip:   0.81 kB
.output/server/_libs/graphql-upload.mjs                            2.73 kB │ gzip:   1.03 kB
.output/server/_ssr/breadcrumb-pCT_sDq4.mjs                        2.74 kB │ gzip:   0.83 kB
.output/server/_ssr/routes-DoRiFevc.mjs                            2.86 kB │ gzip:   0.91 kB
.output/server/_listKey-DOk-oF2D.mjs                               2.93 kB │ gzip:   1.16 kB
.output/server/_ssr/button-yokujyud.mjs                            3.15 kB │ gzip:   1.23 kB
.output/server/_libs/class-variance-authority+clsx.mjs             3.17 kB │ gzip:   1.24 kB
.output/server/_libs/braintree__sanitize-url.mjs                   3.41 kB │ gzip:   1.13 kB
.output/server/_libs/is-hotkey.mjs                                 3.98 kB │ gzip:   1.66 kB
.output/server/_libs/compute-scroll-into-view.mjs                  4.07 kB │ gzip:   1.65 kB
.output/server/_ssr/no-access-BVbHUPan.mjs                         4.09 kB │ gzip:   1.12 kB
.output/server/_libs/h3-rules.mjs                                  4.20 kB │ gzip:   1.39 kB
.output/server/_libs/@tanstack/react-router-ssr-query+[...].mjs    4.35 kB │ gzip:   1.34 kB
.output/server/_ssr/page-container-DhxrQ5K-.mjs                    4.38 kB │ gzip:   1.10 kB
.output/server/_ssr/logo-D0SViIMe.mjs                              4.50 kB │ gzip:   1.43 kB
.output/server/_tanstack-start-manifest_v-Bei7oVqJ.mjs             4.56 kB │ gzip:   1.13 kB
.output/server/_ssr/toaster-BD0zwd3m.mjs                           4.58 kB │ gzip:   1.42 kB
.output/server/_libs/slate-history.mjs                             5.67 kB │ gzip:   1.71 kB
.output/server/_ssr/dropdown-menu-abBoxLAC.mjs                     6.21 kB │ gzip:   1.53 kB
.output/server/_ssr/use-prevent-navigation-GvvQ3uhJ.mjs            6.66 kB │ gzip:   1.75 kB
.output/server/_libs/tanstack__react-query.mjs                     6.74 kB │ gzip:   1.84 kB
.output/server/_ssr/error-boundary-CMm36eB9.mjs                    7.08 kB │ gzip:   1.87 kB
.output/server/_ssr/dashboard-DZQLU5WO.mjs                         9.42 kB │ gzip:   1.92 kB
.output/server/_libs/h3-v2+rou3.mjs                                9.80 kB │ gzip:   3.05 kB
.output/server/_listKey.create-DpzKyPdu.mjs                        9.89 kB │ gzip:   2.79 kB
.output/server/_ssr/init-COrSB8ea.mjs                             10.15 kB │ gzip:   2.68 kB
.output/server/_ssr/signup-Dr6akTYh.mjs                           10.16 kB │ gzip:   2.64 kB
.output/server/_ssr/item-page-actions-DVINgy_9.mjs                11.07 kB │ gzip:   2.56 kB
.output/server/_ssr/signin-Db7QUfmO.mjs                           11.14 kB │ gzip:   2.65 kB
.output/server/_ssr/reset-CRAk9BYZ.mjs                            12.03 kB │ gzip:   2.72 kB
.output/server/_libs/tanstack__history.mjs                        12.08 kB │ gzip:   3.47 kB
.output/server/_libs/@whatwg-node/disposablestack+[...].mjs       13.38 kB │ gzip:   2.69 kB
.output/server/_libs/lodash.mjs                                   17.86 kB │ gzip:   4.46 kB
.output/server/_libs/juggle__resize-observer.mjs                  18.51 kB │ gzip:   4.46 kB
.output/server/_libs/@prisma/adapter-better-sqlite3+[...].mjs     22.54 kB │ gzip:   6.59 kB
.output/server/_libs/@graphql-ts/extend+[...].mjs                 25.53 kB │ gzip:   6.07 kB
.output/server/_libs/@envelop/core+[...].mjs                      25.89 kB │ gzip:   6.10 kB
.output/server/index.mjs                                          27.34 kB │ gzip:   8.04 kB
.output/server/_ssr/sidebar-D-RLsXUl.mjs                          29.26 kB │ gzip:   5.95 kB
.output/server/_libs/lucide-react.mjs                             30.33 kB │ gzip:   5.70 kB
.output/server/_listKey._id-D-Pk63Zu.mjs                          31.88 kB │ gzip:   5.62 kB
.output/server/_libs/whatwg-node__server.mjs                      33.32 kB │ gzip:   8.14 kB
.output/server/_libs/bcryptjs.mjs                                 36.73 kB │ gzip:  12.09 kB
.output/server/_ssr/graphql-client-CWkj-Jzw.mjs                   40.95 kB │ gzip:   8.55 kB
.output/server/_ssr/prisma-C7VZWDGm.mjs                           42.87 kB │ gzip:  10.75 kB
.output/server/_libs/fastify__busboy.mjs                          43.18 kB │ gzip:  10.59 kB
.output/server/_ssr/router-CVKe1G_g.mjs                           44.82 kB │ gzip:  12.12 kB
.output/server/_libs/h3+rou3+srvx.mjs                             47.80 kB │ gzip:  12.90 kB
.output/server/_libs/decimal.js.mjs                               55.25 kB │ gzip:  15.43 kB
.output/server/_ssr/dashboard-daSBwOBW.mjs                        58.02 kB │ gzip:   9.85 kB
.output/server/_libs/slate-dom.mjs                                58.96 kB │ gzip:  14.93 kB
.output/server/_ssr/ssr.mjs                                       64.91 kB │ gzip:  16.90 kB
.output/server/_libs/tanstack__query-core.mjs                     67.58 kB │ gzip:  14.47 kB
.output/server/_libs/@graphql-tools/merge+[...].mjs               71.68 kB │ gzip:  15.83 kB
.output/server/_libs/@graphql-tools/schema+[...].mjs              75.93 kB │ gzip:  13.20 kB
.output/server/_libs/@tanstack/router-core+[...].mjs              79.47 kB │ gzip:  19.86 kB
.output/server/_libs/tailwind-merge.mjs                           88.13 kB │ gzip:  15.66 kB
.output/server/_libs/graphql-yoga+lru-cache.mjs                   98.23 kB │ gzip:  26.17 kB
.output/server/_listKey-rjVnrveW.mjs                              99.01 kB │ gzip:  16.88 kB
.output/server/_ssr/mutation-state-CmybAhSX.mjs                  100.18 kB │ gzip:  21.64 kB
.output/server/_libs/slate-react.mjs                             115.06 kB │ gzip:  24.94 kB
.output/server/_libs/@whatwg-node/fetch+[...].mjs                116.56 kB │ gzip:  23.85 kB
.output/server/_libs/@prisma/adapter-pg.mjs                      168.81 kB │ gzip:  40.39 kB
.output/server/_ssr/dashboard-auth-MMwGmhdG.mjs                  180.35 kB │ gzip:  35.09 kB
.output/server/_libs/slate.mjs                                   189.13 kB │ gzip:  38.17 kB
.output/server/_ssr/graphql-error-details-8QcouSJU.mjs           259.97 kB │ gzip:  41.81 kB
.output/server/_libs/@base-ui/react+[...].mjs                    508.13 kB │ gzip: 107.69 kB
.output/server/_libs/@tanstack/react-router+[...].mjs            664.73 kB │ gzip: 138.93 kB
.output/server/_libs/@graphql-tools/executor+[...].mjs           696.59 kB │ gzip: 128.10 kB
.output/server/_libs/@prisma/adapter-mariadb+[...].mjs           930.08 kB │ gzip: 280.58 kB

✓ built in 478ms
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
nf3: could not resolve `traceInclude` entry "node-libcurl" from any root
```

### fresh temporary-copy npm run build passed after relation CRUD

```text
fresh temporary-copy npm run build passed after relation CRUD
```

### $ npm run cms:check [exit 1]

```text
$ npm run cms:check [exit 1]
> cms:check
> tsx scripts/cms-generate.ts --check && tsx scripts/compare-cms-prisma-schema.ts && tsx scripts/check-cms-prisma-delegates.ts

[cms][memory] bootstrap mode=seeded(default)
/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-generate.ts:317
      throw new Error(
            ^

Error: CMS generated artifacts are out of date. Run npm run cms:generate. Drifted files: .cms/manifest.json, .cms/admin-meta.json, .cms/schema.graphql, .cms/types.ts, .cms/schema.prisma, prisma/schema.prisma, .cms/artifact-hash.json
    at main (/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-generate.ts:317:13)
    at async <anonymous> (/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-generate.ts:332:1)

Node.js v22.22.3
```

### $ npx --no-install tsx scripts/cms-generate.ts

```text
$ npx --no-install tsx scripts/cms-generate.ts
[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.
```

### $ npx --no-install tsx scripts/cms-generate.ts --check

```text
$ npx --no-install tsx scripts/cms-generate.ts --check
[cms][memory] bootstrap mode=seeded(default)
CMS generated artifacts are up to date.
```

### Verified pg_dump/pg_restore rollback copy retained populated legacyText, custom metadata field data, and relation data.

```text
Verified pg_dump/pg_restore rollback copy retained populated legacyText, custom metadata field data, and relation data.
```

### Dropped and verified cleanup of the temporary rollback database.

```text
Dropped and verified cleanup of the temporary rollback database.
```

### $ npm run migrate:gen -- --name gap14_remove [exit 1]

```text
$ npm run migrate:gen -- --name gap14_remove [exit 1]
> migrate:gen
> tsx scripts/cms-migrate.ts --name gap14_remove


> cms:generate
> tsx scripts/cms-generate.ts

[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.
-- AlterTable
ALTER TABLE "Project" DROP COLUMN "legacy_text";

Migration 20260818115457_gap14_remove: destructive (drop-column)
Loaded Prisma config from prisma.config.ts.

Prisma migrate dev is non-interactive here; created prisma/migrations/20260818115457_gap14_remove with prisma migrate diff for the same schema transition.
Error: Destructive Prisma migration "gap14_remove" requires explicit acknowledgement. Detected operations: drop-column. Customize/inspect the migration first, then rerun with --allow-destructive only after a verified backup.
    at assertMigrationIsSafe (/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/src/features/cms/migration-safety.ts:40:9)
    at main (/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-migrate.ts:135:3)
    at async <anonymous> (/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-migrate.ts:145:1)
```

### destructive remove migration was blocked before apply

```text
destructive remove migration was blocked before apply
```

### $ npm run migrate:gen -- --name gap14_remove --allow-destructive

```text
$ npm run migrate:gen -- --name gap14_remove --allow-destructive
> migrate:gen
> tsx scripts/cms-migrate.ts --name gap14_remove --allow-destructive


> cms:generate
> tsx scripts/cms-generate.ts

[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.
Migration 20260818115457_gap14_remove: destructive (drop-column)
Datasource "db": PostgreSQL database "cms", schema "public" at "127.0.0.1:32796"

6 migrations found in prisma/migrations

Applying migration `20260818115457_gap14_remove`

The following migration(s) have been applied:

migrations/
  └─ 20260818115457_gap14_remove/
    └─ migration.sql

All migrations have been successfully applied.

> db:generate
> npm run cms:generate && DATABASE_URL=${DATABASE_URL:-postgresql://cms_generate:cms_generate@127.0.0.1:1/cms_generate} prisma generate


> cms:generate
> tsx scripts/cms-generate.ts

[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.

✔ Generated Prisma Client (7.9.1) to ./src/generated/prisma in 18ms

Applied and refreshed Prisma Client for gap14_remove.
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
```

### $ npm run cms:check

```text
$ npm run cms:check
> cms:check
> tsx scripts/cms-generate.ts --check && tsx scripts/compare-cms-prisma-schema.ts && tsx scripts/check-cms-prisma-delegates.ts

[cms][memory] bootstrap mode=seeded(default)
CMS generated artifacts are up to date.
Generated .cms/schema.prisma matches prisma/schema.prisma after whitespace/header normalization.
Prisma Client exposes delegates for all initialized CMS lists.
```

### $ npx --no-install tsx scripts/validate-cms-workflow-runtime.ts

```text
$ npx --no-install tsx scripts/validate-cms-workflow-runtime.ts
[cms][memory] bootstrap mode=seeded(default)
{"phase":"remove","projectId":"cmsylup2v0000xyuzpsfkbjdb","fieldPaths":["id","name","customLabel","rank","owner"],"customViewMarker":"gap14-custom-view","rank":8,"ownerId":"cmsylv5x9000055uzlt96nz4c"}
```

### remove: {"phase":"remove","projectId":"cmsylup2v0000xyuzpsfkbjdb","fieldPaths":["id","name","customLabel","rank","owner"],"customViewMarker":"gap14-custom-view","rank":8,"ownerId":"cmsylv5x9000055uzlt96nz4c"}

```text
remove: {"phase":"remove","projectId":"cmsylup2v0000xyuzpsfkbjdb","fieldPaths":["id","name","customLabel","rank","owner"],"customViewMarker":"gap14-custom-view","rank":8,"ownerId":"cmsylv5x9000055uzlt96nz4c"}
```

### $ npm run cms:check [exit 1]

```text
$ npm run cms:check [exit 1]
> cms:check
> tsx scripts/cms-generate.ts --check && tsx scripts/compare-cms-prisma-schema.ts && tsx scripts/check-cms-prisma-delegates.ts

[cms][memory] bootstrap mode=seeded(default)
/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-generate.ts:317
      throw new Error(
            ^

Error: CMS generated artifacts are out of date. Run npm run cms:generate. Drifted files: .cms/manifest.json, .cms/admin-meta.json, .cms/schema.graphql, .cms/types.ts, .cms/schema.prisma, prisma/schema.prisma, .cms/artifact-hash.json
    at main (/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-generate.ts:317:13)
    at async <anonymous> (/Users/junaid/Code/tanstack-keystone-starter/.cms-temp/gap14-VTeAps/scripts/cms-generate.ts:332:1)

Node.js v22.22.3
```

### $ npx --no-install tsx scripts/cms-generate.ts

```text
$ npx --no-install tsx scripts/cms-generate.ts
[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.
```

### $ npx --no-install tsx scripts/cms-generate.ts --check

```text
$ npx --no-install tsx scripts/cms-generate.ts --check
[cms][memory] bootstrap mode=seeded(default)
CMS generated artifacts are up to date.
```

### $ npm run migrate:gen -- --name gap14_revert

```text
$ npm run migrate:gen -- --name gap14_revert
> migrate:gen
> tsx scripts/cms-migrate.ts --name gap14_revert


> cms:generate
> tsx scripts/cms-generate.ts

[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.
Datasource "db": PostgreSQL database "cms", schema "public" at "127.0.0.1:32796"

Prisma Migrate created the following migration without applying it 20260818115503_gap14_revert

You can now edit it and apply it by running prisma migrate dev.
Migration 20260818115503_gap14_revert: non-destructive
Datasource "db": PostgreSQL database "cms", schema "public" at "127.0.0.1:32796"

7 migrations found in prisma/migrations

Applying migration `20260818115503_gap14_revert`

The following migration(s) have been applied:

migrations/
  └─ 20260818115503_gap14_revert/
    └─ migration.sql

All migrations have been successfully applied.

> db:generate
> npm run cms:generate && DATABASE_URL=${DATABASE_URL:-postgresql://cms_generate:cms_generate@127.0.0.1:1/cms_generate} prisma generate


> cms:generate
> tsx scripts/cms-generate.ts

[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.

✔ Generated Prisma Client (7.9.1) to ./src/generated/prisma in 18ms

Applied and refreshed Prisma Client for gap14_revert.
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
```

### $ npm run cms:check

```text
$ npm run cms:check
> cms:check
> tsx scripts/cms-generate.ts --check && tsx scripts/compare-cms-prisma-schema.ts && tsx scripts/check-cms-prisma-delegates.ts

[cms][memory] bootstrap mode=seeded(default)
CMS generated artifacts are up to date.
Generated .cms/schema.prisma matches prisma/schema.prisma after whitespace/header normalization.
Prisma Client exposes delegates for all initialized CMS lists.
```

### $ npx --no-install tsx scripts/validate-cms-workflow-runtime.ts

```text
$ npx --no-install tsx scripts/validate-cms-workflow-runtime.ts
[cms][memory] bootstrap mode=seeded(default)
{"phase":"revert","projectId":"cmsylup2v0000xyuzpsfkbjdb","fieldPaths":["id","name","legacyText","customLabel","rank","owner"],"customViewMarker":"gap14-custom-view","rank":8,"ownerId":"cmsylv5x9000055uzlt96nz4c"}
```

### revert: {"phase":"revert","projectId":"cmsylup2v0000xyuzpsfkbjdb","fieldPaths":["id","name","legacyText","customLabel","rank","owner"],"customViewMarker":"gap14-custom-view","rank":8,"ownerId":"cmsylv5x9000055uzlt96nz4c"}

```text
revert: {"phase":"revert","projectId":"cmsylup2v0000xyuzpsfkbjdb","fieldPaths":["id","name","legacyText","customLabel","rank","owner"],"customViewMarker":"gap14-custom-view","rank":8,"ownerId":"cmsylv5x9000055uzlt96nz4c"}
```

### $ npm run build

```text
$ npm run build
> build
> npm run cms:generate && vite build


> cms:generate
> tsx scripts/cms-generate.ts

[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.
vite v8.1.5 building client environment for production...
[2Ktransforming...✓ 2298 modules transformed.
rendering chunks...
computing gzip size...
.output/public/assets/geist-cyrillic-wght-normal-CHSlOQsW.woff2    14.69 kB
.output/public/assets/geist-latin-ext-wght-normal-DMtmJ5ZE.woff2   15.30 kB
.output/public/assets/geist-latin-wght-normal-Dm3htQBi.woff2       28.40 kB
.output/public/assets/globals-CXWYx76w.css                        108.53 kB │ gzip:  17.69 kB
.output/public/assets/not-found-i5RsCZif.js                         0.11 kB │ gzip:   0.11 kB
.output/public/assets/loader-circle-CPCZHts7.js                     0.13 kB │ gzip:   0.14 kB
.output/public/assets/plus-B2MO-F6O.js                              0.14 kB │ gzip:   0.14 kB
.output/public/assets/rotate-ccw-CGMxlfgp.js                        0.19 kB │ gzip:   0.17 kB
.output/public/assets/dashboard-server-B6jvZFYA.js                  0.19 kB │ gzip:   0.16 kB
.output/public/assets/database-DNh6IVyp.js                          0.23 kB │ gzip:   0.19 kB
.output/public/assets/useRouter-DI30jI4j.js                         0.26 kB │ gzip:   0.22 kB
.output/public/assets/useSuspenseQuery-B-FqhLpJ.js                  0.29 kB │ gzip:   0.23 kB
.output/public/assets/dashboard-CgsL3L1E.js                         0.37 kB │ gzip:   0.28 kB
.output/public/assets/_listKey-mkClJ_9I.js                          1.32 kB │ gzip:   0.64 kB
.output/public/assets/useMatch-D7UbkMXm.js                          1.49 kB │ gzip:   0.74 kB
.output/public/assets/breadcrumb-Bx56BVF1.js                        1.71 kB │ gzip:   0.69 kB
.output/public/assets/routes-C9r_ViHE.js                            1.78 kB │ gzip:   0.76 kB
.output/public/assets/card-By6aQbLT.js                              1.86 kB │ gzip:   0.69 kB
.output/public/assets/page-container-D5d2JmdA.js                    2.24 kB │ gzip:   0.77 kB
.output/public/assets/label-BVkifGnP.js                             2.50 kB │ gzip:   1.16 kB
.output/public/assets/toaster-DWDNfGeC.js                           2.62 kB │ gzip:   1.12 kB
.output/public/assets/logo-BpuQe06O.js                              2.90 kB │ gzip:   1.16 kB
.output/public/assets/no-access-Ca2qsECj.js                         3.06 kB │ gzip:   1.16 kB
.output/public/assets/error-boundary-R1dNDH_a.js                    4.18 kB │ gzip:   1.51 kB
.output/public/assets/_listKey.create-BGEji49z.js                   5.02 kB │ gzip:   1.99 kB
.output/public/assets/use-prevent-navigation-CL5cb2_s.js            5.34 kB │ gzip:   1.84 kB
.output/public/assets/dashboard-iXzPPWg1.js                         5.51 kB │ gzip:   1.48 kB
.output/public/assets/signup-D4loDdzv.js                            5.71 kB │ gzip:   1.96 kB
.output/public/assets/init-bqowjrqi.js                              5.81 kB │ gzip:   2.02 kB
.output/public/assets/signin-D-SQqHZt.js                            6.12 kB │ gzip:   1.95 kB
.output/public/assets/reset-BYfSmBZY.js                             6.81 kB │ gzip:   2.03 kB
.output/public/assets/input-Bxv6cBpo.js                             7.22 kB │ gzip:   3.35 kB
.output/public/assets/item-page-actions-DXjYXX8E.js                 7.75 kB │ gzip:   2.78 kB
.output/public/assets/useBaseQuery-Bc4BD-wg.js                      9.47 kB │ gzip:   3.55 kB
.output/public/assets/_listKey._id-6LD0WWp_.js                     17.81 kB │ gzip:   4.60 kB
.output/public/assets/jsx-dev-runtime-Dg75gIvu.js                  25.98 kB │ gzip:   8.34 kB
.output/public/assets/dropdown-menu-Mrvzl2Kj.js                    41.63 kB │ gzip:  13.97 kB
.output/public/assets/link-BEFiSopK.js                             41.73 kB │ gzip:  14.10 kB
.output/public/assets/button-Cz_Hhvjn.js                           42.85 kB │ gzip:  14.78 kB
.output/public/assets/dashboard-B6UBwEm5.js                        44.60 kB │ gzip:  12.01 kB
.output/public/assets/_listKey-BolJLctu.js                         63.98 kB │ gzip:  16.11 kB
.output/public/assets/sidebar-D7Vwl6qt.js                         127.85 kB │ gzip:  41.59 kB
.output/public/assets/graphql-error-details-DyZ6NYJp.js           357.64 kB │ gzip:  90.65 kB
.output/public/assets/index-DockkwwT.js                           536.05 kB │ gzip: 162.44 kB

✓ built in 615ms
vite v8.1.5 building ssr environment for production...
[2Ktransforming...✓ 213 modules transformed.
rendering chunks...
computing gzip size...
.nitro-build/vite/services/ssr/assets/geist-cyrillic-wght-normal-CHSlOQsW.woff2    14.69 kB
.nitro-build/vite/services/ssr/assets/geist-latin-ext-wght-normal-DMtmJ5ZE.woff2   15.30 kB
.nitro-build/vite/services/ssr/assets/geist-latin-wght-normal-Dm3htQBi.woff2       28.40 kB
.nitro-build/vite/services/ssr/assets/globals-CXWYx76w.css                        108.53 kB │ gzip: 17.69 kB
.nitro-build/vite/services/ssr/assets/start-BRont_2I.js                             0.15 kB │ gzip:  0.13 kB
.nitro-build/vite/services/ssr/assets/empty-plugin-adapters-CykxgOdX.js             0.23 kB │ gzip:  0.16 kB
.nitro-build/vite/services/ssr/assets/init-B6dlP_5p.js                              0.46 kB │ gzip:  0.27 kB
.nitro-build/vite/services/ssr/assets/signin-CpejL3DW.js                            0.56 kB │ gzip:  0.33 kB
.nitro-build/vite/services/ssr/assets/dashboard-Cg951d0i.js                         0.58 kB │ gzip:  0.35 kB
.nitro-build/vite/services/ssr/assets/signup-CPVLeJKr.js                            0.68 kB │ gzip:  0.40 kB
.nitro-build/vite/services/ssr/assets/reset-Dd0RCS4B.js                             0.68 kB │ gzip:  0.36 kB
.nitro-build/vite/services/ssr/assets/theme-script-BdrRdlRG.js                      0.74 kB │ gzip:  0.39 kB
.nitro-build/vite/services/ssr/assets/input-C_ImqHI9.js                             1.13 kB │ gzip:  0.62 kB
.nitro-build/vite/services/ssr/assets/dashboard-auth.functions-fD4YxxWF.js          1.16 kB │ gzip:  0.53 kB
.nitro-build/vite/services/ssr/assets/_listKey.create-DtsHXMEd.js                   1.36 kB │ gzip:  0.55 kB
.nitro-build/vite/services/ssr/assets/_listKey._id-BsSTodSQ.js                      1.37 kB │ gzip:  0.62 kB
.nitro-build/vite/services/ssr/assets/dashboard-server-D9IVVr41.js                  1.39 kB │ gzip:  0.60 kB
.nitro-build/vite/services/ssr/assets/dashboard-route-guards-BgpEcu8n.js            1.84 kB │ gzip:  0.57 kB
.nitro-build/vite/services/ssr/assets/_listKey-4o7cCwrr.js                          1.96 kB │ gzip:  0.79 kB
.nitro-build/vite/services/ssr/assets/gql-names-1xT87xXZ.js                         2.10 kB │ gzip:  0.72 kB
.nitro-build/vite/services/ssr/assets/label-C9om2tZY.js                             2.39 kB │ gzip:  1.03 kB
.nitro-build/vite/services/ssr/assets/card-BqmQVMtB.js                              2.42 kB │ gzip:  0.77 kB
.nitro-build/vite/services/ssr/assets/routes-DoRiFevc.js                            2.50 kB │ gzip:  0.84 kB
.nitro-build/vite/services/ssr/assets/breadcrumb-pCT_sDq4.js                        2.56 kB │ gzip:  0.80 kB
.nitro-build/vite/services/ssr/assets/_listKey-DOk-oF2D.js                          2.94 kB │ gzip:  1.14 kB
.nitro-build/vite/services/ssr/assets/button-yokujyud.js                            3.06 kB │ gzip:  1.18 kB
.nitro-build/vite/services/ssr/assets/no-access-BVbHUPan.js                         3.61 kB │ gzip:  1.05 kB
.nitro-build/vite/services/ssr/assets/page-container-DhxrQ5K-.js                    3.82 kB │ gzip:  1.02 kB
.nitro-build/vite/services/ssr/assets/toaster-BD0zwd3m.js                           4.01 kB │ gzip:  1.32 kB
.nitro-build/vite/services/ssr/assets/logo-D0SViIMe.js                              4.01 kB │ gzip:  1.36 kB
.nitro-build/vite/services/ssr/assets/_tanstack-start-manifest_v-BsBw2vE0.js        4.51 kB │ gzip:  1.10 kB
.nitro-build/vite/services/ssr/assets/dropdown-menu-abBoxLAC.js                     5.63 kB │ gzip:  1.45 kB
.nitro-build/vite/services/ssr/assets/use-prevent-navigation-GvvQ3uhJ.js            6.15 kB │ gzip:  1.67 kB
.nitro-build/vite/services/ssr/assets/error-boundary-CMm36eB9.js                    6.28 kB │ gzip:  1.75 kB
.nitro-build/vite/services/ssr/assets/dashboard-DZQLU5WO.js                         8.37 kB │ gzip:  1.84 kB
.nitro-build/vite/services/ssr/assets/_listKey.create-DpzKyPdu.js                   8.97 kB │ gzip:  2.67 kB
.nitro-build/vite/services/ssr/assets/signup-Dr6akTYh.js                            9.11 kB │ gzip:  2.52 kB
.nitro-build/vite/services/ssr/assets/init-COrSB8ea.js                              9.15 kB │ gzip:  2.56 kB
.nitro-build/vite/services/ssr/assets/signin-Db7QUfmO.js                           10.00 kB │ gzip:  2.52 kB
.nitro-build/vite/services/ssr/assets/item-page-actions-DVINgy_9.js                10.15 kB │ gzip:  2.43 kB
.nitro-build/vite/services/ssr/assets/reset-CRAk9BYZ.js                            10.82 kB │ gzip:  2.59 kB
.nitro-build/vite/services/ssr/assets/sidebar-D-RLsXUl.js                          27.88 kB │ gzip:  5.81 kB
.nitro-build/vite/services/ssr/assets/_listKey._id-D-Pk63Zu.js                     29.14 kB │ gzip:  5.47 kB
.nitro-build/vite/services/ssr/assets/graphql-client-CWkj-Jzw.js                   41.02 kB │ gzip:  8.51 kB
.nitro-build/vite/services/ssr/assets/prisma-C7VZWDGm.js                           43.02 kB │ gzip: 10.73 kB
.nitro-build/vite/services/ssr/assets/router-IaX-H2oO.js                           45.53 kB │ gzip: 12.25 kB
.nitro-build/vite/services/ssr/assets/dashboard-daSBwOBW.js                        53.54 kB │ gzip:  9.74 kB
.nitro-build/vite/services/ssr/index.js                                            67.35 kB │ gzip: 17.22 kB
.nitro-build/vite/services/ssr/assets/_listKey-rjVnrveW.js                         92.19 kB │ gzip: 16.66 kB
.nitro-build/vite/services/ssr/assets/mutation-state-CmybAhSX.js                  100.98 kB │ gzip: 21.81 kB
.nitro-build/vite/services/ssr/assets/dashboard-auth-MMwGmhdG.js                  180.59 kB │ gzip: 35.13 kB
.nitro-build/vite/services/ssr/assets/graphql-error-details-8QcouSJU.js           246.63 kB │ gzip: 41.16 kB

✓ built in 331ms
vite v8.1.5 building nitro environment for production...
[2Ktransforming...✓ 2962 modules transformed.
rendering chunks...
computing gzip size...
.output/server/_ssr/start-BRont_2I.mjs                             0.13 kB │ gzip:   0.12 kB
.output/server/_ssr/empty-plugin-adapters-CykxgOdX.mjs             0.22 kB │ gzip:   0.16 kB
.output/server/_ssr/init-B6dlP_5p.mjs                              0.50 kB │ gzip:   0.32 kB
.output/server/_ssr/signin-CpejL3DW.mjs                            0.61 kB │ gzip:   0.37 kB
.output/server/_libs/direction.mjs                                 0.62 kB │ gzip:   0.42 kB
.output/server/_libs/is-plain-object.mjs                           0.65 kB │ gzip:   0.36 kB
.output/server/_ssr/dashboard-Cg951d0i.mjs                         0.69 kB │ gzip:   0.41 kB
.output/server/_ssr/signup-CPVLeJKr.mjs                            0.72 kB │ gzip:   0.44 kB
.output/server/_ssr/reset-Dd0RCS4B.mjs                             0.73 kB │ gzip:   0.40 kB
.output/server/_ssr/theme-script-BdrRdlRG.mjs                      0.76 kB │ gzip:   0.41 kB
.output/server/_libs/react.mjs                                     0.80 kB │ gzip:   0.40 kB
.output/server/_libs/graphql-ts__schema.mjs                        0.91 kB │ gzip:   0.40 kB
.output/server/_chunks/ssr-renderer.mjs                            0.95 kB │ gzip:   0.48 kB
.output/server/_ssr/dashboard-auth.functions-fD4YxxWF.mjs          1.07 kB │ gzip:   0.51 kB
.output/server/_libs/hookable.mjs                                  1.16 kB │ gzip:   0.51 kB
.output/server/_libs/scroll-into-view-if-needed.mjs                1.21 kB │ gzip:   0.61 kB
.output/server/_ssr/input-C_ImqHI9.mjs                             1.24 kB │ gzip:   0.66 kB
.output/server/_listKey.create-DtsHXMEd.mjs                        1.41 kB │ gzip:   0.59 kB
.output/server/_listKey._id-BsSTodSQ.mjs                           1.42 kB │ gzip:   0.66 kB
.output/server/_libs/graphql-yoga__logger.mjs                      1.43 kB │ gzip:   0.55 kB
.output/server/_ssr/dashboard-server-D9IVVr41.mjs                  1.49 kB │ gzip:   0.66 kB
.output/server/_libs/graphql-tools__utils.mjs                      1.55 kB │ gzip:   0.62 kB
.output/server/_runtime.mjs                                        1.86 kB │ gzip:   0.85 kB
.output/server/_ssr/dashboard-route-guards-BgpEcu8n.mjs            1.87 kB │ gzip:   0.60 kB
.output/server/_ssr/gql-names-1xT87xXZ.mjs                         2.13 kB │ gzip:   0.74 kB
.output/server/_libs/ufo.mjs                                       2.19 kB │ gzip:   0.71 kB
.output/server/_listKey-4o7cCwrr.mjs                               2.22 kB │ gzip:   0.86 kB
.output/server/_ssr/label-C9om2tZY.mjs                             2.42 kB │ gzip:   1.06 kB
.output/server/_ssr/card-BqmQVMtB.mjs                              2.69 kB │ gzip:   0.81 kB
.output/server/_libs/graphql-upload.mjs                            2.73 kB │ gzip:   1.03 kB
.output/server/_ssr/breadcrumb-pCT_sDq4.mjs                        2.74 kB │ gzip:   0.83 kB
.output/server/_ssr/routes-DoRiFevc.mjs                            2.86 kB │ gzip:   0.91 kB
.output/server/_listKey-DOk-oF2D.mjs                               2.93 kB │ gzip:   1.16 kB
.output/server/_ssr/button-yokujyud.mjs                            3.15 kB │ gzip:   1.23 kB
.output/server/_libs/class-variance-authority+clsx.mjs             3.17 kB │ gzip:   1.24 kB
.output/server/_libs/braintree__sanitize-url.mjs                   3.41 kB │ gzip:   1.13 kB
.output/server/_libs/is-hotkey.mjs                                 3.98 kB │ gzip:   1.66 kB
.output/server/_libs/compute-scroll-into-view.mjs                  4.07 kB │ gzip:   1.65 kB
.output/server/_ssr/no-access-BVbHUPan.mjs                         4.09 kB │ gzip:   1.12 kB
.output/server/_libs/h3-rules.mjs                                  4.20 kB │ gzip:   1.39 kB
.output/server/_libs/@tanstack/react-router-ssr-query+[...].mjs    4.35 kB │ gzip:   1.34 kB
.output/server/_ssr/page-container-DhxrQ5K-.mjs                    4.38 kB │ gzip:   1.10 kB
.output/server/_ssr/logo-D0SViIMe.mjs                              4.50 kB │ gzip:   1.43 kB
.output/server/_tanstack-start-manifest_v-BsBw2vE0.mjs             4.56 kB │ gzip:   1.13 kB
.output/server/_ssr/toaster-BD0zwd3m.mjs                           4.58 kB │ gzip:   1.42 kB
.output/server/_libs/slate-history.mjs                             5.67 kB │ gzip:   1.71 kB
.output/server/_ssr/dropdown-menu-abBoxLAC.mjs                     6.21 kB │ gzip:   1.53 kB
.output/server/_ssr/use-prevent-navigation-GvvQ3uhJ.mjs            6.66 kB │ gzip:   1.75 kB
.output/server/_libs/tanstack__react-query.mjs                     6.74 kB │ gzip:   1.84 kB
.output/server/_ssr/error-boundary-CMm36eB9.mjs                    7.08 kB │ gzip:   1.87 kB
.output/server/_ssr/dashboard-DZQLU5WO.mjs                         9.42 kB │ gzip:   1.92 kB
.output/server/_libs/h3-v2+rou3.mjs                                9.80 kB │ gzip:   3.05 kB
.output/server/_listKey.create-DpzKyPdu.mjs                        9.89 kB │ gzip:   2.79 kB
.output/server/_ssr/init-COrSB8ea.mjs                             10.15 kB │ gzip:   2.68 kB
.output/server/_ssr/signup-Dr6akTYh.mjs                           10.16 kB │ gzip:   2.64 kB
.output/server/_ssr/item-page-actions-DVINgy_9.mjs                11.07 kB │ gzip:   2.56 kB
.output/server/_ssr/signin-Db7QUfmO.mjs                           11.14 kB │ gzip:   2.65 kB
.output/server/_ssr/reset-CRAk9BYZ.mjs                            12.03 kB │ gzip:   2.72 kB
.output/server/_libs/tanstack__history.mjs                        12.08 kB │ gzip:   3.47 kB
.output/server/_libs/@whatwg-node/disposablestack+[...].mjs       13.38 kB │ gzip:   2.69 kB
.output/server/_libs/lodash.mjs                                   17.86 kB │ gzip:   4.46 kB
.output/server/_libs/juggle__resize-observer.mjs                  18.51 kB │ gzip:   4.46 kB
.output/server/_libs/@prisma/adapter-better-sqlite3+[...].mjs     22.54 kB │ gzip:   6.59 kB
.output/server/_libs/@graphql-ts/extend+[...].mjs                 25.53 kB │ gzip:   6.07 kB
.output/server/_libs/@envelop/core+[...].mjs                      25.89 kB │ gzip:   6.10 kB
.output/server/index.mjs                                          27.34 kB │ gzip:   8.04 kB
.output/server/_ssr/sidebar-D-RLsXUl.mjs                          29.26 kB │ gzip:   5.95 kB
.output/server/_libs/lucide-react.mjs                             30.33 kB │ gzip:   5.70 kB
.output/server/_listKey._id-D-Pk63Zu.mjs                          31.88 kB │ gzip:   5.62 kB
.output/server/_libs/whatwg-node__server.mjs                      33.32 kB │ gzip:   8.14 kB
.output/server/_libs/bcryptjs.mjs                                 36.73 kB │ gzip:  12.09 kB
.output/server/_ssr/graphql-client-CWkj-Jzw.mjs                   40.95 kB │ gzip:   8.55 kB
.output/server/_ssr/prisma-C7VZWDGm.mjs                           42.87 kB │ gzip:  10.75 kB
.output/server/_libs/fastify__busboy.mjs                          43.18 kB │ gzip:  10.59 kB
.output/server/_ssr/router-IaX-H2oO.mjs                           44.82 kB │ gzip:  12.12 kB
.output/server/_libs/h3+rou3+srvx.mjs                             47.80 kB │ gzip:  12.90 kB
.output/server/_libs/decimal.js.mjs                               55.25 kB │ gzip:  15.43 kB
.output/server/_ssr/dashboard-daSBwOBW.mjs                        58.02 kB │ gzip:   9.85 kB
.output/server/_libs/slate-dom.mjs                                58.96 kB │ gzip:  14.93 kB
.output/server/_ssr/ssr.mjs                                       64.91 kB │ gzip:  16.90 kB
.output/server/_libs/tanstack__query-core.mjs                     67.58 kB │ gzip:  14.47 kB
.output/server/_libs/@graphql-tools/merge+[...].mjs               71.68 kB │ gzip:  15.83 kB
.output/server/_libs/@graphql-tools/schema+[...].mjs              75.93 kB │ gzip:  13.20 kB
.output/server/_libs/@tanstack/router-core+[...].mjs              79.47 kB │ gzip:  19.86 kB
.output/server/_libs/tailwind-merge.mjs                           88.13 kB │ gzip:  15.66 kB
.output/server/_libs/graphql-yoga+lru-cache.mjs                   98.23 kB │ gzip:  26.17 kB
.output/server/_listKey-rjVnrveW.mjs                              99.01 kB │ gzip:  16.88 kB
.output/server/_ssr/mutation-state-CmybAhSX.mjs                  100.18 kB │ gzip:  21.64 kB
.output/server/_libs/slate-react.mjs                             115.06 kB │ gzip:  24.94 kB
.output/server/_libs/@whatwg-node/fetch+[...].mjs                116.56 kB │ gzip:  23.85 kB
.output/server/_libs/@prisma/adapter-pg.mjs                      168.81 kB │ gzip:  40.39 kB
.output/server/_ssr/dashboard-auth-MMwGmhdG.mjs                  180.35 kB │ gzip:  35.09 kB
.output/server/_libs/slate.mjs                                   189.13 kB │ gzip:  38.17 kB
.output/server/_ssr/graphql-error-details-8QcouSJU.mjs           259.97 kB │ gzip:  41.81 kB
.output/server/_libs/@base-ui/react+[...].mjs                    508.13 kB │ gzip: 107.69 kB
.output/server/_libs/@tanstack/react-router+[...].mjs            664.73 kB │ gzip: 138.93 kB
.output/server/_libs/@graphql-tools/executor+[...].mjs           696.59 kB │ gzip: 128.10 kB
.output/server/_libs/@prisma/adapter-mariadb+[...].mjs           930.08 kB │ gzip: 280.58 kB

✓ built in 505ms
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
nf3: could not resolve `traceInclude` entry "node-libcurl" from any root
```

### fresh temporary-copy npm run build passed after the revert state

```text
fresh temporary-copy npm run build passed after the revert state
```

### $ npx --no-install prisma migrate status

```text
$ npx --no-install prisma migrate status
Datasource "db": PostgreSQL database "cms", schema "public" at "127.0.0.1:32796"

7 migrations found in prisma/migrations

Database schema is up to date!
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
```

### fresh Prisma migration status passed

```text
fresh Prisma migration status passed
```

### Cleanup verified: disposable PostgreSQL/container, fixture process, temporary copy, source generated artifacts/schema, and source node_modules caches were restored byte-for-byte; no GAP-14 marker/path residue remains.

```text
Cleanup verified: disposable PostgreSQL/container, fixture process, temporary copy, source generated artifacts/schema, and source node_modules caches were restored byte-for-byte; no GAP-14 marker/path residue remains.
```

## Compatibility boundaries

- Keystone-compatible generation runs before migration and emits GraphQL, AdminMeta, view-order/custom-view module, types, and Prisma artifacts.
- Prisma migrate dev --create-only creates the migration for inspection/customization; Prisma's shadow database remains the data-loss/drift oracle.
- Prisma Client is regenerated after every applied migration.
- Fresh processes exercise sudo GraphQL CRUD through the generated schema and Prisma adapter; this is not rendered dashboard/browser CRUD.
- The pg_dump/pg_restore backup check is bounded to the disposable PostgreSQL container; the rollback copy is dropped and verified.
- Vite, Nitro, and jiti writable caches are fixture-local; source generated artifacts/schema and cache fingerprints must remain unchanged.
