# GAP-09 auth/session/reset continuity evidence

Status: PASS

Date: 2026-08-14T21:11:27.195Z

The bounded suite used disposable PostgreSQL and separate Node processes. The container, worker processes, and local temporary directory are asserted absent in finally.

## Migration contract

- Existing User/Role rows and bcrypt password hashes are retained.
- Replacement cookies survive a process restart only when every process uses the same SESSION_SECRET, cookie name, and replacement token format. The sibling Keystone Iron cookie format is intentionally not imported.
- Secret rotation intentionally invalidates old stateless cookies; deploy the new secret as a coordinated cutover.
- Init, sign-in, sign-out cookie clearing, and arbitrary Account.handle/credential auth are exercised in separate worker processes.
- Password reset storage fields are migrated with the auth list. Existing reset tokens are single-use and use Auth 8.1.0's sanitized 10-minute default (configurable from 10 seconds through 24 hours); reset replay/expiry is rejected.
- Known and unknown reset requests have the same Boolean response; only the known account invokes the token hook and stores reset state. No token is returned in the response or report.
- Any prior report is removed before execution; failures write Status: FAILED after container, worker-process, and temporary-directory cleanup assertions.
- Cookies are HttpOnly/SameSite=Lax; Secure is explicit in production and can derive from X-Forwarded-Proto only when trustProxy is enabled.
- Login/reset failures are generic; login is bounded to five attempts per identity/client window and does not reveal whether an account exists. The limiter is process-local and needs shared production storage for multi-instance enforcement.
- SMTP delivery, sibling-cookie survival, clock skew, and immediate stateless bearer revocation remain external boundaries.

## Evidence

### $ npm run migrate

```text
$ npm run migrate
> migrate
> npm run cms:generate && prisma migrate deploy && prisma generate


> cms:generate
> tsx scripts/cms-generate.ts

[cms][memory] bootstrap mode=seeded(default)
Generated 11 CMS artifacts.
Datasource "db": PostgreSQL database "cms", schema "public" at "127.0.0.1:32794"

8 migrations found in prisma/migrations

Applying migration `20250529211349_initial_migration`
Applying migration `20250618162316_add_description_field_to_todo`
Applying migration `20250621232051_add_all_fields`
Applying migration `20250704004833_add_image_field`
Applying migration `20250704011715_make_todoimage_a_separate_model`
Applying migration `20250806014640_update_user_to_include_reset_token_field`
Applying migration `20250815215522_add_multi_select_field_to_todo_model`
Applying migration `20260718000000_prisma7_join_table_primary_key`

The following migration(s) have been applied:

migrations/
  └─ 20250529211349_initial_migration/
    └─ migration.sql
  └─ 20250618162316_add_description_field_to_todo/
    └─ migration.sql
  └─ 20250621232051_add_all_fields/
    └─ migration.sql
  └─ 20250704004833_add_image_field/
    └─ migration.sql
  └─ 20250704011715_make_todoimage_a_separate_model/
    └─ migration.sql
  └─ 20250806014640_update_user_to_include_reset_token_field/
    └─ migration.sql
  └─ 20250815215522_add_multi_select_field_to_todo_model/
    └─ migration.sql
  └─ 20260718000000_prisma7_join_table_primary_key/
    └─ migration.sql

All migrations have been successfully applied.

✔ Generated Prisma Client (7.9.1) to ./src/generated/prisma in 29ms

Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
```

### $ npm run db:seed:demo

```text
$ npm run db:seed:demo
> db:seed:demo
> prisma db seed

Running seed command `tsx prisma/seed.ts` ...
Seeded Prisma CMS demo data.

🌱  The seed command has been executed.
Loaded Prisma config from prisma.config.ts.
```

### $ npx prisma migrate deploy

```text
$ npx prisma migrate deploy
Datasource "db": PostgreSQL database "cms_init", schema "public" at "127.0.0.1:32794"

8 migrations found in prisma/migrations

Applying migration `20250529211349_initial_migration`
Applying migration `20250618162316_add_description_field_to_todo`
Applying migration `20250621232051_add_all_fields`
Applying migration `20250704004833_add_image_field`
Applying migration `20250704011715_make_todoimage_a_separate_model`
Applying migration `20250806014640_update_user_to_include_reset_token_field`
Applying migration `20250815215522_add_multi_select_field_to_todo_model`
Applying migration `20260718000000_prisma7_join_table_primary_key`

The following migration(s) have been applied:

migrations/
  └─ 20250529211349_initial_migration/
    └─ migration.sql
  └─ 20250618162316_add_description_field_to_todo/
    └─ migration.sql
  └─ 20250621232051_add_all_fields/
    └─ migration.sql
  └─ 20250704004833_add_image_field/
    └─ migration.sql
  └─ 20250704011715_make_todoimage_a_separate_model/
    └─ migration.sql
  └─ 20250806014640_update_user_to_include_reset_token_field/
    └─ migration.sql
  └─ 20250815215522_add_multi_select_field_to_todo_model/
    └─ migration.sql
  └─ 20260718000000_prisma7_join_table_primary_key/
    └─ migration.sql

All migrations have been successfully applied.
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
```

### $ npx --no-install tsx scripts/validate-cms-auth-continuity-worker.ts

```text
$ npx --no-install tsx scripts/validate-cms-auth-continuity-worker.ts
[cms][memory] bootstrap mode=seeded(default)
{"mode":"login","cookie":"keystonejs-session=[REDACTED]; Max-Age=31104000; Path=/; Expires=Mon, 09 Aug 2027 21:11:17 GMT; HttpOnly; SameSite=Lax","token":"[REDACTED]","itemId":"user_admin"}
```

### $ npx --no-install tsx scripts/validate-cms-auth-continuity-worker.ts

```text
$ npx --no-install tsx scripts/validate-cms-auth-continuity-worker.ts
[cms][memory] bootstrap mode=seeded(default)
{"mode":"read","itemId":"user_admin"}
```

### $ npx --no-install tsx scripts/validate-cms-auth-continuity-worker.ts

```text
$ npx --no-install tsx scripts/validate-cms-auth-continuity-worker.ts
[cms][memory] bootstrap mode=seeded(default)
{"mode":"signout","ended":true,"anonymous":true}
```

### $ npx --no-install tsx scripts/validate-cms-auth-continuity-worker.ts

```text
$ npx --no-install tsx scripts/validate-cms-auth-continuity-worker.ts
[cms][memory] bootstrap mode=seeded(default)
{"mode":"init","itemId":"cmstfze800001a7uzx74pqtcf"}
```

### $ npx --no-install tsx scripts/validate-cms-auth-continuity-worker.ts

```text
$ npx --no-install tsx scripts/validate-cms-auth-continuity-worker.ts
[cms][memory] bootstrap mode=seeded(default)
{"mode":"arbitrary","listKey":"Account","identityField":"handle","secretField":"credential","authenticated":true}
```

### $ npx --no-install tsx scripts/validate-cms-auth-continuity-worker.ts

```text
$ npx --no-install tsx scripts/validate-cms-auth-continuity-worker.ts
[cms][memory] bootstrap mode=seeded(default)
{"mode":"legacy","itemId":"user_admin"}
```

### $ npx --no-install tsx scripts/validate-cms-auth-continuity-worker.ts

```text
$ npx --no-install tsx scripts/validate-cms-auth-continuity-worker.ts
[cms][memory] bootstrap mode=seeded(default)
{"mode":"rotated","itemId":null}
```

### $ npx --no-install tsx scripts/validate-cms-auth-continuity-worker.ts

```text
$ npx --no-install tsx scripts/validate-cms-auth-continuity-worker.ts
[cms][memory] bootstrap mode=seeded(default)
{"mode":"proxy","httpsSecure":true,"httpSecure":false}
```

### $ npx --no-install tsx scripts/validate-cms-auth-continuity-worker.ts

```text
$ npx --no-install tsx scripts/validate-cms-auth-continuity-worker.ts
[cms][memory] bootstrap mode=seeded(default)
{"mode":"reset","redeemed":true,"replay":"TOKEN_REDEEMED","expired":"TOKEN_EXPIRED"}
```

### $ npx --no-install tsx scripts/validate-cms-auth-continuity-worker.ts

```text
$ npx --no-install tsx scripts/validate-cms-auth-continuity-worker.ts
[cms][memory] bootstrap mode=seeded(default)
{"mode":"reset-enumeration","unknownResponse":true,"knownResponse":true,"hookCalls":1,"knownTokenStored":true,"unknownTokenStored":false}
```

### $ npx --no-install tsx scripts/validate-cms-auth-continuity-worker.ts

```text
$ npx --no-install tsx scripts/validate-cms-auth-continuity-worker.ts
[cms][memory] bootstrap mode=seeded(default)
{"mode":"rate","attempts":6,"genericFailure":true,"blocked":true}
```

### two-process cookie continuity: {"firstProcess":{"itemId":"user_admin"},"secondProcess":{"mode":"read","itemId":"user_admin"},"signout":{"mode":"signout","ended":true,"anonymous":true},"init":{"mode":"init","itemId":"cmstfze800001a7uzx74pqtcf"},"arbitrary":{"mode":"arbitrary","listKey":"Account","identityField":"handle","secretField":"credential","authenticated":true},"legacyCookie":{"mode":"legacy","itemId":"user_admin"},"rotatedSecret":{"mode":"rotated","itemId":null}}

```text
two-process cookie continuity: {"firstProcess":{"itemId":"user_admin"},"secondProcess":{"mode":"read","itemId":"user_admin"},"signout":{"mode":"signout","ended":true,"anonymous":true},"init":{"mode":"init","itemId":"cmstfze800001a7uzx74pqtcf"},"arbitrary":{"mode":"arbitrary","listKey":"Account","identityField":"handle","secretField":"credential","authenticated":true},"legacyCookie":{"mode":"legacy","itemId":"user_admin"},"rotatedSecret":{"mode":"rotated","itemId":null}}
```

### proxy cookie policy: {"mode":"proxy","httpsSecure":true,"httpSecure":false}

```text
proxy cookie policy: {"mode":"proxy","httpsSecure":true,"httpSecure":false}
```

### reset token flow: {"mode":"reset","redeemed":true,"replay":"TOKEN_REDEEMED","expired":"TOKEN_EXPIRED"}

```text
reset token flow: {"mode":"reset","redeemed":true,"replay":"TOKEN_REDEEMED","expired":"TOKEN_EXPIRED"}
```

### reset non-enumeration: {"mode":"reset-enumeration","unknownResponse":true,"knownResponse":true,"hookCalls":1,"knownTokenStored":true,"unknownTokenStored":false}

```text
reset non-enumeration: {"mode":"reset-enumeration","unknownResponse":true,"knownResponse":true,"hookCalls":1,"knownTokenStored":true,"unknownTokenStored":false}
```

### generic failure/rate limit: {"mode":"rate","attempts":6,"genericFailure":true,"blocked":true}

```text
generic failure/rate limit: {"mode":"rate","attempts":6,"genericFailure":true,"blocked":true}
```
